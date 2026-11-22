import { beforeAll, describe, expect, it } from "vitest";
import { assertPublic, STEP_LABELS, stepOf, type RunEvent } from "./events";
import { runReplay, type ReplayResult } from "./__fixtures__/replay";

// What the GC must never see: the internal component's name, its model id, or any model vendor id.
const NEEDLES = ["jev", "typesafe-ai", "claude-", "anthropic/", "openai/", "google/", "moonshotai/"];

describe("assertPublic", () => {
  const base = { type: "step.retry", step: "rank", attempt: 2, delayMs: 2000 } as const;

  it.each([
    ["the decision model's id", { ...base, model: "typesafe-ai/jev" }],
    ["the component's name in a label", { type: "step.start", step: "rank", label: "Jev scored 34" }],
    ["an internal stage id", { type: "step.start", step: "rank", label: "filter:jev" }],
    ["the POC's reason fallback", { type: "item.confirmed", item: { reason: "Jev p=0.42 (no LLM reason)" } }],
    ["a vendor model id (claude-)", { ...base, note: "claude-sonnet-5.5" }],
    ["a vendor prefix (anthropic/)", { ...base, note: "anthropic/x" }],
    ["a vendor prefix (openai/)", { ...base, note: "openai/gpt" }],
    ["a vendor prefix (google/)", { ...base, note: "google/gemini" }],
    ["a vendor prefix (moonshotai/)", { ...base, note: "moonshotai/kimi" }],
    ["a name nested deep in a payload, in capitals", { type: "run.done", items: [{ areas: [{ x: "TYPESAFE-AI" }] }] }],
  ])("throws on %s", (_what, event) => {
    expect(() => assertPublic(event as unknown as RunEvent)).toThrow(/internal name/i);
  });

  it("lets through ordinary words that merely contain the letters (a Sarajevo title, a Jevons reference)", () => {
    const e = { type: "step.progress", step: "read", count: 1, title: "Sanctions on entities in Sarajevo; the Jevons paradox" } as RunEvent;
    expect(() => assertPublic(e)).not.toThrow();
  });

  it("lets a clean event through unchanged", () => {
    const e: RunEvent = { type: "step.retry", step: "rank", attempt: 2, delayMs: 2000 };
    expect(() => assertPublic(e)).not.toThrow();
  });
});

describe("STEP_LABELS", () => {
  it("every label and step key is public", () => {
    for (const [stage, s] of Object.entries(STEP_LABELS)) {
      expect(() => assertPublic({ type: "step.start", step: s.step, label: s.label } as RunEvent), stage).not.toThrow();
    }
  });

  it("fills the company name into the label", () => {
    expect(stepOf("filter:jev", "Ledgerly").label).toBe("Ranked them by relevance to Ledgerly");
  });

  it("refuses a stage that has no public label", () => {
    expect(() => stepOf("scan:web-leads", "Ledgerly")).toThrow(/no public label/);
  });
});

describe("events of a replayed run", () => {
  let r: ReplayResult;
  beforeAll(async () => {
    r = await runReplay();
  }, 60_000);

  it("contain none of the internal names, checked case-insensitively over every serialized event", () => {
    expect(r.events.length).toBeGreaterThan(20);
    for (const e of r.events) {
      const s = JSON.stringify(e).toLowerCase();
      for (const n of NEEDLES) expect(s, `${e.type} contains "${n}"`).not.toContain(n);
    }
  });

  it("label every stage the pipeline ran, in order, from the one table", () => {
    const ran = r.trace.filter((e) => e.type === "stage.start").map((e) => e.stage as string);
    expect(ran).toEqual(["scan:federal-register", "filter:jev", "filter:passages", "filter:llm", "verify+tier", "output:actions"]);
    const starts = r.events.filter((e) => e.type === "step.start");
    expect(starts.map((e) => (e.type === "step.start" ? e.label : ""))).toEqual(ran.map((s) => stepOf(s, "Brightside Foods Co.").label));
  });

  it("open with run.start listing the planned steps, and report progress per passage document with its title", () => {
    const start = r.events[0];
    expect(start.type).toBe("run.start");
    if (start.type !== "run.start") return;
    expect(start.steps.map((s) => s.step)).toEqual(["scan", "rank", "read", "screen", "verify", "write"]);
    const progress = r.events.filter((e) => e.type === "step.progress");
    expect(progress).toHaveLength(20);
    expect(progress.every((e) => e.type === "step.progress" && e.step === "read" && e.title.length > 0)).toBe(true);
    expect(progress.map((e) => (e.type === "step.progress" ? e.count : 0))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("close every started step with step.done carrying a count and a duration", () => {
    const done = r.events.filter((e) => e.type === "step.done");
    expect(done.map((e) => (e.type === "step.done" ? [e.step, e.count] : []))).toEqual([
      ["scan", 466],
      ["rank", 59],
      ["read", 20],
      ["screen", 3],
      ["verify", 3],
      ["write", 3],
    ]);
    expect(done.every((e) => e.type === "step.done" && e.ms >= 0)).toBe(true);
  });
});
