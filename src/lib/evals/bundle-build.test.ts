import { describe, expect, it } from "vitest";
import {
  appendSkippedRuns,
  keepManifest,
  keyTotals,
  metricOf,
  noiseBand,
  pickBaselineSetup,
  poolSetupRuns,
  repeatAgreement,
  runCountsOf,
  type SetupReport,
} from "./bundle-build";
import { METRICS } from "./index-schema";

// Synthetic inputs in the shapes scripts/build-eval-index.mts passes: run records from runs.jsonl.gz /
// poc runs/*.json, setups.yaml's setups[], and export.mts's manifest.json text.
const run = (id: string, cell: string, evalset: string, status = "done") => ({ id, status, config: { cell, evalset } });

describe("appendSkippedRuns (a suite's runs.jsonl.gz vs the raw run files on poc)", () => {
  it("appends a raw run export.mts skipped, flagged superseded, after the exported ones", () => {
    const shipped = [run("r1", "a", "e1"), run("r2", "a", "e1")];
    const raw = [run("r1", "a", "e1"), run("r0", "a", "e1", "error"), run("r2", "a", "e1")];
    const out = appendSkippedRuns(shipped, raw);
    expect(out.added).toBe(1);
    expect(out.runs.map((r) => r.id)).toEqual(["r1", "r2", "r0"]);
    expect(out.runs[2]).toEqual({ ...raw[1], superseded: true });
    expect(out.runs[0]).toEqual(shipped[0]);
    expect("superseded" in out.runs[0]).toBe(false);
  });

  it("changes nothing when every raw run was exported", () => {
    const shipped = [run("r1", "a", "e1"), run("r2", "a", "e1")];
    const out = appendSkippedRuns(shipped, [run("r2", "a", "e1"), run("r1", "a", "e1")]);
    expect(out).toEqual({ runs: shipped, added: 0 });
  });

  it("does not mutate its inputs", () => {
    const raw = [run("r9", "a", "e1")];
    appendSkippedRuns([], raw);
    expect(raw[0]).toEqual(run("r9", "a", "e1"));
  });
});

describe("poolSetupRuns (the runs behind index.live / index.baseline)", () => {
  const suites: Record<string, ReturnType<typeof run>[]> = {
    s1: [run("1", "live", "e1"), run("2", "other", "e1")],
    s2: [run("3", "live", "e2"), run("4", "live", "e1")],
  };
  const runsOf = (id: string) => suites[id] ?? [];

  it("pools the setup's runs across the named suites, in suite order", () => {
    expect(poolSetupRuns("live", ["s1", "s2"], runsOf, ["e1", "e2"]).map((r) => r.id)).toEqual(["1", "3", "4"]);
  });

  it("throws when the suites hold no run of the setup", () => {
    expect(() => poolSetupRuns("missing", ["s1", "s2"], runsOf, ["e1"])).toThrow("no runs of setup missing in s1, s2");
  });

  it("throws naming every eval set the pooled runs do not cover", () => {
    expect(() => poolSetupRuns("live", ["s1"], runsOf, ["e1", "e2", "e3"])).toThrow("setup live in s1 misses eval sets: e2, e3");
  });
});

describe("pickBaselineSetup (setups.yaml → the one method: baseline setup)", () => {
  it("returns the single baseline setup's id", () => {
    expect(pickBaselineSetup([{ id: "jev", method: "jev+llm" }, { id: "base", method: "baseline" }])).toBe("base");
  });

  it("throws when there is none", () => {
    expect(() => pickBaselineSetup([{ id: "jev", method: "jev+llm" }])).toThrow("expected one baseline setup in setups.yaml, found 0");
  });

  it("throws when there are several", () => {
    expect(() => pickBaselineSetup([{ id: "b1", method: "baseline" }, { id: "b2", method: "baseline" }])).toThrow("found 2");
  });
});

describe("keepManifest (rebuilds leave manifest.json untouched unless something besides exportedAt changed)", () => {
  const manifest = (exportedAt: string, runs = 72) =>
    JSON.stringify({ schemaVersion: 1, arena: "a", exportedAt, configHash: "9a0f857741", runs }, null, 2);

  it("keeps the committed file when only exportedAt differs", () => {
    const prev = manifest("2026-11-22T18:45:18.576Z");
    expect(keepManifest(prev, manifest("2026-11-23T09:00:00.000Z"))).toBe(prev);
  });

  it("takes the new file when any other field differs", () => {
    const next = manifest("2026-11-23T09:00:00.000Z", 71);
    expect(keepManifest(manifest("2026-11-22T18:45:18.576Z"), next)).toBe(next);
  });

  it("takes the new file when there is no previous one, or it does not parse", () => {
    const next = manifest("2026-11-23T09:00:00.000Z");
    expect(keepManifest(null, next)).toBe(next);
    expect(keepManifest("{not json", next)).toBe(next);
  });
});

