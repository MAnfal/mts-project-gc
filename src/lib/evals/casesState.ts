/**
 * What the Cases page shows (chunk 09), decided outside the component so every state is testable:
 * which iteration a URL means, its empty states, the case rows (a throw becomes a message), the filter
 * choices and the selected row. CasesView only renders the result.
 */
import { iterationRuns } from "./bundle-build";
import { caseCounts, casesForIteration, liveIterationId, type CaseFilter, type CaseKey, type CaseRow, type CaseRun } from "./cases";
import type { EvalIndex } from "./index-schema";
import { iterationNumber } from "./story";

export type CasesPageState =
  /** No such iteration (or no ?iteration= and no iteration ran the live setup). */
  | { kind: "unknown"; requested: string | null }
  /** An evidence-only iteration (07-next): nothing was run, so there are no cases. */
  | { kind: "evidenceOnly"; id: string; no: string }
  /** A recorded iteration missing its setup or suite, or naming a suite the bundle lacks: shown instead of crashing. */
  | { kind: "error"; message: string }
  /** `comparedTo` is null for the reference point (00), which is shown on its own. */
  | { kind: "iteration"; id: string; no: string; setup: string; comparedTo: string | null; suite: string; title: string };

/** The iteration `?iteration=` names, or the live one when it names none. */
export function casesPageState(index: Pick<EvalIndex, "iterations" | "live" | "suites">, requested: string | null): CasesPageState {
  const id = requested ?? liveIterationId(index);
  const it = id ? index.iterations.find((i) => i.id === id) : undefined;
  if (!it) return { kind: "unknown", requested };
  const no = iterationNumber(it.id);
  let runs: ReturnType<typeof iterationRuns>;
  try {
    runs = iterationRuns(it);
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
  if (!runs) return { kind: "evidenceOnly", id: it.id, no };
  if (!index.suites.some((s) => s.id === runs.suite)) return { kind: "error", message: `iteration ${it.id} names suite ${runs.suite}, which is not in the bundle` };
  return {
    kind: "iteration",
    id: it.id,
    no,
    ...runs,
    title: runs.comparedTo ? `Cases that changed in ${no}` : `Cases in ${no}`,
  };
}

/** The case rows once the suite's runs and keys have loaded; casesForIteration's throw becomes `error`. */
export function computeCases(
  st: Extract<CasesPageState, { kind: "iteration" }>,
  data: { runs: CaseRun[]; keys: Record<string, CaseKey> } | null,
): { rows: CaseRow[] | null; error: string | null } {
  if (!data) return { rows: null, error: null };
  try {
    return { rows: casesForIteration(data.runs, { setup: st.setup, comparedTo: st.comparedTo }, data.keys), error: null };
  } catch (e) {
    return { rows: null, error: (e as Error).message };
  }
}

export type FilterChoice = { id: CaseFilter; label: string; count: number };

/** The filter buttons with their counts; "Changed in NN" only when there is a setup to compare with. */
export function filterChoices(rows: CaseRow[], no: string, compared: boolean): FilterChoice[] {
  const counts = caseCounts(rows);
  return [
    ...(compared ? [{ id: "changed" as const, label: `Changed in ${no}`, count: counts.changed }] : []),
    { id: "stillMissed", label: "Still missed", count: counts.stillMissed },
    { id: "trapsFlagged", label: "Traps flagged", count: counts.trapsFlagged },
    { id: "all", label: "All", count: counts.all },
  ];
}

/** The picked filter if it is offered, else the first choice. */
export const activeFilter = (picked: CaseFilter | null, choices: FilterChoice[]): CaseFilter =>
  picked && choices.some((c) => c.id === picked) ? picked : choices[0].id;

/** The picked row while it is shown, else the first shown row, else null. */
export const selectedRow = <R extends { id: string }>(shown: R[], picked: string | null): R | null => shown.find((r) => r.id === picked) ?? shown[0] ?? null;
