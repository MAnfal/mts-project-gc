import { describe, expect, it } from "vitest";
import { index, result, suite } from "./__fixtures__/eval-index";
import { shippedJson, shippedSuiteIds } from "./__fixtures__/shipped";
import { EvalIndexSchema, type EvalIndex } from "./index-schema";
import { compareRows, likeForLike, lowestRecall, modelComparisons } from "./models";

// The real shipped index (public/evals/index.json): 9 suites, one of which (w0i) ran more than one model.
const shipped = EvalIndexSchema.parse(shippedJson("index.json"));
const W0I = "arena-2026-11-21-18-40-w0i";
type ReportSetup = { key: string; metrics: Record<string, number | null>; costPerRun: number; msMean: number | null; runs: number; graded: number };

describe("modelComparisons on the shipped bundle", () => {
  const cmp = modelComparisons(shipped);

  it("returns one group per multi-model suite (only w0i), and every row in a group comes from that suite alone", () => {
    expect(cmp.groups.map((g) => g.suite)).toEqual([W0I]);
    for (const g of cmp.groups) for (const r of g.rows) expect({ setup: r.setup, suite: r.result.suite }).toEqual({ setup: r.setup, suite: [g.suite] });
  });

  it("rows are w0i's setups: the like-for-like pair first, then the other pipelines, the baseline last", () => {
    const [g] = cmp.groups;
    expect(g.rows.map((r) => r.setup)).toEqual(["jev-sonnet", "jev-gpt", "jev-sonnet-strict", "llm-sonnet", "baseline-sonnet"]);
    expect(g.models).toEqual(["Sonnet 5.5", "GPT-6.2 Sol"]);
    expect(g.weeks).toEqual([
      { id: "2026-11-02_2026-11-06", split: "test" },
      { id: "2026-11-09_2026-11-13", split: "dev" },
    ]);
    expect(g.rows.map((r) => r.result.runCounts.all.total)).toEqual([18, 18, 18, 18, 18]);
  });

  it("names every other shipped suite as single-model, so none is silently skipped", () => {
    expect(cmp.singleModel.map((s) => s.suite).sort()).toEqual(shippedSuiteIds().filter((s) => s !== W0I));
    expect(new Set(cmp.singleModel.flatMap((s) => s.models))).toEqual(new Set(["Sonnet 5.5"]));
  });

  it("each row's numbers equal report.json's for that setup in that suite (Sonnet jev+llm recall included)", () => {
    const report = shippedJson<{ setups: ReportSetup[] }>(`suites/${W0I}/report.json`);
    const [g] = cmp.groups;
    const sonnetJev = g.rows.find((r) => r.modelLabel === "Sonnet 5.5" && r.method === "jev+llm" && r.promptSet === "default")!;
    expect(sonnetJev.result.recall.all.value).toBe(report.setups.find((s) => s.key === sonnetJev.setup)!.metrics.recall);
    for (const r of g.rows) {
      const s = report.setups.find((x) => x.key === r.setup)!;
      expect({
        setup: r.setup,
        recall: r.result.recall.all.value,
        precision: r.result.precision.all.value,
        datesRight: r.result.datesRight.all.value,
        judgePass: r.result.judgePass.all.value,
        cost: r.result.costPerRunUsd.all.value,
        seconds: r.result.secondsPerRun.all.value,
        graded: r.result.runCounts.all.graded,
      }).toEqual({
        setup: s.key,
        recall: s.metrics.recall,
        precision: s.metrics.precision,
        datesRight: s.metrics.datesRight,
        judgePass: s.metrics.judgePass,
        cost: s.costPerRun,
        seconds: s.msMean === null ? null : s.msMean / 1000,
        graded: s.graded,
      });
    }
  });

  it("marks the live model's rows (the live setup itself never ran in w0i)", () => {
    expect(cmp.live).toEqual({ setup: "jev-sonnet-strict-passages", model: "anthropic/claude-sonnet-5.5", modelLabel: "Sonnet 5.5", promptSet: "strict" });
    expect(cmp.groups[0].rows.filter((r) => r.live).map((r) => r.setup)).toEqual(["jev-sonnet", "jev-sonnet-strict", "llm-sonnet", "baseline-sonnet"]);
    expect(cmp.groups[0].rows.some((r) => r.setup === cmp.live.setup)).toBe(false);
  });

  it("finds the like-for-like pair: same method and prompt, live model vs the other", () => {
    const pairs = likeForLike(cmp.groups[0]);
    expect(pairs.map((p) => [p.live.setup, p.other.setup])).toEqual([["jev-sonnet", "jev-gpt"]]);
  });

  it("ranks recall among the pipeline setups only, and says the lowest is the only one on another vendor", () => {
    const low = lowestRecall(cmp.groups[0]);
    expect(low.among.map((r) => r.setup)).toEqual(["jev-sonnet", "jev-gpt", "jev-sonnet-strict", "llm-sonnet"]);
    expect(low.lowest.map((r) => r.setup)).toEqual(["jev-gpt"]);
    expect(low.onlyOtherVendor).toBe(true);
    // The baseline is outside the comparison set, and its recall is lower still: the claim holds among pipelines only.
    const baseline = cmp.groups[0].rows.find((r) => r.method === "baseline")!;
    expect(baseline.result.recall.all.value!).toBeLessThan(low.lowest[0].result.recall.all.value!);
  });

  it("compares the pair's numbers with their direction: Sonnet recall higher, precision lower, cost higher", () => {
    const [p] = likeForLike(cmp.groups[0]);
    const c = compareRows(p.live.result, p.other.result);
    expect(c.recall.direction).toBe("higher");
    expect(c.precision.direction).toBe("lower");
    expect(c.costPerRunUsd.direction).toBe("higher");
    expect(c.recall.diff).toBeCloseTo(0.9761904761904762 - 0.8571428571428571, 12);
    expect(c.recall.runs).toEqual([18, 18]);
  });
});

