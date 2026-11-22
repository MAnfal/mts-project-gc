/**
 * Pure decisions behind scripts/build-eval-index.mts, kept here so this repo's vitest can test them.
 * That script runs under the POC checkout's tsx and does the file I/O. No fs, no POC imports.
 */
import { METRICS, type Metric } from "./index-schema";

type RunLike = { id: string; config: { cell?: string; evalset?: string } };

/**
 * A suite's runs.jsonl.gz (what export.mts's arenaRuns() returned) plus every raw run file on poc that it
 * left out, appended in raw order and flagged `superseded: true`, so no recorded run is dropped.
 */
export function appendSkippedRuns<R extends { id: string }>(shipped: R[], raw: R[]): { runs: (R & { superseded?: true })[]; added: number } {
  const have = new Set(shipped.map((r) => r.id));
  const missing = raw.filter((r) => !have.has(r.id)).map((r) => ({ ...r, superseded: true as const }));
  return { runs: missing.length ? [...shipped, ...missing] : shipped, added: missing.length };
}

/**
 * One setup's runs pooled over the named suites. Throws if there are none, or if together they miss any
 * eval set in the manifest, so a wrong suite list cannot yield numbers over fewer company-weeks than intended.
 */
export function poolSetupRuns<R extends RunLike>(setup: string, suites: string[], runsOf: (suiteId: string) => R[], evalsetIds: string[]): R[] {
  const pooled = suites.flatMap((id) => runsOf(id)).filter((r) => r.config.cell === setup);
  if (!pooled.length) throw new Error(`no runs of setup ${setup} in ${suites.join(", ")}`);
  const covered = new Set(pooled.map((r) => r.config.evalset));
  const uncovered = evalsetIds.filter((e) => !covered.has(e));
  if (uncovered.length) throw new Error(`setup ${setup} in ${suites.join(", ")} misses eval sets: ${uncovered.join(", ")}`);
  return pooled;
}

/** The baseline setup: the single setups.yaml entry with `method: baseline`. */
export function pickBaselineSetup(setups: { id: string; method: string }[]): string {
  const b = setups.filter((s) => s.method === "baseline");
  if (b.length !== 1) throw new Error(`expected one baseline setup in setups.yaml, found ${b.length}`);
  return b[0].id;
}

/**
 * export.mts stamps `exportedAt` on every manifest.json. Keep the committed file when that stamp is the only
 * difference, so a rebuild from an unchanged `poc` leaves public/evals byte-identical.
 */
export function keepManifest(previous: string | null, next: string): string {
  if (previous === null) return next;
  try {
    const strip = (text: string) => {
      const { exportedAt: _ignored, ...rest } = JSON.parse(text) as Record<string, unknown>;
      void _ignored;
      return JSON.stringify(rest);
    };
    return strip(previous) === strip(next) ? previous : next;
  } catch {
    return next;
  }
}

// ── Per-split numbers (chunk 08) ──

/** One setup's row in the POC's suiteReport output (poc/src/lib/suite.ts). */
export type SetupReport = {
  key: string;
  label: string;
  model: string;
  modelLabel: string;
  method: string;
  runs: number;
  finished: number;
  failed: number;
  graded: number;
  score: number | null;
  costPerRun: number;
  msMean: number | null;
  config: { promptSet: string } | null;
  metrics: Record<Exclude<Metric, "score" | "costPerRunUsd" | "secondsPerRun">, number | null>;
};

/** suiteReport's row for one split, or null when the setup has no runs in that split; plus the runs carrying a judge panel. */
export type SplitReport = { s: SetupReport | null; panelRuns: number };

/**
 * A metric's value and the run count suiteReport averaged it over: graded runs for key-graded metrics and the
 * score, finished runs for trace checks and time, all runs for cost, runs carrying a judge panel for judgePass.
 * A split the setup never ran (a dev-only suite's test split) is null over 0 runs.
 */
export function metricOf({ s, panelRuns }: SplitReport, m: Metric): { value: number | null; runs: number } {
  if (!s) return { value: null, runs: 0 };
  if (m === "score") return { value: s.score, runs: s.graded };
  if (m === "costPerRunUsd") return { value: s.costPerRun, runs: s.runs };
  if (m === "secondsPerRun") return { value: s.msMean === null ? null : s.msMean / 1000, runs: s.finished };
  if (m === "judgePass") return { value: s.metrics[m], runs: panelRuns };
  if (m === "traceChecks") return { value: s.metrics[m], runs: s.finished };
  return { value: s.metrics[m], runs: s.graded };
}

export function runCountsOf(s: SetupReport | null): { total: number; finished: number; graded: number } {
  return s ? { total: s.runs, finished: s.finished, graded: s.graded } : { total: 0, finished: 0, graded: 0 };
}

