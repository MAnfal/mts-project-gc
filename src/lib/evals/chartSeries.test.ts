import { describe, expect, it } from "vitest";
import { evidenceOnly, index, iteration, result, suite } from "./__fixtures__/eval-index";
import { METRICS, type NoiseBandData } from "./index-schema";
import type { EvalStory, Outcome } from "./story-schema";
import { bandApplies, chartSeries, noiseVerdict } from "./chartSeries";

const storyOf = (outcomes: Record<string, Outcome>) =>
  ({ iterations: Object.fromEntries(Object.entries(outcomes).map(([id, outcome]) => [id, { label: id, outcome, moved: [] }])) }) as unknown as EvalStory;

const band = (recall: number | null, precision: number | null, suites: [string, string] = ["L1", "L2"]): NoiseBandData => ({
  setup: "control",
  suites,
  measures: Object.fromEntries(
    METRICS.map((m) => [m, { value: m === "recall" ? recall : m === "precision" ? precision : 0, values: [0.5, 0.5], runs: [35, 35] }]),
  ) as NoiseBandData["measures"],
});

// 00–02 on a 6-eval-set suite, 03–04 on 12-eval-set suites (the eval set doubled), 05 evidence only.
const SUITES = [suite("S6", 6), suite("L1", 12), suite("L2", 12)];
const ITERATIONS = [
  iteration("00-base", "S6", { recall: 0.71, precision: 0.81 }, null),
  iteration("01-a", "S6", { recall: 0.98, precision: 0.49 }, {}),
  iteration("02-b", "S6", { recall: 0.93, precision: 0.83 }, {}),
  iteration("03-c", "L1", { recall: 0.88, precision: 0.79 }, {}),
  iteration("04-d", "L1", { recall: 0.89, precision: 0.81 }, {}, "live"),
  evidenceOnly("05-next"),
];
const STORY = storyOf({ "00-base": "reference", "01-a": "kept", "02-b": "promoted", "03-c": "rejected", "04-d": "promoted", "05-next": "next" });
const idx = (over = {}) => index({ suites: SUITES, iterations: ITERATIONS, live: result("live"), ...over });

describe("chartSeries (one point per iteration with results, broken where the eval set changed size)", () => {
  it("starts a new segment where the iteration's suite has a different eval-set count", () => {
    const s = chartSeries(idx(), STORY);
    expect(s.points.map((p) => [p.id, p.evalsets, p.segment])).toEqual([
      ["00-base", 6, 0],
      ["01-a", 6, 0],
      ["02-b", 6, 0],
      ["03-c", 12, 1],
      ["04-d", 12, 1],
    ]);
    expect(s.breaks).toEqual([{ before: "03-c", from: 6, to: 12 }]);
    expect(s.segments).toEqual([0, 1]);
  });

  it("puts each point's values only in its own segment's keys, so no line joins 02 to 03", () => {
    const { rows } = chartSeries(idx(), STORY);
    expect(rows[2]).toEqual({ id: "02-b", recall_0: 0.93, precision_0: 0.83 });
    expect(rows[3]).toEqual({ id: "03-c", recall_1: 0.88, precision_1: 0.79 });
    expect("recall_1" in rows[2]).toBe(false);
    expect("recall_0" in rows[3]).toBe(false);
  });

  it("keeps every point's labelled numbers (value, split, runs, suite) for the tooltip", () => {
    const p = chartSeries(idx(), STORY).points[3];
    expect(p.recall).toEqual({ value: 0.88, split: "all", runs: 10, suite: ["L1"] });
  });

  it("leaves out evidence-only iterations", () => {
    expect(chartSeries(idx(), STORY).points.map((p) => p.id)).not.toContain("05-next");
  });

  it("marks the reference as a square, kept or promoted as filled, the rest hollow, and the live setup's point", () => {
    const s = chartSeries(idx(), STORY);
    expect(s.points.map((p) => p.marker)).toEqual(["square", "filled", "filled", "hollow", "filled"]);
    expect(s.points.filter((p) => p.live).map((p) => p.id)).toEqual(["04-d"]);
  });

  it("throws when an iteration has no story entry, or its suite is not in the index", () => {
    expect(() => chartSeries(idx(), storyOf({ "00-base": "reference" }))).toThrow("iteration 01-a has no entry in config/eval-story.yaml");
    expect(() => chartSeries(idx({ suites: [suite("S6", 6)] }), STORY)).toThrow("iteration 03-c ran on suite L1, which is not in index.json");
  });
});

describe("chartSeries noise band", () => {
  it("is null when the index has no noise band (the control did not run in both suites)", () => {
    expect(chartSeries(idx({ noiseBand: null }), STORY).band).toBeNull();
  });

  it("shades the live point's value plus or minus the control's spread, per measure", () => {
    const b = chartSeries(idx({ noiseBand: band(0.04, 0.02) }), STORY).band;
    expect(b?.at).toBe("04-d");
    expect(b?.recall?.[0]).toBeCloseTo(0.85, 10);
    expect(b?.recall?.[1]).toBeCloseTo(0.93, 10);
    expect(b?.precision?.[0]).toBeCloseTo(0.79, 10);
    expect(b?.suites).toEqual(["L1", "L2"]);
  });

  it("omits a measure whose spread the data cannot give", () => {
    const b = chartSeries(idx({ noiseBand: band(null, 0.02) }), STORY).band;
    expect(b?.recall).toBeNull();
    expect(b?.precision).not.toBeNull();
  });

  it("is null when no iteration ran the live setup", () => {
    expect(chartSeries(idx({ noiseBand: band(0.04, 0.02), live: result("other") }), STORY).band).toBeNull();
  });
});

describe("noiseVerdict and bandApplies (wording a gap against the band)", () => {
  it("says no change, within noise under the band, beyond noise at or over it, nothing without a band", () => {
    expect(noiseVerdict(0, 0.04)).toBe("no change");
    expect(noiseVerdict(0.01, 0.04)).toBe("within noise");
    expect(noiseVerdict(-0.039, 0.04)).toBe("within noise");
    expect(noiseVerdict(0.027, 0.0206)).toBe("beyond noise");
    expect(noiseVerdict(0.04, 0.04)).toBe("beyond noise");
    expect(noiseVerdict(0.01, null)).toBeNull();
  });

  it("applies the band only to suites the same size as the ones it was measured on", () => {
    const i = idx({ noiseBand: band(0.04, 0.02) });
    expect(bandApplies(i, "L1")).toBe(true);
    expect(bandApplies(i, "S6")).toBe(false);
    expect(bandApplies(idx({ noiseBand: null }), "L1")).toBe(false);
  });
});