// ── Constructed indexes: each guard driven off the shipped data ──

type Info = EvalIndex["setups"][number];
const info = (key: string, model: string, method = "jev+llm", promptSet: string | null = "default", suites = ["su1"]): Info => ({
  key,
  label: key,
  model,
  modelLabel: model.split("/")[1],
  method,
  promptSet,
  suites,
});
const SONNET = "anthropic/sonnet";
const GPT = "openai/gpt";
const at = (setup: string, s: string, recall = 0.5) => result(setup, { recall }, { suite: [s] });
const build = (setups: Info[], suiteResults: ReturnType<typeof result>[], suites = ["su1"], live = "live") =>
  index({
    setups: [info("live", SONNET, "jev+llm", "strict", []), ...setups],
    suites: suites.map((id) => suite(id, 2)),
    suiteResults,
    live: result(live),
  });

describe("modelComparisons guards (constructed index)", () => {
  it("leaves a single-model suite out of the comparisons and names it instead", () => {
    const idx = build([info("a", SONNET), info("b", SONNET, "llm")], [at("a", "su1"), at("b", "su1")]);
    const cmp = modelComparisons(idx);
    expect(cmp.groups).toEqual([]);
    expect(cmp.singleModel).toEqual([{ suite: "su1", models: ["sonnet"] }]);
  });

  it("never pools suites: two multi-model suites give two groups, each with its own rows", () => {
    const idx = build(
      [info("a", SONNET, "jev+llm", "default", ["su1", "su2"]), info("g", GPT, "jev+llm", "default", ["su1", "su2"])],
      [at("a", "su1", 0.9), at("g", "su1", 0.8), at("a", "su2", 0.7), at("g", "su2", 0.6)],
      ["su1", "su2"],
    );
    const cmp = modelComparisons(idx);
    expect(cmp.groups.map((g) => [g.suite, g.rows.map((r) => `${r.setup}:${r.result.recall.all.value}`)])).toEqual([
      ["su1", ["a:0.9", "g:0.8"]],
      ["su2", ["a:0.7", "g:0.6"]],
    ]);
  });

  it("ignores a pooled (multi-suite) result: only a suite's own results make its rows", () => {
    const pooled = result("g", { recall: 0.1 }, { suite: ["su1", "su2"] });
    const idx = build([info("a", SONNET), info("g", GPT)], [at("a", "su1"), pooled], ["su1"]);
    expect(modelComparisons(idx).groups).toEqual([]);
  });

  it("throws when the live setup is not in index.setups (nothing to highlight by)", () => {
    const idx = build([info("a", SONNET), info("g", GPT)], [at("a", "su1"), at("g", "su1")], ["su1"], "ghost");
    expect(() => modelComparisons(idx)).toThrow("live setup ghost is not in index.setups");
  });

  it("throws when a suite result names a setup index.setups lacks (its model would be unknown)", () => {
    const idx = build([info("a", SONNET)], [at("a", "su1"), at("mystery", "su1")]);
    expect(() => modelComparisons(idx)).toThrow("suite su1 has results for setup mystery, which index.setups lacks");
  });
});