// ── Agreement across repeats (chunk 08) ──

export type AgreementRun = {
  id: string;
  status: string;
  superseded?: boolean;
  config: { arena?: string; evalset?: string };
  items?: { document_number: string; tier: string }[];
};
export type AnswerKey = { relevant: string[]; traps: string[] | Record<string, unknown> };
type Ratio = { numerator: number; denominator: number };
export type AgreementCounts = { relevance: Ratio; tier: Ratio; runs: number };

const keyedDocs = (k: AnswerKey) => new Set([...k.relevant, ...(Array.isArray(k.traps) ? k.traps : Object.keys(k.traps))]);

/**
 * How often a setup's repeats agree with each other, per split and pooled. Runs are grouped by suite (arena)
 * and eval set; only finished, non-superseded runs count, and a group needs at least two of them (one repeat
 * has nothing to agree with).
 *  - relevance: a keyed doc (relevant ∪ traps) agrees when every repeat flags it (its document_number is in
 *    `items`) or none does.
 *  - tier: a doc flagged in every repeat agrees when every repeat gave it the same tier.
 * Throws when a run names no arena or eval set, or an eval set has no answer key.
 */
export function repeatAgreement(
  runs: AgreementRun[],
  keyOf: (evalset: string) => AnswerKey | null,
  splitOf: (evalset: string) => "dev" | "test",
): Record<"all" | "dev" | "test", AgreementCounts> {
  const groups = new Map<string, { evalset: string; runs: AgreementRun[] }>();
  for (const r of runs) {
    const { arena, evalset } = r.config;
    if (!arena || !evalset) throw new Error(`run ${r.id} has no arena or eval set`);
    if (r.status !== "done" || r.superseded) continue;
    const g = groups.get(`${arena}|${evalset}`) ?? { evalset, runs: [] };
    g.runs.push(r);
    groups.set(`${arena}|${evalset}`, g);
  }
  const zero = (): AgreementCounts => ({ relevance: { numerator: 0, denominator: 0 }, tier: { numerator: 0, denominator: 0 }, runs: 0 });
  const out = { all: zero(), dev: zero(), test: zero() };
  for (const { evalset, runs: reps } of groups.values()) {
    if (reps.length < 2) continue;
    const key = keyOf(evalset);
    if (!key) throw new Error(`no answer key for eval set ${evalset}`);
    const flags = reps.map((r) => new Map((r.items ?? []).map((i) => [i.document_number, i.tier])));
    const add = (c: AgreementCounts) => {
      c.runs += reps.length;
      for (const doc of keyedDocs(key)) {
        const n = flags.filter((f) => f.has(doc)).length;
        c.relevance.denominator++;
        if (n === 0 || n === reps.length) c.relevance.numerator++;
      }
      for (const doc of flags[0].keys()) {
        if (!flags.every((f) => f.has(doc))) continue;
        c.tier.denominator++;
        if (flags.every((f) => f.get(doc) === flags[0].get(doc))) c.tier.numerator++;
      }
    };
    add(out.all);
    add(out[splitOf(evalset)]);
  }
  return out;
}

// ── Noise band (chunk 08) ──

type AllSplitResult = { suite: string[] } & Record<Metric, { all: { value: number | null; runs: number } }>;

export type NoiseBand = {
  setup: string;
  suites: [string, string];
  measures: Record<Metric, { value: number | null; values: [number | null, number | null]; runs: [number, number] }>;
};

/**
 * The run-to-run noise of an unchanged setup: per measure, the absolute difference of its all-weeks value
 * between two suites that ran it with identical config. Null when the setup is missing from either suite;
 * a measure either suite could not measure has a null value.
 */
export function noiseBand(setup: string, a: AllSplitResult | null, b: AllSplitResult | null): NoiseBand | null {
  if (!a || !b) return null;
  const measures = Object.fromEntries(
    METRICS.map((m) => {
      const [x, y] = [a[m].all, b[m].all];
      const value = x.value === null || y.value === null ? null : Number(Math.abs(x.value - y.value).toFixed(6));
      return [m, { value, values: [x.value, y.value], runs: [x.runs, y.runs] }];
    }),
  ) as NoiseBand["measures"];
  return { setup, suites: [a.suite[0], b.suite[0]], measures };
}

/** Rules that matter (relevant) and look-alikes (traps), summed over the answer keys. */
export function keyTotals(keys: AnswerKey[]): { relevant: number; traps: number } {
  return keys.reduce(
    (t, k) => ({ relevant: t.relevant + k.relevant.length, traps: t.traps + (Array.isArray(k.traps) ? k.traps.length : Object.keys(k.traps).length) }),
    { relevant: 0, traps: 0 },
  );
}
