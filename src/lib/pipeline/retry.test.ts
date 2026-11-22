import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { RETRY, RetriesExhausted, withRetry } from "./retry";
import { runPipeline } from "./run";
import type { RunEvent } from "./events";
import { docsInPrompt, installModels, restoreModels, synConfig, synDoc, synFetch } from "./__fixtures__/harness";

const etimedout = () => Object.assign(new Error("connect ETIMEDOUT 10.0.0.1:443"), { code: "ETIMEDOUT" });

/** Let a promise settle while fake time moves on in 500 ms steps (retry waits are the only timers here). */
async function settle<T>(p: Promise<T>, maxMs = 60_000): Promise<{ value?: T; error?: unknown }> {
  let out: { value?: T; error?: unknown } | undefined;
  p.then(
    (value) => (out = { value }),
    (error) => (out = { error }),
  );
  for (let t = 0; t <= maxMs && !out; t += 500) await vi.advanceTimersByTimeAsync(500);
  if (!out) throw new Error("did not settle");
  return out;
}

describe("withRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is 3 attempts in total, waiting 2 s then 4 s", () => {
    expect(RETRY).toEqual({ attempts: 3, delaysMs: [2000, 4000] });
  });

  it("returns the first success without waiting or reporting", async () => {
    const fn = vi.fn(async () => "ok");
    const onRetry = vi.fn();
    expect(await withRetry(fn, RETRY, onRetry)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("after 2 failures waits 2000 then 4000 ms, re-issues the same call, and returns the third try's result", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw etimedout();
      return "third";
    });
    const onRetry = vi.fn();
    const p = withRetry(fn, RETRY, onRetry);
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBe("third");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([r]) => [r.attempt, r.delayMs])).toEqual([
      [2, 2000],
      [3, 4000],
    ]);
  });

  it("gives up after the third failure with RetriesExhausted carrying the last error, and never tries a fourth time", async () => {
    const fn = vi.fn(async () => {
      throw etimedout();
    });
    const { error } = await settle(withRetry(fn, RETRY, () => {}));
    expect(error).toBeInstanceOf(RetriesExhausted);
    expect((error as RetriesExhausted).attempts).toBe(3);
    expect(((error as RetriesExhausted).cause as { code: string }).code).toBe("ETIMEDOUT");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops before the next attempt when told to, without waiting it out", async () => {
    let stop = false;
    const fn = vi.fn(async () => {
      stop = true;
      throw etimedout();
    });
    const { error } = await settle(withRetry(fn, RETRY, () => {}, () => stop));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(RetriesExhausted);
  });
});

describe("at most 3 tries per model call in total (the AI SDK's own retries are off)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    restoreModels();
  });
  // The kind of error the SDK itself would retry (a 503 from the provider), so SDK retries would show up as extra tries.
  const retryable = () => new APICallError({ message: "Service Unavailable", url: "https://gateway.test", requestBodyValues: {}, statusCode: 503, isRetryable: true });

  it("an LLM call failing with a retryable provider error is sent exactly 3 times", async () => {
    const calls = installModels({
      llm: () => {
        throw retryable();
      },
      jev: () => 0.5,
    });
    const { RunCtx } = await import("./context");
    const ctx = new RunCtx({ config: synConfig() }, "Ledgerly Inc.", () => {}, { emit: () => {} });
    const { error } = await settle(ctx.object("filter-llm#0", { model: "test/model", system: "s", prompt: "p", schema: z.object({ decisions: z.array(z.string()) }) }));
    expect(error).toBeInstanceOf(RetriesExhausted);
    expect(calls.llm).toHaveLength(3);
  });

  it("a decision call failing with a retryable provider error is sent exactly 3 times", async () => {
    const calls = installModels({
      llm: () => ({}),
      jev: () => {
        throw retryable();
      },
    });
    const { RunCtx } = await import("./context");
    const ctx = new RunCtx({ config: synConfig() }, "Ledgerly Inc.", () => {}, { emit: () => {} });
    const { error } = await settle(ctx.jev("state", "question", "2026-90001"));
    expect(error).toBeInstanceOf(RetriesExhausted);
    expect(calls.jev).toHaveLength(3);
  });
});