describe("likeForLike / lowestRecall guards", () => {
  it("has no pair when the other model ran a different prompt set or method", () => {
    const idx = build([info("a", SONNET), info("g", GPT, "jev+llm", "strict"), info("l", GPT, "llm")], [at("a", "su1"), at("g", "su1"), at("l", "su1")]);
    expect(likeForLike(modelComparisons(idx).groups[0])).toEqual([]);
  });

  it("says the lowest is not only the other vendor when a live-model setup ties or ranks lowest", () => {
    const idx = build([info("a", SONNET), info("g", GPT), info("b", SONNET, "baseline")], [at("a", "su1", 0.4), at("g", "su1", 0.8), at("b", "su1", 0.1)]);
    const low = lowestRecall(modelComparisons(idx).groups[0]);
    expect(low.among.map((r) => r.setup)).toEqual(["a", "g"]);
    expect(low.lowest.map((r) => r.setup)).toEqual(["a"]);
    expect(low.onlyOtherVendor).toBe(false);

    const tie = build([info("a", SONNET), info("g", GPT)], [at("a", "su1", 0.5), at("g", "su1", 0.5)]);
    const t = lowestRecall(modelComparisons(tie).groups[0]);
    expect(t.lowest.map((r) => r.setup)).toEqual(["a", "g"]);
    expect(t.onlyOtherVendor).toBe(false);
  });

  it("says not only the other vendor when another-vendor setup ranks lowest but a second one does not", () => {
    const idx = build([info("a", SONNET), info("g", GPT), info("g2", GPT, "llm")], [at("a", "su1", 0.9), at("g", "su1", 0.5), at("g2", "su1", 0.95)]);
    const low = lowestRecall(modelComparisons(idx).groups[0]);
    expect(low.lowest.map((r) => r.setup)).toEqual(["g"]);
    expect(low.onlyOtherVendor).toBe(false);
  });

  it("leaves a setup with no recall out of the ranking", () => {
    const idx = build([info("a", SONNET), info("g", GPT)], [at("a", "su1", 0.9), result("g", { recall: null }, { suite: ["su1"] })]);
    const low = lowestRecall(modelComparisons(idx).groups[0]);
    expect(low.among.map((r) => r.setup)).toEqual(["a"]);
    expect(low.lowest.map((r) => r.setup)).toEqual(["a"]);
  });
});

describe("compareRows directions", () => {
  const r = (recall: number | null) => result("x", { recall });
  it("is higher, lower, the same, or unknown when either side has no value", () => {
    expect(compareRows(r(0.9), r(0.8)).recall.direction).toBe("higher");
    expect(compareRows(r(0.8), r(0.9)).recall.direction).toBe("lower");
    expect(compareRows(r(0.8), r(0.8)).recall).toMatchObject({ direction: "same", diff: 0 });
    expect(compareRows(r(null), r(0.8)).recall).toMatchObject({ direction: null, diff: null });
  });
});
