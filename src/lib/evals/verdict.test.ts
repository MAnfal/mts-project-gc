import { describe, expect, it } from "vitest";
import type { EvalTargets } from "@/lib/config/schemas";
import { index, result } from "./__fixtures__/eval-index";
import { computeVerdict, targetStatus } from "./verdict";

const TARGETS: EvalTargets = {
  recall: 0.9,
  precision: 0.8,
  datesRight: 1,
  tierAgreement: 1,
  relevanceAgreement: 0.9,
  beatsBaseline: true,
  nearMiss: 0.01,
};
// Live as recorded in shape: recall just under target, everything else met, beats the baseline everywhere.
const LIVE = { recall: 0.898, precision: 0.815, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.946, costPerRunUsd: 0.19 };

describe("computeVerdict (targets met by live on all weeks, and beats-baseline per measure)", () => {
  it("counts 5 of 6 when only recall misses", () => {
    const v = computeVerdict(index({ live: result("live", LIVE) }), TARGETS);
    expect([v.met, v.total]).toEqual([5, 6]);
    expect(v.targets.find((t) => t.measure === "recall")?.status).toBe("near");
    expect(v.baseline.beatsAll).toBe(true);
  });

  it("counts 4 of 6 when precision drops to 0.79, so the count is computed, not typed", () => {
    const v = computeVerdict(index({ live: result("live", { ...LIVE, precision: 0.79 }) }), TARGETS);
    expect([v.met, v.total]).toEqual([4, 6]);
    expect(v.targets.find((t) => t.measure === "precision")?.status).toBe("near");
  });

  it("meets a target hit exactly (recall 0.900 vs >= 0.9)", () => {
    const v = computeVerdict(index({ live: result("live", { ...LIVE, recall: 0.9 }) }), TARGETS);
    expect(v.targets.find((t) => t.measure === "recall")?.status).toBe("met");
    expect(v.met).toBe(6);
  });

  it("does not count a measure live could not measure as met", () => {
    const v = computeVerdict(index({ live: result("live", { ...LIVE, tierAgreement: null }) }), TARGETS);
    expect(v.targets.find((t) => t.measure === "tierAgreement")?.status).toBe("unmeasured");
    expect(v.met).toBe(4);
  });

  it("leaves a measure the baseline lacks out of beats-baseline, without counting it as a win", () => {
    const baseline = result("base", { recall: 0.6, precision: 0.7, tierAgreement: 0.7, relevanceAgreement: 0.9, costPerRunUsd: 0.5 });
    delete (baseline as Partial<typeof baseline>).datesRight;
    const v = computeVerdict(index({ live: result("live", LIVE), baseline }), TARGETS);
    expect(v.baseline.excluded).toEqual(["datesRight"]);
    expect(v.baseline.comparisons.map((c) => c.measure)).not.toContain("datesRight");
    expect([v.baseline.wins, v.baseline.compared]).toEqual([5, 5]);
  });

  it("leaves out a measure whose baseline value is null", () => {
    const baseline = result("base", { recall: 0.6, precision: 0.7, datesRight: 0.8, tierAgreement: null, relevanceAgreement: 0.9, costPerRunUsd: 0.5 });
    const v = computeVerdict(index({ live: result("live", LIVE), baseline }), TARGETS);
    expect(v.baseline.excluded).toEqual(["tierAgreement"]);
    expect(v.baseline.compared).toBe(5);
  });

  it("does not beat the baseline when live loses or ties on any compared measure; lower cost is the better cost", () => {
    const loses = computeVerdict(index({ live: result("live", { ...LIVE, costPerRunUsd: 0.6 }) }), TARGETS);
    expect(loses.baseline.comparisons.find((c) => c.measure === "costPerRunUsd")?.outcome).toBe("loss");
    expect(loses.baseline.beatsAll).toBe(false);
    expect([loses.baseline.wins, loses.baseline.compared]).toEqual([5, 6]);
    expect([loses.met, loses.total]).toEqual([4, 6]);

    const ties = computeVerdict(
      index({ live: result("live", LIVE), baseline: result("base", { recall: 0.6, precision: 0.7, datesRight: 1, tierAgreement: 0.7, relevanceAgreement: 0.9, costPerRunUsd: 0.5 }) }),
      TARGETS,
    );
    expect(ties.baseline.comparisons.find((c) => c.measure === "datesRight")?.outcome).toBe("tie");
    expect(ties.baseline.beatsAll).toBe(false);
  });

  it("does not claim to beat a baseline it could not compare on anything", () => {
    const empty = result("base", { recall: null, precision: null, datesRight: null, tierAgreement: null, relevanceAgreement: null, costPerRunUsd: null });
    const v = computeVerdict(index({ live: result("live", LIVE), baseline: empty }), TARGETS);
    expect(v.baseline.compared).toBe(0);
    expect(v.baseline.beatsAll).toBe(false);
    expect(v.targets.find((t) => t.measure === "beatsBaseline")?.status).toBe("missed");
  });

  it("drops the beats-baseline target from the total when the config turns it off", () => {
    const v = computeVerdict(index({ live: result("live", LIVE) }), { ...TARGETS, beatsBaseline: false });
    expect([v.met, v.total]).toEqual([4, 5]);
  });
});

describe("targetStatus (scoreboard badge: met, within nearMiss below, missed)", () => {
  it("grades met, near and missed around the target", () => {
    expect(targetStatus(0.9, 0.9, 0.01)).toBe("met");
    expect(targetStatus(0.895, 0.9, 0.01)).toBe("near");
    expect(targetStatus(0.89, 0.9, 0.01)).toBe("near");
    expect(targetStatus(0.889, 0.9, 0.01)).toBe("missed");
    expect(targetStatus(null, 0.9, 0.01)).toBe("unmeasured");
  });
});