describe("RunCtx retry reporting", () => {
  it("reports a retry as step.retry only while a step is running", async () => {
    const { RunCtx } = await import("./context");
    const events: RunEvent[] = [];
    const ctx = new RunCtx({ config: synConfig() }, "Ledgerly Inc.", (e) => events.push(e), { emit: () => {} });
    ctx.onRetry({ attempt: 2, delayMs: 2000, error: new Error("x") });
    expect(events).toEqual([]);
    await ctx.stage("filter:jev", async () => ctx.onRetry({ attempt: 2, delayMs: 2000, error: new Error("x") }));
    expect(events.filter((e) => e.type === "step.retry")).toEqual([{ type: "step.retry", step: "rank", attempt: 2, delayMs: 2000 }]);
  });
});

// ───────────── Through the pipeline: the events a GC's browser receives ─────────────

describe("retries inside a run", () => {
  const docs = [synDoc("2026-90001"), synDoc("2026-90002")];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", synFetch(docs, (n) => `Effective January 15, 2027. Text of ${n}.`));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restoreModels();
  });

  const answers = {
    filter: (prompt: string) => ({ decisions: docsInPrompt(prompt).map((n) => ({ document_number: n, relevant: true, reason: `Affects payments (${n}).`, areas: ["consumer-payments"] })) }),
    extract: { deadlines: [] },
    actions: (prompt: string) => ({ actions: docsInPrompt(prompt).map((n) => ({ document_number: n, action: "Review the rule." })) }),
  };
  const llm = ({ kind, prompt }: { kind: string; prompt: string }) =>
    kind === "filter" ? answers.filter(prompt) : kind === "extract" ? answers.extract : answers.actions(prompt);

  it("a decision call that throws twice then succeeds: the run finishes, after 2 step.retry events of 2000 and 4000 ms", async () => {
    let n = 0;
    installModels({
      llm,
      jev: ({ state }) => {
        if (state.includes("[2026-90001]") && !state.includes("Text of") && ++n <= 2) throw etimedout();
        return 0.9;
      },
    });
    const events: RunEvent[] = [];
    const { value, error } = await settle(runPipeline(synConfig(), (e) => events.push(e)));
    expect(error).toBeUndefined();
    expect(value?.items.map((i) => i.document_number).sort()).toEqual(["2026-90001", "2026-90002"]);
    expect(events.at(-1)?.type).toBe("run.done");
    const retries = events.filter((e) => e.type === "step.retry");
    expect(retries).toEqual([
      { type: "step.retry", step: "rank", attempt: 2, delayMs: 2000 },
      { type: "step.retry", step: "rank", attempt: 3, delayMs: 4000 },
    ]);
  });

  it("a Federal Register text read that gets two 503s then succeeds: the run finishes, reporting both retries on the step", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      synFetch(docs, (d) => `Effective January 15, 2027. Text of ${d}.`, (url) => (url.includes("govinfo") && url.includes("2026-90001") && ++n <= 2 ? new Response("busy", { status: 503 }) : undefined)),
    );
    const events: RunEvent[] = [];
    // Fresh modules: fr.ts caches window listings and document texts in memory, and earlier tests read these.
    vi.resetModules();
    const fresh = await import("./run");
    const h = await import("./__fixtures__/harness");
    h.installModels({ llm, jev: () => 0.9 });
    const { error } = await settle(fresh.runPipeline(synConfig(), (e) => events.push(e)));
    expect(error).toBeUndefined();
    expect(events.filter((e) => e.type === "step.retry")).toEqual([
      { type: "step.retry", step: "read", attempt: 2, delayMs: 2000 },
      { type: "step.retry", step: "read", attempt: 3, delayMs: 4000 },
    ]);
    expect(n).toBe(3);
  });

  it("a call that fails 3 times: step.failed (label + timeout message), then run.failed, and no later stage runs", async () => {
    const calls = installModels({
      llm: (c) => {
        if (c.kind === "filter") throw etimedout();
        return llm(c);
      },
      jev: () => 0.9,
    });
    const events: RunEvent[] = [];
    const { error } = await settle(runPipeline(synConfig(), (e) => events.push(e)));
    expect(error).toBeDefined();
    const tail = events.slice(-2);
    expect(tail[0]).toEqual({
      type: "step.failed",
      step: "screen",
      label: "Screened them against Ledgerly Inc.'s profile",
      message: "No response after 3 tries. Retry runs this step again with the same settings.",
    });
    expect(tail[1]).toEqual({ type: "run.failed", step: "screen", message: "No response after 3 tries. Retry runs this step again with the same settings." });
    expect(calls.llm.filter((c) => c.kind === "filter")).toHaveLength(3);
    expect(calls.llm.filter((c) => c.kind !== "filter")).toHaveLength(0);
    const started = events.flatMap((e) => (e.type === "step.start" ? [e.step] : []));
    expect(started).toEqual(["scan", "rank", "read", "screen"]);
    expect(events.filter((e) => e.type === "item.confirmed" || e.type === "run.done")).toEqual([]);
  });

  it("when parallel calls all exhaust, the run reports exactly one step.failed and one run.failed, and emits nothing after", async () => {
    installModels({
      llm,
      jev: () => {
        throw etimedout();
      },
    });
    const events: RunEvent[] = [];
    await settle(runPipeline(synConfig(), (e) => events.push(e)));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events.filter((e) => e.type === "step.failed")).toHaveLength(1);
    expect(events.filter((e) => e.type === "run.failed")).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("run.failed");
  });

  it("a parallel sibling that finishes after the run failed sends nothing more (run.failed stays the last event)", async () => {
    installModels({
      llm: async (c) => {
        if (c.kind === "extract" && c.prompt.includes("2026-90001")) throw etimedout();
        if (c.kind === "extract") await new Promise((resolve) => setTimeout(resolve, 20_000));
        return llm(c);
      },
      jev: () => 0.9,
    });
    const events: RunEvent[] = [];
    await settle(runPipeline(synConfig(), (e) => events.push(e)));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events.at(-1)).toMatchObject({ type: "run.failed", step: "verify" });
    expect(events.filter((e) => e.type === "item.confirmed")).toEqual([]);
  });

  it("a failed call's own error text (model ids, vendor names) never reaches the browser", async () => {
    installModels({
      llm,
      jev: () => {
        throw new Error("Gateway: model typesafe-ai/jev is not available for anthropic/claude-sonnet-5.5");
      },
    });
    const events: RunEvent[] = [];
    await settle(runPipeline(synConfig(), (e) => events.push(e)));
    const failed = events.at(-1);
    expect(failed?.type).toBe("run.failed");
    expect(JSON.stringify(events)).not.toMatch(/typesafe|anthropic|Gateway/);
  });

  it("an event that would leak an internal name ends the run with a generic failure instead of reaching the browser", async () => {
    vi.stubGlobal("fetch", synFetch([synDoc("2026-90001", { title: "Notice naming the Jev model" })], () => "Text."));
    installModels({ llm, jev: () => 0.9 });
    const events: RunEvent[] = [];
    // Its own window: fr.ts keeps a listed window in memory, and the other tests listed 2026-12-07..08 already.
    await settle(runPipeline(synConfig({ windowStart: "2026-12-09", windowEnd: "2026-12-10", asOf: "2026-12-10" }), (e) => events.push(e)));
    expect(events.at(-1)).toEqual({ type: "run.failed", step: "read", message: "Something went wrong in this step. Retry runs it again with the same settings." });
    expect(JSON.stringify(events)).not.toMatch(/jev/i);
  });
});
