import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrDoc, RunConfig } from "../types";
import { majority } from "../grade";
import type { RunEvent } from "./events";
import { plannedStages, runPipeline, RunFailed } from "./run";
import { combineFilterPasses } from "./stages";
import { docsInPrompt, installModels, restoreModels, synConfig, synDoc, synFetch, type LlmCall } from "./__fixtures__/harness";

// The ported stages' branches the recorded replay never reaches (it is one run of one setup), each driven with a
// constructed input: other filter modes, the filter's majority vote and missing-answer retry, a re-fetch that fails
// or disagrees, a document with no text, actions the model leaves out or fills with dates, a run with no items.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  restoreModels();
});


const yes = (n: string, areas: string[] = ["consumer-payments"]) => ({ document_number: n, relevant: true, reason: `Changes how Ledgerly handles ${n}.`, areas });
const no = (n: string) => ({ document_number: n, relevant: false, reason: `Nothing for Ledgerly in ${n}.`, areas: [] });

interface Opts {
  docs: FrDoc[];
  config?: Partial<RunConfig>;
  text?: (n: string) => string;
  override?: (url: string) => Response | undefined;
  filter?: (docs: string[], call: number) => unknown[];
  extract?: (prompt: string) => unknown[];
  actions?: (docs: string[]) => unknown[];
  jev?: (state: string) => number;
}

async function run(o: Opts) {
  // fr.ts caches listings and texts in memory for the life of the module, so each run gets fresh modules.
  vi.resetModules();
  const { runPipeline } = await import("./run");
  const { installModels } = await import("./__fixtures__/harness");
  vi.stubGlobal("fetch", synFetch(o.docs, o.text ?? (() => "Effective January 15, 2027."), o.override));
  let filterCalls = 0;
  const calls = installModels({
    llm: (c: LlmCall) => {
      const docs = docsInPrompt(c.prompt);
      if (c.kind === "filter") return { decisions: (o.filter ?? ((ds) => ds.map((n) => yes(n))))(docs, filterCalls++) };
      if (c.kind === "extract") return { deadlines: o.extract?.(c.prompt) ?? [] };
      return { actions: (o.actions ?? ((ds) => ds.map((n) => ({ document_number: n, action: `Review ${n}.` }))))(docs) };
    },
    jev: ({ state }) => (o.jev ?? (() => 0.9))(state),
  });
  const events: RunEvent[] = [];
  const config = synConfig(o.config);
  const result = await runPipeline(config, (e) => events.push(e));
  const done = events.at(-1);
  if (done?.type !== "run.done") throw new Error("run did not finish");
  return { result, events, done, calls, config };
}

const started = (events: RunEvent[]) => events.flatMap((e) => (e.type === "step.start" ? [e.step] : []));

describe("filter modes other than the live one", () => {
  it.each([
    ["jev+llm with passages (the live setup)", {}, ["scan", "rank", "read", "screen", "verify", "write"]],
    ["jev+llm without passages", { filterExcerpts: undefined }, ["scan", "rank", "screen", "verify", "write"]],
    ["llm only", { filter: "llm" as const }, ["scan", "screen", "verify", "write"]],
    ["relevance only", { filter: "jev" as const, filterExcerpts: undefined }, ["scan", "rank", "verify", "write"]],
  ])("%s: runs exactly the planned steps, and run.start announces them", async (_name, config, steps) => {
    const { events } = await run({ docs: [synDoc("2026-90001")], config });
    expect(started(events)).toEqual(steps);
    const start = events[0];
    expect(start.type === "run.start" && start.steps.map((s) => s.step)).toEqual(steps);
    expect(plannedStages(synConfig(config)).length).toBe(steps.length);
  });

  it("llm only: every scanned document goes to the LLM filter and none is ranked or cut", async () => {
    const docs = [synDoc("2026-90001"), synDoc("2026-90002"), synDoc("2026-90003")];
    const { calls, done, result } = await run({ docs, config: { filter: "llm" }, filter: (ds) => ds.map((n) => (n.endsWith("1") ? yes(n) : no(n))) });
    expect(calls.jev).toHaveLength(0);
    expect(docsInPrompt(calls.llm.find((c) => c.kind === "filter")!.prompt)).toEqual(["2026-90001", "2026-90002", "2026-90003"]);
    expect(result.decisions.map((d) => d.jevProbability)).toEqual([undefined, undefined, undefined]);
    expect(done.notReviewedCount).toBe(0);
    // No relevance scores to rank by: the rejected documents keep their scan order.
    expect(done.screenedOut.map((s) => s.document_number)).toEqual(["2026-90002", "2026-90003"]);
  });

  it("relevance cut: a document scoring below the threshold is never sent to the LLM and is counted as not reviewed", async () => {
    const { calls, done } = await run({
      docs: [synDoc("2026-90001"), synDoc("2026-90002")],
      config: { filterExcerpts: undefined },
      jev: (s) => (s.includes("[2026-90002]") ? 0.05 : 0.9),
    });
    expect(docsInPrompt(calls.llm.find((c) => c.kind === "filter")!.prompt)).toEqual(["2026-90001"]);
    expect(done.notReviewedCount).toBe(1);
    expect(done.items.map((i) => i.document_number)).toEqual(["2026-90001"]);
  });
});

