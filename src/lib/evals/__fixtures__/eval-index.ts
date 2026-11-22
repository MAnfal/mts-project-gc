import { METRICS, SPLITS, type EvalIndex, type IterationSummary, type Metric, type Split } from "../index-schema";

/**
 * Constructed eval-index pieces for the verdict, story and chart tests. Shapes follow index-schema.ts; values
 * are whatever a test passes, so each guard can be driven off the shipped data.
 */
type SetupResult = EvalIndex["live"];
export type Values = Partial<Record<Metric | "relevanceAgreement" | "tierAgreement", number | null>>;

/** A setup result with every measure 0.5 unless given; the same value in every split. */
export function result(setup: string, values: Values = {}, { suite = ["s1"], runs = 10 }: { suite?: string[]; runs?: number } = {}): SetupResult {
  const bySplit = <T,>(f: (sp: Split) => T) => Object.fromEntries(SPLITS.map((sp) => [sp, f(sp)])) as Record<Split, T>;
  const v = (k: keyof Values) => (k in values ? (values[k] as number | null) : 0.5);
  const agreement = (k: "relevanceAgreement" | "tierAgreement") =>
    bySplit((split) => {
      const x = v(k);
      const denominator = x === null ? 0 : 1000;
      const numerator = x === null ? 0 : Math.round(x * 1000);
      return { value: denominator ? numerator / denominator : null, numerator, denominator, split, runs, suite };
    });
  return {
    setup,
    label: setup,
    suite,
    runCounts: bySplit(() => ({ total: runs, finished: runs, graded: runs })),
    ...(Object.fromEntries(METRICS.map((m) => [m, bySplit((split) => ({ value: v(m), split, runs, suite }))])) as Record<
      Metric,
      SetupResult["recall"]
    >),
    relevanceAgreement: agreement("relevanceAgreement"),
    tierAgreement: agreement("tierAgreement"),
  };
}

/** One iteration with a measured candidate (and comparedTo, unless null) over `suite`. */
export function iteration(id: string, suite: string, cand: Values, comp: Values | null, setup = `${id}-setup`): IterationSummary {
  return {
    id,
    title: id,
    date: null,
    decision: null,
    setup,
    comparedTo: comp ? "control" : null,
    suite,
    results: null,
    evidenceOnly: false,
    measured: { candidate: result(setup, cand, { suite: [suite] }), comparedTo: comp ? result("control", comp, { suite: [suite] }) : null },
    evidence: { systemDiff: false, configDiff: false, errorAnalysis: false },
  };
}

export const evidenceOnly = (id: string): IterationSummary => ({
  id,
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
});

export const suite = (id: string, evalsets: number) => ({
  id,
  createdAt: "2026-11-21T00:00:00.000Z",
  runs: evalsets * 6,
  traces: evalsets * 6,
  failed: 0,
  superseded: 0,
  configHashes: [],
  weeks: [],
  evalsets: Array.from({ length: evalsets }, (_, i) => `e${i}`),
  setups: [],
});

/** A full index around the given pieces; live and baseline default to a clear win for live. */
export function index(over: Partial<EvalIndex> = {}): EvalIndex {
  return {
    schemaVersion: 1,
    source: { branch: "poc", commit: "0".repeat(40) },
    suites: [],
    setups: [],
    iterations: [],
    live: result("live", { recall: 0.95, precision: 0.85, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.95, costPerRunUsd: 0.2 }),
    baseline: result("base", { recall: 0.6, precision: 0.7, datesRight: 0.8, tierAgreement: 0.7, relevanceAgreement: 0.9, costPerRunUsd: 0.5 }),
    suiteResults: [],
    noiseBand: null,
    evalSet: { companies: 3, weeks: { dev: 2, test: 2 }, evalsets: 12, relevant: 20, traps: 157 },
    counts: { suites: 0, runs: 0, traces: 0, userViewRuns: 0, iterations: 0 },
    priceParity: { checkedOn: "2026-11-21", source: "config/setups.yaml comment" },
    ...over,
  };
}
