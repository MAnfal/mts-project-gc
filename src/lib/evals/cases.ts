/**
 * Per-case results for the Cases page (chunk 09): one row per (eval set, keyed doc), with how many finished
 * repeats of each setup flagged it. Pure; reads only run records and answer keys.
 *
 * Grading follows the POC's grade.ts (subset grading): only docs the answer key labels are graded. A flag on a
 * `relevant` doc is a hit (tp), a flag on a trap is a trap hit; a flag outside the key is counted as
 * `unlabeled` and never penalised. Per-case sums reproduce each suite's report.json counts (cases.test.ts).
 */
import { keyedDocs, trapIds, type AnswerKey } from "./bundle-build";
import type { EvalIndex } from "./index-schema";

/** An answer key as shipped: details carry the kind and the reason for each relevant doc; v2 traps carry a reason. */
export type CaseKey = AnswerKey & {
  details?: Record<string, { kind?: "direct" | "indirect"; reason?: string }>;
  traps: string[] | Record<string, { reason?: string }>;
};

/** The run-record fields this module reads (POC SCHEMA.md `RunRecord`). Failed runs have no `items`. */
export type CaseRun = {
  id: string;
  status: string;
  superseded?: boolean;
  config: { cell?: string; evalset?: string; repeatIndex?: number };
  items?: { document_number: string }[] | null;
};

/** One repeat of a setup on an eval set. `hit` is null for a repeat that did not finish. */
export type Repeat = { id: string; repeat: number; status: string; hit: boolean | null };
/** A setup's result on one case: `hits` of `finished` repeats flagged it; `repeats` lists every repeat, failed ones too. */
export type Tally = { hits: number; finished: number; repeats: Repeat[] };

export type CaseRow = {
  /** `<evalset>:<doc>` */
  id: string;
  evalset: string;
  doc: string;
  /** flag = a relevant doc; skip = a trap. */
  expected: "flag" | "skip";
  kind: "direct" | "indirect" | "trap";
  /** The answer key's reason, when it records one. */
  reason: string | null;
  /** The iteration's setup. */
  after: Tally;
  /** The setup it was compared to; null when the iteration has none (the 00 reference point). */
  before: Tally | null;
  /** Whether the hit rate moved the right way (fixed) or the wrong way (regressed); null when unchanged or not comparable. */
  change: "fixed" | "regressed" | null;
};

const done = (r: CaseRun) => r.status === "done";
const evalsetOf = (r: CaseRun) => {
  if (!r.config.evalset) throw new Error(`run ${r.id} has no eval set`);
  return r.config.evalset;
};

/**
 * Subset grading: the flags a run is graded on are its flags on docs the key labels. Flags outside the key are
 * not graded (the POC counts them as `unlabeled` and leaves precision alone).
 */
export function gradedFlags(run: CaseRun, key: AnswerKey): Set<string> {
  const keyed = keyedDocs(key);
  return new Set((run.items ?? []).map((i) => i.document_number).filter((d) => keyed.has(d)));
}

/** Runs of one setup on one eval set, in repeat order (callers have already left superseded runs out). */
function repeatsOf(runs: CaseRun[], setup: string, evalset: string): CaseRun[] {
  return runs
    .filter((r) => r.config.cell === setup && evalsetOf(r) === evalset)
    .sort((a, b) => (a.config.repeatIndex ?? 0) - (b.config.repeatIndex ?? 0));
}

function tally(reps: CaseRun[], flags: Map<string, Set<string>>, doc: string): Tally {
  const repeats = reps.map((r) => ({ id: r.id, repeat: r.config.repeatIndex ?? 0, status: r.status, hit: done(r) ? flags.get(r.id)!.has(doc) : null }));
  return { hits: repeats.filter((x) => x.hit).length, finished: repeats.filter((x) => x.hit !== null).length, repeats };
}

/** "3/3", or "—" when no repeat finished (never "0/0" or a made-up "0/3"). */
export const formatTally = (t: Tally) => (t.finished ? `${t.hits}/${t.finished}` : "—");

/**
 * Compares hit rates (hits / finished) by cross-multiplying. A side with no finished repeat has 0 hits, so the
 * product is 0 and the case reads as unchanged, never as Fixed or Regressed.
 */
function rateOrder(a: Tally, b: Tally): -1 | 0 | 1 {
  const d = a.hits * b.finished - b.hits * a.finished;
  return d === 0 ? 0 : d > 0 ? 1 : -1;
}

/**
 * Every keyed doc of every eval set the iteration's setups ran in this suite, with each setup's tally.
 * A case changed when its hit rate differs between the two setups (2/2 vs 3/3 is no change). For a Flag row a
 * higher rate is Fixed; for a Skip row, where a hit means the trap was flagged, a lower rate is Fixed.
 * Throws when a run names no eval set or an eval set has no answer key.
 */