// ── Chunk 08: per-split numbers, repeat agreement, noise band, key totals ──

const report = (over: Partial<SetupReport> = {}): SetupReport => ({
  key: "s",
  label: "S",
  model: "m",
  modelLabel: "M",
  method: "jev+llm",
  runs: 36,
  finished: 35,
  failed: 1,
  graded: 34,
  score: 0.93,
  costPerRun: 0.19,
  msMean: 65000,
  config: { promptSet: "strict" },
  metrics: { recall: 0.9, precision: 0.8, trapAvoidance: 0.97, datesRight: 1, tierRight: 0.95, ownerRight: 0.9, judgePass: 0.86, consistency: 0.94, traceChecks: 1 },
  ...over,
});

describe("metricOf (one suiteReport row → a value and the run count it averages over)", () => {
  it("uses graded runs for key-graded metrics, finished for trace checks and time, all runs for cost, panel runs for judges", () => {
    const r = { s: report(), panelRuns: 12 };
    expect(metricOf(r, "recall")).toEqual({ value: 0.9, runs: 34 });
    expect(metricOf(r, "score")).toEqual({ value: 0.93, runs: 34 });
    expect(metricOf(r, "traceChecks")).toEqual({ value: 1, runs: 35 });
    expect(metricOf(r, "secondsPerRun")).toEqual({ value: 65, runs: 35 });
    expect(metricOf(r, "costPerRunUsd")).toEqual({ value: 0.19, runs: 36 });
    expect(metricOf(r, "judgePass")).toEqual({ value: 0.86, runs: 12 });
  });

  it("gives null over 0 runs for a split the suite never ran (dev-only suites have no test row)", () => {
    expect(metricOf({ s: null, panelRuns: 0 }, "recall")).toEqual({ value: null, runs: 0 });
    expect(metricOf({ s: null, panelRuns: 0 }, "costPerRunUsd")).toEqual({ value: null, runs: 0 });
    expect(runCountsOf(null)).toEqual({ total: 0, finished: 0, graded: 0 });
  });

  it("keeps a null time as null rather than dividing it", () => {
    expect(metricOf({ s: report({ msMean: null }), panelRuns: 0 }, "secondsPerRun")).toEqual({ value: null, runs: 35 });
  });
});

type ARun = Parameters<typeof repeatAgreement>[0][number];
const arun = (id: string, evalset: string, docs: [string, string][], extra: Partial<ARun> = {}): ARun => ({
  id,
  status: "done",
  config: { arena: "s1", evalset },
  items: docs.map(([document_number, tier]) => ({ document_number, tier })),
  ...extra,
});
const KEYS: Record<string, { relevant: string[]; traps: string[] | Record<string, unknown> }> = {
  e1: { relevant: ["r1", "r2"], traps: { t1: {}, t2: {} } },
  e2: { relevant: ["r3"], traps: ["t3"] },
};
const SPLITS_OF: Record<string, "dev" | "test"> = { e1: "dev", e2: "test" };
const agree = (runs: ARun[]) =>
  repeatAgreement(runs, (e) => KEYS[e] ?? null, (e) => SPLITS_OF[e]);