describe("LLM filter", () => {
  it("asks again, once, for documents the model left out, and leaves still-unanswered ones not relevant", async () => {
    const { calls, result } = await run({
      docs: [synDoc("2026-90001"), synDoc("2026-90002"), synDoc("2026-90003")],
      filter: (ds, call) => (call === 0 ? ds.filter((n) => n.endsWith("1")).map((n) => yes(n)) : ds.filter((n) => n.endsWith("2")).map((n) => yes(n))),
    });
    const filterPrompts = calls.llm.filter((c) => c.kind === "filter").map((c) => docsInPrompt(c.prompt));
    expect(filterPrompts).toEqual([["2026-90001", "2026-90002", "2026-90003"], ["2026-90002", "2026-90003"]]);
    const dec = new Map(result.decisions.map((d) => [d.document_number, d]));
    expect(dec.get("2026-90002")?.relevant).toBe(true);
    expect(dec.get("2026-90003")?.relevant).toBe(false);
    expect(dec.get("2026-90003")?.llm).toBeUndefined();
  });

  it("ignores an answer for a document it wasn't asked about", async () => {
    const { result } = await run({ docs: [synDoc("2026-90001")], filter: (ds) => [...ds.map((n) => yes(n)), yes("2026-99999")] });
    expect(result.decisions.map((d) => d.document_number)).toEqual(["2026-90001"]);
    expect(result.items.map((i) => i.document_number)).toEqual(["2026-90001"]);
  });

  it("with filterVotes 3, a document is relevant only on a majority of the passes", async () => {
    const votes = [true, false, true];
    const { result, calls } = await run({
      docs: [synDoc("2026-90001")],
      config: { filterVotes: 3 },
      filter: (ds, call) => ds.map((n) => (votes[call] ? yes(n) : no(n))),
    });
    expect(calls.llm.filter((c) => c.kind === "filter")).toHaveLength(3);
    expect(result.decisions[0].llm).toMatchObject({ relevant: true, votes: { yes: 2, no: 1, passes: 3 } });
    expect(result.items).toHaveLength(1);
  });

  it("shows the model the picked passages only for documents that have text", async () => {
    const { calls, events } = await run({
      docs: [synDoc("2026-90001"), synDoc("2026-90002")],
      text: (n) => (n.endsWith("1") ? "Card issuers must refund disputed fees. Effective January 15, 2027." : ""),
      override: (url) => (url.includes("/full_text/") ? new Response("", { status: 404 }) : undefined),
    });
    const prompt = calls.llm.find((c) => c.kind === "filter")!.prompt;
    const [a, b] = [prompt.slice(prompt.indexOf("[2026-90001]"), prompt.indexOf("[2026-90002]")), prompt.slice(prompt.indexOf("[2026-90002]"))];
    expect(a).toContain("Card issuers must refund disputed fees.");
    expect(b).not.toContain("Key passages");
    expect(events.filter((e) => e.type === "step.progress")).toHaveLength(2);
    // Only the document with text got passages.
    expect(events.find((e) => e.type === "step.done" && e.step === "read")).toMatchObject({ count: 1 });
  });
});

