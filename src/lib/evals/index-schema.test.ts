import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EvalIndexSchema, METRICS, UserViewIndexSchema, type EvalIndex, type Metric } from "./index-schema";

// A minimal index in the shape scripts/build-eval-index.mts writes. Every number in live/baseline is labelled.
const SUITE = "arena-2026-11-21-22-52-l92";
const num = (value: number | null, split: "all" | "dev" | "test", runs = 34) => ({ value, split, runs, suite: [SUITE] });
const bySplit = (value: number | null) => ({ all: num(value, "all", 69), dev: num(value, "dev"), test: num(value, "test", 35) });
const counts = { total: 36, finished: 35, graded: 35 };

const ratio = (numerator: number, denominator: number, split: "all" | "dev" | "test") => ({
  value: denominator ? numerator / denominator : null,
  numerator,
  denominator,
  split,
  runs: 34,
  suite: [SUITE],
});
const agreement = () => ({ all: ratio(9, 10, "all"), dev: ratio(4, 5, "dev"), test: ratio(5, 5, "test") });

function setupResult(setup: string) {
  const metrics = Object.fromEntries(METRICS.map((m) => [m, bySplit(0.9)])) as Record<Metric, ReturnType<typeof bySplit>>;
  return {
    setup,
    label: setup,
    suite: [SUITE],
    runCounts: { all: { total: 72, finished: 69, graded: 69 }, dev: counts, test: counts },
    ...metrics,
    relevanceAgreement: agreement(),
    tierAgreement: agreement(),
  };
}

function minimalIndex() {
  return {
    schemaVersion: 1,
    source: { branch: "poc", commit: "d9e69e02dec0cd70e1aaf32b7b7d0e26f884d730" },
    suites: [
      {
        id: SUITE,
        createdAt: "2026-11-21T22:52:00.000Z",
        runs: 72,
        traces: 72,
        failed: 2,
        superseded: 0,
        configHashes: ["5f1346a284"],
        weeks: [{ id: "2026-11-09_2026-11-13", split: "dev" }],
        evalsets: ["brightside_2026-11-09_2026-11-13"],
        setups: [{ key: "jev-sonnet-strict-passages", label: "Passages", runs: 36, finished: 35, failed: 1, graded: 35 }],
      },
    ],
    setups: [{ key: "jev-sonnet-strict-passages", label: "Passages", model: "m", modelLabel: "M", method: "jev+llm", promptSet: "strict", suites: [SUITE] }],
    iterations: [
      {
        id: "07-next",
        title: null,
        date: null,
        decision: null,
        setup: null,
        comparedTo: null,
        suite: null,
        results: null,
        evidenceOnly: true,
        measured: null,
        evidence: { systemDiff: false, configDiff: false, errorAnalysis: true },
      },
    ],
    live: setupResult("jev-sonnet-strict-passages"),
    baseline: setupResult("baseline-sonnet"),
    suiteResults: [setupResult("jev-sonnet-strict-passages")],
    noiseBand: null,
    evalSet: { companies: 3, weeks: { dev: 2, test: 2 }, evalsets: 12, relevant: 20, traps: 157 },
    counts: { suites: 1, runs: 72, traces: 72, userViewRuns: 22, iterations: 1 },
    priceParity: { checkedOn: "2026-11-21", source: "config/setups.yaml comment" },
  };
}

describe("EvalIndexSchema", () => {
  it("rejects a price-parity date that is not YYYY-MM-DD, and an index without one", () => {
    expect(EvalIndexSchema.safeParse({ ...minimalIndex(), priceParity: { checkedOn: "21 Nov", source: "config/setups.yaml comment" } }).success).toBe(false);
    const { priceParity: _p, ...without } = minimalIndex();
    void _p;
    expect(EvalIndexSchema.safeParse(without).success).toBe(false);
  });

  it("accepts a minimal valid index and returns the labelled live number", () => {
    const parsed: EvalIndex = EvalIndexSchema.parse(minimalIndex());
    expect(parsed.live.recall.all).toEqual({ value: 0.9, split: "all", runs: 69, suite: [SUITE] });
    expect(parsed.iterations[0].evidenceOnly).toBe(true);
  });

  it("rejects a plain number where a labelled number is required", () => {
    const idx = minimalIndex() as Record<string, unknown> & { live: Record<string, unknown> };
    idx.live.recall = { all: 0.898, dev: 0.912, test: 0.882 };
    expect(EvalIndexSchema.safeParse(idx).success).toBe(false);
  });

  it("rejects a number missing its split", () => {
    const idx = minimalIndex();
    const { split: _split, ...noSplit } = idx.live.recall.all;
    void _split;
    (idx.live.recall as Record<string, unknown>).all = noSplit;
    const res = EvalIndexSchema.safeParse(idx);
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.path.join("."))).toContain("live.recall.all.split");
  });

  it("rejects a number missing its run count", () => {
    const idx = minimalIndex();
    (idx.baseline.precision as Record<string, unknown>).dev = { value: 0.9, split: "dev", suite: [SUITE] };
    const res = EvalIndexSchema.safeParse(idx);
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.path.join("."))).toContain("baseline.precision.dev.runs");
  });

  it("rejects a number filed under the wrong split", () => {
    const idx = minimalIndex();
    idx.live.precision.dev = num(0.9, "test");
    expect(EvalIndexSchema.safeParse(idx).success).toBe(false);
  });

  it("rejects an agreement value that is not its numerator over its denominator", () => {
    const idx = minimalIndex();
    idx.live.relevanceAgreement.all = { ...ratio(9, 10, "all"), value: 0.95 };
    const res = EvalIndexSchema.safeParse(idx);
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.path.join("."))).toContain("live.relevanceAgreement.all.value");
  });

  it("rejects an agreement number missing its denominator", () => {
    const idx = minimalIndex();
    const { denominator: _d, ...noDen } = idx.live.tierAgreement.test;
    void _d;
    (idx.live.tierAgreement as Record<string, unknown>).test = noDen;
    expect(EvalIndexSchema.safeParse(idx).success).toBe(false);
  });

  it("accepts a null agreement over an empty denominator", () => {
    const idx = minimalIndex();
    idx.live.tierAgreement.test = ratio(0, 0, "test");
    expect(EvalIndexSchema.parse(idx).live.tierAgreement.test.value).toBeNull();
  });

  it("rejects a number that names no suite", () => {
    const idx = minimalIndex();
    idx.live.recall.test = { ...num(0.9, "test"), suite: [] };
    expect(EvalIndexSchema.safeParse(idx).success).toBe(false);
  });
});