describe("repeatAgreement (same relevance call / same tier across a setup's repeats)", () => {
  it("counts a keyed doc as agreeing when every repeat flags it or none does", () => {
    // e1 keyed docs r1 r2 t1 t2: r1 in all 3 (agree), r2 in 2 of 3 (disagree), t1 in none (agree), t2 in 1 (disagree).
    const out = agree([
      arun("a", "e1", [["r1", "Critical"], ["r2", "High"]]),
      arun("b", "e1", [["r1", "Critical"], ["r2", "High"], ["t2", "Low"]]),
      arun("c", "e1", [["r1", "Critical"], ["x9", "Low"]]),
    ]);
    expect(out.dev.relevance).toEqual({ numerator: 2, denominator: 4 });
    expect(out.dev.runs).toBe(3);
    expect(out.test).toEqual({ relevance: { numerator: 0, denominator: 0 }, tier: { numerator: 0, denominator: 0 }, runs: 0 });
  });

  it("checks tier only on docs flagged in every repeat, keyed or not", () => {
    const out = agree([
      arun("a", "e1", [["r1", "Critical"], ["x9", "High"], ["t1", "Low"]]),
      arun("b", "e1", [["r1", "Critical"], ["x9", "Medium"]]),
    ]);
    // r1 and x9 are in both repeats; r1 keeps its tier, x9 does not. t1 (one repeat) is not a tier case.
    expect(out.dev.tier).toEqual({ numerator: 1, denominator: 2 });
  });

  it("groups by suite and eval set, and pools splits into all", () => {
    const out = agree([
      arun("a", "e1", [["r1", "Critical"]]),
      arun("b", "e1", [["r1", "Critical"]]),
      arun("c", "e1", [], { config: { arena: "s2", evalset: "e1" } }),
      arun("d", "e1", [["r1", "Critical"]], { config: { arena: "s2", evalset: "e1" } }),
      arun("e", "e2", [["r3", "High"]]),
      arun("f", "e2", [["r3", "High"]]),
    ]);
    // s1/e1: 4 keyed agree. s2/e1: r1 disagrees, 3 agree. s1/e2: 2 keyed agree.
    expect(out.dev.relevance).toEqual({ numerator: 7, denominator: 8 });
    expect(out.test.relevance).toEqual({ numerator: 2, denominator: 2 });
    expect(out.all.relevance).toEqual({ numerator: 9, denominator: 10 });
    expect(out.all.runs).toBe(6);
  });

  it("leaves out failed and superseded runs, and groups left with fewer than two repeats", () => {
    const out = agree([
      arun("a", "e1", [["r1", "Critical"]]),
      arun("b", "e1", [], { status: "error" }),
      arun("c", "e1", [], { superseded: true }),
      arun("d", "e2", [["r3", "High"]]),
      arun("e", "e2", [["r3", "High"]]),
    ]);
    // e1 has one finished repeat: nothing to agree with, so it is not counted (not counted as agreeing).
    expect(out.dev).toEqual({ relevance: { numerator: 0, denominator: 0 }, tier: { numerator: 0, denominator: 0 }, runs: 0 });
    expect(out.all.runs).toBe(2);
  });

  it("throws when an eval set has no answer key", () => {
    expect(() => agree([arun("a", "e7", []), arun("b", "e7", [])])).toThrow("no answer key for eval set e7");
  });

  it("throws when a run names no suite or eval set", () => {
    expect(() => agree([arun("a", "e1", [], { config: { evalset: "e1" } })])).toThrow("run a has no arena or eval set");
    expect(() => agree([arun("a", "e1", [], { config: { arena: "s1" } })])).toThrow("run a has no arena or eval set");
  });
});

describe("noiseBand (the control's spread between two identical suites)", () => {
  const res = (suite: string, recall: number | null, runs: number) => ({
    suite: [suite],
    ...Object.fromEntries(METRICS.map((m) => [m, { all: { value: m === "recall" ? recall : 0.5, split: "all" as const, runs, suite: [suite] } }])),
  }) as unknown as Parameters<typeof noiseBand>[1];

  it("is the absolute difference per measure, naming both suites and their run counts", () => {
    const band = noiseBand("ctl", res("A", 0.9, 35), res("B", 0.85, 35));
    expect(band?.setup).toBe("ctl");
    expect(band?.suites).toEqual(["A", "B"]);
    expect(band?.measures.recall.value).toBeCloseTo(0.05, 10);
    expect(band?.measures.recall.values).toEqual([0.9, 0.85]);
    expect(band?.measures.recall.runs).toEqual([35, 35]);
    expect(band?.measures.precision.value).toBe(0);
  });

  it("has no value for a measure either suite could not measure", () => {
    expect(noiseBand("ctl", res("A", null, 35), res("B", 0.85, 35))?.measures.recall.value).toBeNull();
  });

  it("is null when the control did not run in both suites", () => {
    expect(noiseBand("ctl", null, res("B", 0.85, 35))).toBeNull();
    expect(noiseBand("ctl", res("A", 0.9, 35), null)).toBeNull();
  });
});

describe("keyTotals (rules that matter and look-alikes across the answer keys)", () => {
  it("sums relevant docs and traps, traps given as a list or a map", () => {
    expect(keyTotals([KEYS.e1, KEYS.e2])).toEqual({ relevant: 3, traps: 3 });
  });
});