export function casesForIteration(runs: CaseRun[], it: { setup: string; comparedTo: string | null }, keys: Record<string, CaseKey>): CaseRow[] {
  const setups = [it.setup, ...(it.comparedTo ? [it.comparedTo] : [])];
  const mine = runs.filter((r) => !r.superseded && setups.includes(r.config.cell ?? ""));
  const evalsets = [...new Set(mine.map(evalsetOf))].sort();
  const rows: CaseRow[] = [];
  for (const evalset of evalsets) {
    const key = keys[evalset];
    if (!key) throw new Error(`no answer key for eval set ${evalset}`);
    const after = repeatsOf(mine, it.setup, evalset);
    const before = it.comparedTo ? repeatsOf(mine, it.comparedTo, evalset) : null;
    const flags = new Map([...after, ...(before ?? [])].filter(done).map((r) => [r.id, gradedFlags(r, key)]));
    const traps = Array.isArray(key.traps) ? null : key.traps;
    const docs: [string, "flag" | "skip"][] = [...key.relevant.map((d) => [d, "flag"] as [string, "flag"]), ...trapIds(key).map((d) => [d, "skip"] as [string, "skip"])];
    for (const [doc, expected] of docs) {
      const a = tally(after, flags, doc);
      const b = before ? tally(before, flags, doc) : null;
      const order = b ? rateOrder(a, b) : null;
      const better = expected === "flag" ? 1 : -1;
      rows.push({
        id: `${evalset}:${doc}`,
        evalset,
        doc,
        expected,
        kind: expected === "skip" ? "trap" : (key.details?.[doc]?.kind ?? "direct"),
        reason: (expected === "flag" ? key.details?.[doc]?.reason : traps?.[doc]?.reason) ?? null,
        after: a,
        before: b,
        change: !order ? null : order === better ? "fixed" : "regressed",
      });
    }
  }
  return rows;
}

/** The Cases page's filters, at most four visible choices. */
export const CASE_FILTERS = ["changed", "stillMissed", "trapsFlagged", "all"] as const;
export type CaseFilter = (typeof CASE_FILTERS)[number];

const MATCH: Record<CaseFilter, (r: CaseRow) => boolean> = {
  /** The hit rate differs between the iteration's setup and the one it replaced. */
  changed: (r) => r.change !== null,
  /** A doc that should be flagged, missed by at least one finished repeat of the iteration's setup. */
  stillMissed: (r) => r.expected === "flag" && r.after.hits < r.after.finished,
  /** A trap the iteration's setup flagged in at least one repeat. */
  trapsFlagged: (r) => r.expected === "skip" && r.after.hits > 0,
  all: () => true,
};

export const filterCases = (rows: CaseRow[], f: CaseFilter) => rows.filter(MATCH[f]);
export const caseCounts = (rows: CaseRow[]) => Object.fromEntries(CASE_FILTERS.map((f) => [f, filterCases(rows, f).length])) as Record<CaseFilter, number>;

/**
 * One setup's totals over a suite's runs, graded like the POC's grade.ts + suiteReport: finished, non-superseded
 * runs only; recall = tp / (tp + fn); precision = tp / (tp + trap hits). Unlabeled flags are counted, not penalised.
 */
export function setupTotals(runs: CaseRun[], setup: string, keys: Record<string, CaseKey>) {
  const t = { runs: 0, tp: 0, fn: 0, trapHit: 0, tn: 0, unlabeled: 0 };
  for (const r of runs) {
    if (r.superseded || r.config.cell !== setup || !done(r)) continue;
    const evalset = evalsetOf(r);
    const key = keys[evalset];
    if (!key) throw new Error(`no answer key for eval set ${evalset}`);
    const graded = gradedFlags(r, key);
    const relevant = new Set(key.relevant);
    const keyed = keyedDocs(key);
    t.runs++;
    t.tp += key.relevant.filter((d) => graded.has(d)).length;
    t.fn += key.relevant.filter((d) => !graded.has(d)).length;
    t.trapHit += [...graded].filter((d) => !relevant.has(d)).length;
    t.tn += trapIds(key).filter((d) => !graded.has(d)).length;
    t.unlabeled += (r.items ?? []).filter((i) => !keyed.has(i.document_number)).length;
  }
  const ratio = (a: number, b: number) => (b ? a / b : null);
  return { ...t, recall: ratio(t.tp, t.tp + t.fn), precision: ratio(t.tp, t.tp + t.trapHit) };
}

/** The iteration that ran the live setup last (the one the summary calls live), or null if none did. */
export const liveIterationId = (index: Pick<EvalIndex, "live" | "iterations">): string | null =>
  index.iterations.findLast((i) => i.setup === index.live.setup)?.id ?? null;

/** How a split reads on the eval pages. */
export const SPLIT_WORD: Record<"dev" | "test", string> = { dev: "tuning", test: "held out" };
