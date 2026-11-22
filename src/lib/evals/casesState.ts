/**
 * What the Cases page shows (chunk 09), decided outside the component so every state is testable:
 * which iteration — or, from the Models page (chunk 10), which suite and setup — a URL means, its empty states,
 * the case rows (a throw becomes a message), the filter choices and the selected row. CasesView only renders
 * the result.
 */
import { iterationRuns } from "./bundle-build";
import { caseCounts, casesForIteration, liveIterationId, type CaseFilter, type CaseKey, type CaseRow, type CaseRun } from "./cases";
import type { EvalIndex } from "./index-schema";
import { iterationNumber, shortSuite } from "./story";

export type CasesPageState =
  /** No such iteration (or no ?iteration= and no iteration ran the live setup). */
  | { kind: "unknown"; requested: string | null }
  /** An evidence-only iteration (07-next): nothing was run, so there are no cases. */
  | { kind: "evidenceOnly"; id: string; no: string }
  /** A recorded iteration missing its setup or suite, or naming a suite the bundle lacks: shown instead of crashing. */
  | { kind: "error"; message: string }
  /** `comparedTo` is null for the reference point (00), which is shown on its own. */
  | { kind: "iteration"; id: string; no: string; setup: string; comparedTo: string | null; suite: string; title: string }
  /** `?suite=&setup=` (the Models page's drill-down): one setup's cases in one suite, compared with nothing. */
  | { kind: "setup"; setup: string; comparedTo: null; suite: string; title: string }
  /** `?suite=` names a suite the bundle lacks. */
  | { kind: "unknownSuite"; suite: string }
  /** `?suite=` without `?setup=`, or with a setup that suite did not run: pick one of the setups it ran. */
  | { kind: "unknownSetup"; suite: string; setup: string | null; setups: string[] };

/** The state, plus a sentence when part of the URL was ignored (`?iteration=` wins; `?setup=` needs `?suite=`). */
export type CasesPageView = CasesPageState & { note?: string };

/** The Cases page's search params. A param given more than once, or empty, is ignored rather than guessed at. */
export type CasesQuery = { iteration: string | null; suite: string | null; setup: string | null };
export function casesQuery(params: Record<string, string | string[] | undefined>): CasesQuery {
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
  return { iteration: one(params.iteration), suite: one(params.suite), setup: one(params.setup) };
}

/**
 * Precedence: `?iteration=` wins over `?suite=`/`?setup=` (with a note); else `?suite=` picks a suite and
 * `?setup=` one of its setups; `?setup=` alone is ignored (with a note); else the live iteration.
 */
export function casesPageState(
  index: Pick<EvalIndex, "iterations" | "live" | "suites">,
  requested: string | null,
  pick: Pick<CasesQuery, "suite" | "setup"> = { suite: null, setup: null },
): CasesPageView {
  if (requested && (pick.suite || pick.setup)) {
    const st = iterationState(index, requested);
    const precedence = "?iteration= takes precedence over ?suite= and ?setup=";
    return { ...st, note: st.kind === "unknown" ? `${precedence}, so they were ignored.` : `Showing iteration ${iterationNumber(requested)}: ${precedence}.` };
  }
  if (pick.suite) {
    const suite = index.suites.find((s) => s.id === pick.suite);
    if (!suite) return { kind: "unknownSuite", suite: pick.suite };
    const setups = suite.setups.map((s) => s.key);
    if (!pick.setup || !setups.includes(pick.setup)) return { kind: "unknownSetup", suite: suite.id, setup: pick.setup, setups };
    return { kind: "setup", setup: pick.setup, comparedTo: null, suite: suite.id, title: `Cases for ${pick.setup} in ${shortSuite(suite.id)}` };
  }
  const st = iterationState(index, requested);
  return pick.setup ? { ...st, note: "?setup= needs a ?suite=, so it was ignored." } : st;
}

/** The iteration `?iteration=` names, or the live one when it names none. */
function iterationState(index: Pick<EvalIndex, "iterations" | "live" | "suites">, requested: string | null): CasesPageState {
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
  st: { setup: string; comparedTo: string | null },
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
