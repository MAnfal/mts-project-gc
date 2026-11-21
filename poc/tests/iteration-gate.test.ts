import { describe, expect, it } from "vitest";
import { evidenceProblems } from "../src/lib/iterations";

const analysis = {
  suite: "arena-prev",
  split: "dev",
  generatedAt: "2026-11-22T10:00:00.000Z",
  bySignal: { relevance: 3, fact: 1, trace: 0, judge: 6 },
  buckets: [["judge:covers", 3], ["llm-filter-rejected-a-real-rule", 2]] as [string, number][],
  llm: { rootCauses: [{ cause: "actions are generic" }, { cause: "filter misses indirect supply rules" }] },
};
const spec = { comparedTo: "jev-sonnet-strict", targets: ["judge:covers", "rootCause:1"] };
const ctx = { previousSuite: "arena-prev", suiteStartedAt: "2026-11-22T11:00:00.000Z" };

describe("evidenceProblems (an iteration must start from dev error analysis incl. judge feedback)", () => {
  it("passes when the analysis is of the previous suite, dev-only, has judge signal, predates the run, and targets resolve", () => {
    expect(evidenceProblems(spec, analysis, ctx)).toEqual([]);
  });

  it("the first iteration (nothing to compare to) is exempt", () => {
    expect(evidenceProblems({ targets: [] }, null, { previousSuite: null, suiteStartedAt: ctx.suiteStartedAt })).toEqual([]);
  });

  it("refuses without an error-analysis.json", () => {
    expect(evidenceProblems(spec, null, ctx).join(" ")).toMatch(/error-analysis\.json/);
  });

  it("refuses an analysis of the wrong suite, a non-dev split, or one with no judge signal", () => {
    expect(evidenceProblems(spec, { ...analysis, suite: "arena-other" }, ctx).join(" ")).toMatch(/previous iteration's suite/);
    expect(evidenceProblems(spec, { ...analysis, split: "test" }, ctx).join(" ")).toMatch(/dev/);
    expect(evidenceProblems(spec, { ...analysis, bySignal: { relevance: 3, fact: 1, trace: 0 } }, ctx).join(" ")).toMatch(/judge/);
  });

  it("refuses an analysis written after the iteration's suite started (evidence must come first)", () => {
    expect(evidenceProblems(spec, { ...analysis, generatedAt: "2026-11-22T12:00:00.000Z" }, ctx).join(" ")).toMatch(/before/);
  });

  it("refuses a spec with no targets, or targets that aren't in the analysis", () => {
    expect(evidenceProblems({ ...spec, targets: [] }, analysis, ctx).join(" ")).toMatch(/targets/);
    expect(evidenceProblems({ ...spec, targets: ["judge:clear", "rootCause:7"] }, analysis, ctx).join(" ")).toMatch(/judge:clear.*rootCause:7|rootCause:7.*judge:clear/);
  });
});
