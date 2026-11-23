import { describe, expect, it } from "vitest";
import { shippedRuns, shippedTrace } from "./__fixtures__/shipped";
import type { TraceEvent } from "./loader";
import { filterWhy, judgeView, traceFacts, type FactRun } from "./runFacts";

// Real shipped records: the 06 suite (l92), SkyHop Oct 26–30 (the power-bank case), and the first suite (w0i).
const L92 = "arena-2026-11-21-22-52-l92";
const W0I = "arena-2026-11-21-18-40-w0i";
const POWER_BANK = "2026-21922";
const l92 = new Map(shippedRuns<FactRun>(L92).map((r) => [r.id, r]));
const PASSAGES_R0 = l92.get("2026-11-21T22-52-25-360Z_pipeline_3ou2")!; // 06 setup, repeat 0, judged
const PASSAGES_R1 = l92.get("2026-11-21T22-52-25-372Z_pipeline_0u7h")!; // 06 setup, repeat 1
const STRICT_R0 = l92.get("2026-11-21T22-52-25-360Z_pipeline_eang")!; // 05 setup, repeat 0, missed the power bank
const FAILED = l92.get("2026-11-21T22-52-25-375Z_pipeline_wqxz")!;

describe("filterWhy", () => {
  it("gives the LLM filter's reason for a doc that reached it", () => {
    expect(filterWhy(PASSAGES_R0, POWER_BANK)).toEqual({
      kind: "llm",
      relevant: true,
      reason: expect.stringMatching(/^PHMSA NPRM would amend 49 CFR 175\.10/),
    });
  });

  it("says the pre-filter screened a doc out, with its score and the run's threshold", () => {
    expect(filterWhy(PASSAGES_R0, "2026-21716")).toEqual({ kind: "jev", probability: 0.04, threshold: 0.1 });
  });

  it("gives the failure for a run that did not finish", () => {
    expect(filterWhy(FAILED, POWER_BANK)).toEqual({ kind: "failed", error: expect.stringMatching(/^Failed after 4 attempts/) });
  });

  it("says a single-prompt baseline run has no filter step", () => {
    const baseline = shippedRuns<FactRun>(W0I).find((r) => r.config.mode === "baseline")!;
    expect(baseline.decisions).toBeUndefined();
    expect(filterWhy(baseline, POWER_BANK)).toEqual({ kind: "baseline" });
  });

  it("says when a finished run recorded no decision for the doc", () => {
    expect(filterWhy(PASSAGES_R0, "1999-00001")).toEqual({ kind: "none" });
  });

  it("keeps an LLM decision whose reason is missing, with a null reason", () => {
    const run: FactRun = { id: "r", status: "done", config: {}, decisions: [{ document_number: "D", relevant: false, llm: { relevant: false } }] };
    expect(filterWhy(run, "D")).toEqual({ kind: "llm", relevant: false, reason: null });
  });
});

describe("judgeView", () => {
  it("shows repeat 0's panel verdicts for the doc, votes per criterion and each judge's reasoning", () => {
    const v = judgeView(PASSAGES_R0, POWER_BANK);
    expect(v.kind).toBe("judged");
    if (v.kind !== "judged") return;
    expect(v.judges).toEqual(["anthropic/claude-opus-5.5", "openai/gpt-6.2-sol", "google/gemini-4-carbon"]);
    expect(v.verdicts).toEqual([
      { criterion: "clear", verdict: "PASS", votes: ["PASS", "PASS", "PASS"] },
      { criterion: "grounded", verdict: "PASS", votes: ["PASS", "PASS", "PASS"] },
      { criterion: "covers", verdict: "PASS", votes: ["PASS", "PASS", "PASS"] },
    ]);
    expect(v.reasoning).toHaveLength(9);
    expect(v.reasoning.find((x) => x.model === "openai/gpt-6.2-sol" && x.criterion === "grounded")?.why).toMatch(/two-power-bank limit/);
  });

  it("says a later repeat was not judged (the panel judges only the first repeat)", () => {
    expect(PASSAGES_R1.panel).toBeUndefined();
    expect(judgeView(PASSAGES_R1, POWER_BANK)).toEqual({ kind: "notJudged" });
  });

  it("says there was nothing to judge when the judged run did not flag the doc", () => {
    expect(STRICT_R0.panel).toBeDefined();
    expect(judgeView(STRICT_R0, POWER_BANK)).toEqual({ kind: "nothingToJudge" });
  });
});

describe("traceFacts", () => {
  it("counts the events and keeps the passages the filter read, per doc", () => {
    const events = shippedTrace<TraceEvent>(L92, PASSAGES_R0.id);
    const facts = traceFacts(events);
    expect(facts.events).toBe(events.length);
    const pb = facts.passages.get(POWER_BANK)!;
    expect(pb.chunks).toBe(238);
    expect(pb.picked.map((p) => p.index)).toEqual([102, 103, expect.any(Number)]);
    expect(pb.picked[0].text).toMatch(/power banks/);
    // Not always three: a short document had only two passages to pick from.
    expect(facts.passages.get("2026-21960")!.picked).toHaveLength(2);
  });

  it("has no passages for a setup that doesn't record them", () => {
    const facts = traceFacts(shippedTrace<TraceEvent>(L92, STRICT_R0.id));
    expect(facts.passages.size).toBe(0);
    expect(facts.events).toBeGreaterThan(0);
  });

  it("is empty for an empty trace", () => {
    expect(traceFacts([])).toEqual({ events: 0, passages: new Map() });
  });
});
