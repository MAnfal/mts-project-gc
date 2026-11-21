import { describe, expect, it } from "vitest";
import { overallScore } from "../src/lib/suite";

describe("overallScore", () => {
  it("is the weighted mean of the metrics that exist", () => {
    expect(overallScore({ recall: 1, precision: 0.5 }, { recall: 2, precision: 1 })).toBeCloseTo(2.5 / 3);
    expect(overallScore({ recall: 1, precision: null }, { recall: 2, precision: 1 })).toBeCloseTo(1);
    expect(overallScore({}, { recall: 1 })).toBeNull();
  });
});

describe("modelLabel", () => {
  it("prettifies ids not listed in setups.yaml", async () => {
    const { modelLabel } = await import("../src/lib/models");
    expect(modelLabel("anthropic/claude-opus-5.5")).toBe("Opus 5.5");
    expect(modelLabel("anthropic/claude-haiku-5.5")).toBe("Haiku 5.5");
    expect(modelLabel("openai/gpt-6.2-sol")).toBe("GPT-6.2 Sol");
  });
});

describe("per-run normalisation", () => {
  it("divides outcome counts by the number of graded runs", async () => {
    const { perRun } = await import("../src/lib/suite");
    expect(perRun({ tp: 41, fn: 1, trapHit: 43, tn: 194, unlabeled: 8 }, 18)).toEqual({ tp: 41 / 18, fn: 1 / 18, trapHit: 43 / 18, tn: 194 / 18, unlabeled: 8 / 18 });
    expect(perRun({ tp: 1, fn: 0, trapHit: 0, tn: 0, unlabeled: 0 }, 0)).toEqual({ tp: 0, fn: 0, trapHit: 0, tn: 0, unlabeled: 0 });
  });

  it("averages each stage's in → out counts across runs (the funnel)", async () => {
    const { stageFunnel } = await import("../src/lib/suite");
    const run = (stages: { name: string; inCount?: number; outCount?: number; ms: number; costUsd: number }[]) => ({ stages }) as never;
    const f = stageFunnel([run([{ name: "filter:jev", inCount: 448, outCount: 70, ms: 10, costUsd: 0.01 }]), run([{ name: "filter:jev", inCount: 448, outCount: 76, ms: 30, costUsd: 0.03 }])]);
    expect(f).toEqual([{ name: "filter:jev", inAvg: 448, outAvg: 73, msAvg: 20, costAvg: 0.02 }]);
  });
});