describe("combineFilterPasses (ported from poc:poc/tests/filter-vote.test.ts)", () => {
  type Dec = { relevant: boolean; reason: string; areas: string[] };
  const pass = (o: Record<string, Partial<Dec> & { relevant: boolean }>) => new Map(Object.entries(o).map(([k, v]) => [k, { reason: v.relevant ? "yes" : "no", areas: [], ...v }]));

  it("keeps a doc only when a majority of passes call it relevant", () => {
    const out = combineFilterPasses(
      [pass({ a: { relevant: true }, b: { relevant: true }, c: { relevant: false } }), pass({ a: { relevant: true }, b: { relevant: false }, c: { relevant: false } }), pass({ a: { relevant: false }, b: { relevant: true }, c: { relevant: true } })],
      3,
    );
    expect(out.get("a")?.relevant).toBe(true);
    expect(out.get("b")?.relevant).toBe(true);
    expect(out.get("c")?.relevant).toBe(false);
    expect(out.get("a")?.votes).toEqual({ yes: 2, no: 1, passes: 3 });
  });

  it("a pass that didn't answer is an abstention, never a yes", () => {
    const out = combineFilterPasses([pass({ a: { relevant: true } }), pass({ a: { relevant: false } }), pass({})], 3);
    expect(out.get("a")?.relevant).toBe(false);
    expect(out.get("a")?.votes).toEqual({ yes: 1, no: 1, passes: 3 });
  });

  it("takes reason and areas from a pass that agrees with the majority", () => {
    const out = combineFilterPasses(
      [pass({ a: { relevant: false, reason: "minority" } }), pass({ a: { relevant: true, reason: "majority", areas: ["sourcing"] } }), pass({ a: { relevant: true, reason: "also" } })],
      3,
    );
    expect(out.get("a")).toMatchObject({ relevant: true, reason: "majority", areas: ["sourcing"] });
  });

  it("one pass is a pass-through", () => {
    const out = combineFilterPasses([pass({ a: { relevant: true, reason: "r" }, b: { relevant: false } })], 1);
    expect(out.get("a")).toMatchObject({ relevant: true, reason: "r" });
    expect(out.get("b")?.relevant).toBe(false);
  });

  it("majority needs minAgree matching votes; UNKNOWN is no vote; otherwise contested (poc:poc/tests/grade.test.ts)", () => {
    expect(majority(["PASS", "PASS", "FAIL"], 2)).toBe("PASS");
    expect(majority(["FAIL", "UNKNOWN", "FAIL"], 2)).toBe("FAIL");
    expect(majority(["PASS", "FAIL", "UNKNOWN"], 2)).toBe("CONTESTED");
    expect(majority(["PASS", "UNKNOWN", "UNKNOWN"], 2)).toBe("CONTESTED");
  });
});

describe("verify + tier", () => {
  it("holds back a relevant document the Federal Register no longer returns, and tells the GC which and why", async () => {
    const { done, events } = await run({
      docs: [synDoc("2026-90001"), synDoc("2026-90002", { title: "Withdrawn rule" })],
      override: (url) => (url.includes("/documents/2026-90002.json") ? new Response("gone", { status: 404 }) : undefined),
    });
    expect(done.items.map((i) => i.document_number)).toEqual(["2026-90001"]);
    expect(done.dropped).toEqual([{ document_number: "2026-90002", title: "Withdrawn rule", reason: "re-fetch failed: not found on federalregister.gov" }]);
    expect(events.flatMap((e) => (e.type === "item.confirmed" ? [e.item.document_number] : []))).toEqual(["2026-90001"]);
  });

  it("marks a date the re-fetch disagrees with as unverified, and a changed citation as unverified", async () => {
    const scanned = synDoc("2026-90001");
    const refetched = { ...scanned, effective_on: "2027-03-01", citation: "91 FR 99999" };
    const { done } = await run({
      docs: [scanned],
      override: (url) => (url.includes("/documents/2026-90001.json") ? new Response(JSON.stringify(refetched)) : undefined),
    });
    const item = done.items[0];
    expect(item.deadlines.find((d) => d.kind === "effective")).toMatchObject({ date: "2027-03-01", verified: false, verifyNote: "scan said 2027-01-15, re-fetch says 2027-03-01" });
    expect(item.citationVerified).toBe(false);
    expect(done.markdown).toContain("91 FR 99999 (unverified)");
  });

  it("never verifies a missing citation, even when scan and re-fetch both lack one", async () => {
    const { done } = await run({ docs: [synDoc("2026-90001", { citation: null })] });
    expect(done.items[0].citationVerified).toBe(false);
  });

  it("verifies an extracted date by its quote, skips one that repeats a field, and routes a no-area item to the general counsel", async () => {
    const { done, calls } = await run({
      docs: [synDoc("2026-90001", { dates: "Effective January 15, 2027. Comply by June 30, 2027." })],
      filter: (ds) => ds.map((n) => yes(n, [])),
      extract: () => [
        { date: "2027-01-15", kind: "effective", quote: "Effective January 15, 2027." },
        { date: "2027-06-30", kind: "compliance", quote: "Comply by June 30, 2027." },
        { date: "2027-09-01", kind: "other", quote: "Reports due September 1, 2027." },
      ],
    });
    expect(calls.llm.filter((c) => c.kind === "extract")).toHaveLength(1);
    const item = done.items[0];
    expect(item.deadlines.map((d) => [d.kind, d.date, d.source, d.verified])).toEqual([
      ["effective", "2027-01-15", "fr_field", true],
      ["compliance", "2027-06-30", "extracted", true],
      ["other", "2027-09-01", "extracted", false],
    ]);
    expect(item.owner.name).toBe("Jordan Blake (General Counsel)");
    expect(item.areas).toEqual([]);
  });

  it("asks for no extraction when a document has neither a DATES line nor any text", async () => {
    const { calls, done } = await run({
      docs: [synDoc("2026-90001", { dates: null })],
      text: () => "",
      override: (url) => (url.includes("/full_text/") ? new Response("", { status: 404 }) : undefined),
    });
    expect(calls.llm.filter((c) => c.kind === "extract")).toHaveLength(0);
    expect(done.items).toHaveLength(1);
  });
});

