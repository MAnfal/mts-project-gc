/**
 * The Runs page's rows (chunk 09). Every run comes from its suite's runs-index.json (or user-view's), a few KB
 * written by the bundle build; each row gets its trace-check summary from trace-checks.json when one exists.
 * runs.jsonl.gz (megabytes a suite) is never needed.
 */
import type { RunsIndex } from "./index-schema";
import type { TraceCheck } from "./loader";

export type CheckSummary = { passed: number; total: number; failing: TraceCheck[] };

/** How many of a run's trace checks passed, and which failed; null when none were recorded. */
export function checkSummary(checks: TraceCheck[] | null | undefined): CheckSummary | null {
  if (!checks) return null;
  return { passed: checks.filter((c) => c.pass).length, total: checks.length, failing: checks.filter((c) => !c.pass) };
}

export type RunRow = { run: RunsIndex[number]; checks: CheckSummary | null };

/** One row per listed run, in listing order; `checks` is null for a run with no recorded trace checks. */
export function runRows(listing: RunsIndex, checks: Record<string, TraceCheck[]> | null): RunRow[] {
  return listing.map((run) => ({ run, checks: checkSummary(checks?.[run.runId]) }));
}

/** The eval set a run's company and window belong to, or null (an example run's company-week usually isn't one). */
export function evalsetOfRun(run: RunsIndex[number], evalsets: Record<string, { company: string; weekId: string }>): string | null {
  const week = `${run.window.start}_${run.window.end}`;
  return Object.entries(evalsets).find(([, e]) => e.company === run.profileId && e.weekId === week)?.[0] ?? null;
}