// The committed bundle is generated by scripts/build-eval-bundle.sh; these read the real files, not a fixture.
const BUNDLE = path.resolve(import.meta.dirname, "../../../public/evals");
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(BUNDLE, rel), "utf8"));

describe("the shipped public/evals bundle", () => {
  it("index.json validates and labels the live setup's pooled recall", () => {
    const idx = EvalIndexSchema.parse(readJson("index.json"));
    expect(idx.live.setup).toBe("jev-sonnet-strict-passages");
    expect(idx.live.recall.all.suite).toEqual(["arena-2026-11-21-22-52-l92", "arena-2026-11-21-23-16-du8"]);
    expect(idx.live.recall.all.split).toBe("all");
    expect(idx.counts.suites).toBe(9);
    expect(idx.counts.userViewRuns).toBe(22);
  });

  it("index.json carries live relevance agreement over both iteration-06 suites (335 of 354 keyed docs)", () => {
    const idx = EvalIndexSchema.parse(readJson("index.json"));
    const a = idx.live.relevanceAgreement.all;
    expect([a.numerator, a.denominator]).toEqual([335, 354]);
    expect(a.suite).toEqual(["arena-2026-11-21-22-52-l92", "arena-2026-11-21-23-16-du8"]);
    expect(a.runs).toBe(69);
  });

  it("index.json gives every iteration with a record its measured candidate over its own suite", () => {
    const idx = EvalIndexSchema.parse(readJson("index.json"));
    for (const it of idx.iterations) {
      if (it.evidenceOnly) {
        expect(it.measured).toBeNull();
        continue;
      }
      expect(it.measured?.candidate.setup).toBe(it.setup);
      expect(it.measured?.candidate.suite).toEqual([it.suite]);
      expect(it.measured?.comparedTo?.setup ?? null).toBe(it.comparedTo);
    }
    const it06 = idx.iterations.find((i) => i.id === "06-passages");
    expect(it06?.measured?.candidate.recall.all.runs).toBe(35);
    expect(it06?.evidence).toEqual({ systemDiff: true, configDiff: true, errorAnalysis: true });
  });

  it("index.json gives a dev-only suite's setups a null held-out split over 0 runs", () => {
    const idx = EvalIndexSchema.parse(readJson("index.json"));
    const devOnly = idx.suiteResults.filter((r) => r.suite[0] === "arena-2026-11-21-21-04-ly9");
    expect(devOnly.map((r) => r.setup)).toEqual(["jev-sonnet-strict-vote3"]);
    expect(devOnly[0].recall.test).toEqual({ value: null, split: "test", runs: 0, suite: ["arena-2026-11-21-21-04-ly9"] });
    expect(devOnly[0].runCounts.test).toEqual({ total: 0, finished: 0, graded: 0 });
    expect(devOnly[0].recall.dev.runs).toBe(1);
  });

  it("index.json names the noise band's control and its two suites", () => {
    const idx = EvalIndexSchema.parse(readJson("index.json"));
    expect(idx.noiseBand?.setup).toBe("jev-sonnet-strict");
    expect(idx.noiseBand?.suites).toEqual(["arena-2026-11-21-22-52-l92", "arena-2026-11-21-23-16-du8"]);
    expect(idx.evalSet).toEqual({ companies: 3, weeks: { dev: 2, test: 2 }, evalsets: 12, relevant: 20, traps: 157 });
  });

  it("index.json carries the price-parity check date read from config/setups.yaml's comment", () => {
    expect(EvalIndexSchema.parse(readJson("index.json")).priceParity).toEqual({ checkedOn: "2026-11-21", source: "config/setups.yaml comment" });
  });

  it("user-view/index.json validates and keeps the failed runs", () => {
    const uv = UserViewIndexSchema.parse(readJson("user-view/index.json"));
    expect(uv).toHaveLength(22);
    expect(uv.filter((r) => r.status === "error").length).toBeGreaterThan(0);
  });
});
