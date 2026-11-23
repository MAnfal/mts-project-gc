import { describe, expect, it } from "vitest";
import type { EvalTargets } from "@/lib/config/schemas";
import { evidenceOnly, index, iteration, result, suite } from "./__fixtures__/eval-index";
import type { EvalStory } from "./story-schema";
import { fillTemplate, formatValue, modelsContext, modelsStory, resolveQuote, storyContext } from "./story";
import { computeVerdict } from "./verdict";

const TARGETS: EvalTargets = { recall: 0.9, precision: 0.8, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.9, beatsBaseline: true, nearMiss: 0.01 };
const row = (text: string) => ({ text, link: "cases" as const, linkLabel: "Go" });
const STORY: EvalStory = {
  page: { title: "Evaluation summary", description: "Frozen eval set" },
  verdict: {
    beatsAll: "Beats the baseline on every measure, and meets {{verdict.met}} of {{verdict.total}} targets",
    beatsSome: "Beats the baseline on {{verdict.wins}} of {{verdict.compared}} measures, and meets {{verdict.met}} of {{verdict.total}} targets",
    sub: "{{verdict.misses}} Held-out precision is {{live.precision.test}}.",
    miss: "{{measure}} is {{gap}} short of its {{target}} target ({{runs}} runs).",
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
  cards: { liveLine: "Live: {{live.label}}", liveLink: "See it" },
  liveSetup: {
    title: "Live setup",
    description: "What runs execute",
    intro: "Runs use {{setup.label}}",
    match: "Promoted in {{iteration.number}}",
    mismatch: "Recorded {{recorded}}, running {{setup.id}}",
    facts: { model: "Model", method: "Method", screen: "Screen", cutoff: "Cut-off", promptSet: "Prompt set", passages: "Passages", votes: "Votes", webLeads: "Web leads" },
    passages: "Top {{passages.topN}}",
    noPassages: "Off",
    stagesHeading: "Prompts",
    stages: { screen: { title: "Screen", text: "s" }, filter: { title: "Filter", text: "f" }, extract: { title: "Extract", text: "e" }, actions: { title: "Actions", text: "a" } },
    code: { title: "Code", text: "c" },
    overridden: "Overridden by {{promptSet}}",
    defaultPane: "Default",
    livePane: "Live",
    placeholders: "Filled per run",
  },
  models: {
    title: "Models",
    description: "Compared within one suite",
    liveRule: "Highlighted rows run {{models.live}}.",
    singleModel: "Single model, no comparison",
    why: {
      heading: "Why {{models.live}}",
      intro: "{{models.pair.live}} vs {{models.pair.other}} in {{models.suite}}",
      points: ["{{measures.recall}}: {{models.recall.live}} vs {{models.recall.other}}, {{models.recall.diff}} ({{models.recall.runs}})"],
      closing: "Rests on these.",
    },
    caveats: {
      keyBias: {
        holds: "Only {{models.lowest.setups}} is lowest ({{models.lowest.count}} at it, {{models.otherVendor.count}} other-vendor)",
        otherwise: "Lowest: {{models.lowest.setups}} of {{models.pipeline.count}}",
      },
      priceParity: "Parity checked {{models.priceCheckedOn}}.",
      tuning: "{{models.livePromptSet}} ran on {{models.livePromptSetModels}}; {{models.other}} ran {{models.otherPromptSets}}.",
      oneSuite: "Rests on {{models.suite}}: {{models.suiteWeeks}} weeks, {{models.suiteEvalsets}} company-weeks.",
    },
    judges: "{{judges.minAgree}} of {{judges.count}} must agree.",
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
    expect(fillTemplate(STORY.verdict.sub, c)).toBe("Recall is 0.2 pts short of its 90% target (69 runs). Held-out precision is 81.5%.");
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

// ── The Models page's prose (chunk 10): constructed indexes drive each branch off the shipped data ──

describe("modelsContext / modelsStory", () => {
  type Info = ReturnType<typeof index>["setups"][number];
  const info = (key: string, model: string, method = "jev+llm", promptSet: string | null = null): Info => ({ key, label: key, model, modelLabel: model.split("/")[1], method, promptSet, suites: ["su1"] });
  const at = (setup: string, v: Record<string, number | null>, runs = 18) => result(setup, v, { suite: ["arena-2026-11-21-18-40-su1"], runs });
  const PANEL = { models: ["a/judge-1", "b/judge-2", "c/judge-3"], minAgree: 2 };
  const build = (rows: [Info, ReturnType<typeof result>][]) =>
    index({
      setups: [info("live", "anthropic/sonnet", "jev+llm", "strict"), ...rows.map(([i]) => i)],
      suites: [{ ...suite("arena-2026-11-21-18-40-su1", 2), weeks: [{ id: "w1", split: "dev" as const }, { id: "w2", split: "test" as const }, { id: "w3", split: "test" as const }] }],
      suiteResults: rows.map(([, r]) => r),
      live: result("live"),
    });
  const pair = build([
    [info("s", "anthropic/sonnet"), at("s", { recall: 0.9, precision: 0.5, costPerRunUsd: 0.16 })],
    [info("g", "openai/gpt"), at("g", { recall: 0.8, precision: 0.5, costPerRunUsd: 0.1 }, 17)],
    [info("b", "anthropic/sonnet", "baseline"), at("b", { recall: 0.7 })],
  ]);

  it("fills the rationale from the like-for-like pair, with labels, signed differences and their run counts", () => {
    const v = modelsStory(pair, PANEL, STORY);
    expect(v.heading).toBe("Why sonnet");
    expect(v.intro).toBe("s vs g in su1");
    expect(v.points).toEqual(["Recall: 90% vs 80%, 10.0 pts higher (18 and 17 runs)"]);
    expect(v.judges).toBe("2 of 3 must agree.");
    expect(modelsStory(pair, { models: ["a/1", "b/2", "c/3", "d/4", "e/5"], minAgree: 3 }, STORY).judges).toBe("3 of 5 must agree.");
    expect(v.caveats).toEqual([
      "Only g is lowest (1 at it, 1 other-vendor)",
      "Parity checked 2026-11-21.",
      "strict ran on sonnet; gpt ran default.",
      "Rests on su1: 3 weeks, 2 company-weeks.",
    ]);
  });

  it("phrases equal, lower and unmeasured differences, and cost in dollars", () => {
    const c = modelsContext(pair, PANEL, STORY);
    expect(c["models.precision.diff"]).toBe("the same");
    expect(c["models.costPerRunUsd.diff"]).toBe("$0.060 higher");
    expect(c["models.costPerRunUsd.runs"]).toBe("18 and 17 runs");
    const slow = build([
      [info("s", "anthropic/sonnet"), at("s", { secondsPerRun: 36.5 })],
      [info("g", "openai/gpt"), at("g", { secondsPerRun: 39.4 })],
    ]);
    expect(modelsContext(slow, PANEL, STORY)["models.secondsPerRun.diff"]).toBe("3 s lower");
    const lower = build([
      [info("s", "anthropic/sonnet"), at("s", { recall: 0.7, judgePass: null })],
      [info("g", "openai/gpt"), at("g", { recall: 0.8 })],
    ]);
    const d = modelsContext(lower, PANEL, STORY);
    expect(d["models.recall.diff"]).toBe("10.0 pts lower");
    expect(d["models.recall.runs"]).toBe("18 runs each");
    expect(d["models.judgePass.diff"]).toBe("not comparable");
  });

  it("uses the plain key-bias sentence when the lowest pipeline is not only the other vendor's", () => {
    const tie = build([
      [info("s", "anthropic/sonnet"), at("s", { recall: 0.6 })],
      [info("g", "openai/gpt"), at("g", { recall: 0.8 })],
    ]);
    expect(modelsStory(tie, PANEL, STORY).caveats[0]).toBe("Lowest: s of 2");
  });

  it("counts a tie: two other-vendor setups sharing the lowest recall read as two, not as 'the only one'", () => {
    const two = build([
      [info("s", "anthropic/sonnet"), at("s", { recall: 0.9 })],
      [info("g", "openai/gpt"), at("g", { recall: 0.5 })],
      [info("g2", "openai/gpt", "llm"), at("g2", { recall: 0.5 })],
    ]);
    expect(modelsStory(two, PANEL, STORY).caveats[0]).toBe("Only g and g2 is lowest (2 at it, 2 other-vendor)");
  });

  it("dates price parity from index.json's priceParity, whatever the suite", () => {
    const later = { ...pair, priceParity: { checkedOn: "2027-01-05", source: "config/setups.yaml comment" as const } };
    expect(modelsContext(later, PANEL, STORY)["models.priceCheckedOn"]).toBe("2027-01-05");
  });

  it("throws naming a pair placeholder when no suite has a like-for-like pair (nothing to rest the choice on)", () => {
    const none = build([
      [info("s", "anthropic/sonnet"), at("s", {})],
      [info("g", "openai/gpt", "llm"), at("g", {})],
    ]);
    expect(modelsContext(none, PANEL, STORY)["models.pair.live"]).toBeUndefined();
    expect(() => modelsStory(none, PANEL, STORY)).toThrow("Unknown placeholder {{models.pair.live}}");
  });
});
