import { describe, expect, it } from "vitest";
import type { EvalTargets } from "@/lib/config/schemas";
import { evidenceOnly, index, iteration, result } from "./__fixtures__/eval-index";
import type { EvalStory } from "./story-schema";
import { fillTemplate, formatValue, resolveQuote, storyContext } from "./story";
import { computeVerdict } from "./verdict";

const TARGETS: EvalTargets = { recall: 0.9, precision: 0.8, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.9, beatsBaseline: true, nearMiss: 0.01 };
const row = (text: string) => ({ text, link: "cases" as const, linkLabel: "Go" });
const STORY: EvalStory = {
  page: { title: "Evaluation summary", description: "Frozen eval set" },
  verdict: {
    beatsAll: "Beats the baseline on every measure, and meets {{verdict.met}} of {{verdict.total}} targets",
    beatsSome: "Beats the baseline on {{verdict.wins}} of {{verdict.compared}} measures, and meets {{verdict.met}} of {{verdict.total}} targets",
    sub: "{{verdict.misses}} Held-out precision is {{live.precision.test}}.",
    miss: "{{measure}} is {{gap}} short of its {{target}} target.",
    allMet: "Every target is met.",
  },
  carl: { context: row("ctx"), action: row("act"), result: row("res"), learning: row("learn") },
  measures: { recall: "Recall", precision: "Precision" } as EvalStory["measures"],
  iterations: {
    "00-base": { label: "Base", outcome: "reference", moved: [] },
    "01-a": { label: "A", outcome: "kept", moved: [] },
    "02-b": { label: "B", outcome: "rejected", moved: [] },
    "03-c": { label: "C", outcome: "promoted", moved: [] },
    "04-next": { label: "Next", outcome: "next", moved: [] },
  },
};
const IDX = index({
  live: result("live", { recall: 0.898, precision: 0.815, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.946, costPerRunUsd: 0.19 }, { runs: 69 }),
  iterations: [iteration("00-base", "s1", {}, null), iteration("01-a", "s1", {}, {}), iteration("02-b", "s1", {}, {}), iteration("03-c", "s2", {}, {}), evidenceOnly("04-next")],
});
const ctx = () => storyContext(IDX, computeVerdict(IDX, TARGETS), STORY);

describe("storyContext + fillTemplate (CARL prose filled from index.json)", () => {
  it("fills live and baseline numbers, formatted, from the index", () => {
    expect(fillTemplate("Recall {{baseline.recall.all}} → {{live.recall.all}}", ctx())).toBe("Recall 60% → 89.8%");
    expect(fillTemplate("{{live.costPerRunUsd.all}} vs {{baseline.costPerRunUsd.all}}", ctx())).toBe("$0.190 vs $0.500");
    expect(fillTemplate("{{live.runs.all}} runs over {{live.suites}} suite", ctx())).toBe("69 runs over 1 suite");
  });

  it("fills eval-set totals and the live cost as a share of the baseline's", () => {
    const c = ctx();
    expect(fillTemplate("{{evalSet.companies}} × {{evalSet.weeks}}: {{evalSet.relevant}} / {{evalSet.traps}}; {{evalSet.devWeeks}}+{{evalSet.testWeeks}}", c)).toBe(
      "3 × 4: 20 / 157; 2+2",
    );
    expect(c["cost.liveShareOfBaseline"]).toBe("38%");
  });

  it("counts changes (iterations measured against another setup) and how many were kept or promoted", () => {
    expect(fillTemplate("{{iterations.changes}} changes, {{iterations.kept}} kept", ctx())).toBe("3 changes, 2 kept");
  });

  it("composes the verdict: counts, and one miss sentence per target missed or nearly missed", () => {
    const c = ctx();
    expect(fillTemplate(STORY.verdict.beatsAll, c)).toBe("Beats the baseline on every measure, and meets 5 of 6 targets");
    expect(fillTemplate(STORY.verdict.sub, c)).toBe("Recall is 0.2 pts short of its 90% target. Held-out precision is 81.5%.");
  });

  it("uses the all-met sentence when nothing is missed", () => {
    const idx = index();
    expect(storyContext(idx, computeVerdict(idx, TARGETS), STORY)["verdict.misses"]).toBe("Every target is met.");
  });

  it("throws on a placeholder the index cannot fill, naming it", () => {
    expect(() => fillTemplate("Recall {{live.recal.all}}", ctx())).toThrow('Unknown placeholder {{live.recal.all}} in "Recall {{live.recal.all}}"');
  });

  it("throws on an unclosed placeholder rather than printing braces", () => {
    expect(() => fillTemplate("Recall {{live.recall.all", ctx())).toThrow("Unclosed placeholder");
  });
});

describe("formatValue", () => {
  it("formats shares as percent, cost in dollars, time in seconds, and a missing value as a dash", () => {
    expect(formatValue("recall", 0.8981481)).toBe("89.8%");
    expect(formatValue("datesRight", 1)).toBe("100%");
    expect(formatValue("costPerRunUsd", 0.1918)).toBe("$0.192");
    expect(formatValue("secondsPerRun", 64.6)).toBe("65 s");
    expect(formatValue("recall", null)).toBe("—");
  });
});

describe("resolveQuote (a moved item's number, quoted verbatim from the record)", () => {
  const rec = { decision: "Promoted: the gain is: doc flagged 0/6 vs 9/9, including the gate. Cost up.", notes: "Five runs failed." };

  it("returns the text from start up to before", () => {
    expect(resolveQuote(rec, { from: "decision", start: "the gain is", before: ", including" })).toBe("the gain is: doc flagged 0/6 vs 9/9");
  });

  it("runs to the end of the field when before is omitted", () => {
    expect(resolveQuote(rec, { from: "notes", start: "Five runs" })).toBe("Five runs failed.");
  });

  it("throws when start is not in the field", () => {
    expect(() => resolveQuote(rec, { from: "notes", start: "the gain is" })).toThrow('quote start "the gain is" is not in the recorded notes');
  });

  it("throws when start appears more than once", () => {
    expect(() => resolveQuote({ decision: "up, then up" }, { from: "decision", start: "up" })).toThrow('quote start "up" appears 2 times in the recorded decision');
  });

  it("throws when before does not follow start", () => {
    expect(() => resolveQuote(rec, { from: "decision", start: "Cost up", before: "the gate" })).toThrow('quote end "the gate" does not follow "Cost up"');
  });

  it("throws when the record has no such field", () => {
    expect(() => resolveQuote({}, { from: "decision", start: "x" })).toThrow("no recorded decision");
  });
});
