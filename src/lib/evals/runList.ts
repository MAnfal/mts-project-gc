/**
 * The Runs page's rows (chunk 09). Every run id comes from the suite's trace-checks.json, which lists every run
 * (cheap: about 100 KB a suite), so each row's trace link renders at once. The setup · eval set · repeat label
 * comes from runs.jsonl.gz (megabytes a suite), loaded afterwards; until then the label is null.
 */
import type { TraceCheck } from "./loader";

/** The run-record fields a label needs (POC SCHEMA.md `RunRecord`). */
export type LabelledRun = { id: string; status: string; superseded?: boolean; config: { cell?: string; evalset?: string; repeatIndex?: number } };
export type RunLabel = { setup: string; evalset: string; repeat: number; status: string; superseded: boolean };

/** What one run was: its setup, eval set, repeat and status. Throws naming the run when the record lacks them. */
export function runLabel(r: LabelledRun): RunLabel {
  const { cell, evalset, repeatIndex } = r.config;
  if (!cell || !evalset) throw new Error(`run ${r.id} records no setup or eval set`);
  return { setup: cell, evalset, repeat: repeatIndex ?? 0, status: r.status, superseded: !!r.superseded };
}

export type CheckSummary = { passed: number; total: number; failing: TraceCheck[] };

/** How many of a run's trace checks passed, and which failed; null when none were recorded. */
export function checkSummary(checks: TraceCheck[] | null | undefined): CheckSummary | null {
  if (!checks) return null;
  return { passed: checks.filter((c) => c.pass).length, total: checks.length, failing: checks.filter((c) => !c.pass) };
}

export type RunRow = { id: string; checks: CheckSummary; label: RunLabel | null };

/** One row per run in trace-checks order, labelled from `labels` once the suite's runs have loaded. */
export function suiteRunRows(checks: Record<string, TraceCheck[]>, labels: ReadonlyMap<string, RunLabel> | null): RunRow[] {
  return Object.entries(checks).map(([id, c]) => ({ id, checks: checkSummary(c)!, label: labels?.get(id) ?? null }));
}