describe("actions", () => {
  it("strips any date the model writes, says 'Review.' for an item it skipped, and orders items by tier then deadline", async () => {
    const { done } = await run({
      docs: [
        synDoc("2026-90001", { type: "Notice", effective_on: null, dates: null }),
        synDoc("2026-90002", { effective_on: "2027-02-20", dates: "Effective February 20, 2027." }),
        synDoc("2026-90003"),
      ],
      actions: () => [
        { document_number: "2026-90002", action: "File by January 15, 2027 or 2027-01-15." },
        { document_number: "2026-90003", action: "Update the card disclosures." },
      ],
    });
    expect(done.items.map((i) => [i.document_number, i.tier, i.action])).toEqual([
      ["2026-90003", "Critical", "Update the card disclosures."],
      ["2026-90002", "Critical", "File by [date — see deadline] or [date — see deadline]."],
      ["2026-90001", "Low", "Review."],
    ]);
  });

  it("with nothing relevant, writes no actions and reports an empty triage", async () => {
    const { events, done, calls } = await run({ docs: [synDoc("2026-90001")], filter: (ds) => ds.map(no) });
    expect(started(events)).not.toContain("write");
    expect(calls.llm.filter((c) => c.kind === "actions")).toHaveLength(0);
    expect(done.items).toEqual([]);
    expect(done.markdown).toContain("· 0 items");
  });
});

describe("failing runs", () => {
  it("an unknown profile fails before any step, with run.failed only", async () => {
    vi.stubGlobal("fetch", synFetch([], () => ""));
    const events: RunEvent[] = [];
    await expect(runPipeline(synConfig({ profileId: "no-such-company" }), (e) => events.push(e))).rejects.toBeInstanceOf(RunFailed);
    expect(events).toEqual([{ type: "run.failed", step: null, message: "Something went wrong in this step. Retry starts the run again from the beginning, with the same settings." }]);
  });

  it("a failure outside any step (a run.start that would leak) ends with run.failed only, no step.failed", async () => {
    vi.stubGlobal("fetch", synFetch([], () => ""));
    const { getCompany } = await import("../config");
    const events: RunEvent[] = [];
    const customProfile = { ...getCompany("ledgerly"), name: "Jev Labs" };
    await expect(runPipeline(synConfig({ customProfile }), (e) => events.push(e))).rejects.toBeInstanceOf(RunFailed);
    expect(events).toEqual([{ type: "run.failed", step: null, message: "Something went wrong in this step. Retry starts the run again from the beginning, with the same settings." }]);
  });

  it("writes the internal trace to the server log only when DEBUG_PIPELINE is set", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      await run({ docs: [synDoc("2026-90001")] });
      expect(debug).not.toHaveBeenCalled();
      vi.stubEnv("DEBUG_PIPELINE", "1");
      await run({ docs: [synDoc("2026-90001")] });
      expect(debug.mock.calls.map(([tag]) => tag)).toContain("[Pipeline] filter.decision");
    } finally {
      vi.unstubAllEnvs();
      debug.mockRestore();
    }
  });

  it("once the run has failed, calls still queued give up at once instead of trying 3 times each", async () => {
    vi.useFakeTimers();
    const docs = Array.from({ length: 24 }, (_, i) => synDoc(`2026-9${String(i).padStart(4, "0")}`));
    vi.stubGlobal("fetch", synFetch(docs, () => "Text."));
    const calls = installModels({
      llm: () => ({}),
      jev: () => {
        throw new Error("ETIMEDOUT");
      },
    });
    const p = runPipeline(synConfig({ windowStart: "2030-01-01", windowEnd: "2030-01-01" }), () => {}).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toBeInstanceOf(RunFailed);
    // 16 calls run at once (pipeline.yaml jevConcurrency) and use all 3 tries; the 8 queued behind them stop after one.
    expect(calls.jev.length).toBeLessThan(24 * 3);
    expect(calls.jev.length).toBeLessThanOrEqual(16 * 3 + 8);
  });
});
