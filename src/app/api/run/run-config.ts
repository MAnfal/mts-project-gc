import "server-only";
import { experiment, setups } from "@/lib/config";
import type { RunRequest } from "@/lib/runs/types";
import type { RunConfig } from "@/lib/types";

/**
 * The RunConfig a live run executes: the evaluated setup named by experiment.yaml → userView.setup, on the GC's
 * window and profile. Ported from the POC's api/try + arena.ts cellConfig (poc:poc/src/lib/arena.ts): the method
 * fields and their fallbacks are its expressions unchanged, so a live run decides exactly as the evaluated runs did.
 * Not carried over: group/arena/cell, which only label eval-suite runs.
 *
 * Server-only. The result names the model, so it is never sent to the browser or stored there.
 */
export function buildRunConfig(request: RunRequest): RunConfig {
  const id = experiment().userView.setup;
  const { setups: all, methods } = setups();
  const cell = all.find((s) => s.id === id);
  if (!cell) throw new Error(`experiment.yaml userView.setup "${id}" is not a setup in setups.yaml`);
  const m = methods.find((x) => x.id === cell.method);
  if (!m) throw new Error(`setups.yaml: setup "${cell.id}" uses method "${cell.method}", which is not listed under methods`);
  if (m.mode !== "pipeline") throw new Error(`experiment.yaml userView.setup "${id}" is not a pipeline setup`);
  const jev = methods.find((x) => x.id === "jev+llm");
  const custom = "customProfile" in request ? request.customProfile : undefined;
  return {
    profileId: "profileId" in request ? request.profileId : "custom",
    windowStart: request.windowStart,
    windowEnd: request.windowEnd,
    // The tiering clock: deadlines are counted from the end of the window, never from today.
    asOf: request.windowEnd,
    mode: m.mode,
    model: cell.model,
    filter: m.filter ?? jev?.filter ?? "jev+llm",
    jevThreshold: m.jevThreshold ?? jev?.jevThreshold ?? 0.1,
    webLeads: m.webLeads ?? false,
    ...(cell.promptSet ? { promptSet: cell.promptSet } : {}),
    ...(cell.filterVotes && cell.filterVotes > 1 ? { filterVotes: cell.filterVotes } : {}),
    ...(cell.filterExcerpts ? { filterExcerpts: cell.filterExcerpts } : {}),
    ...(custom ? { customProfile: custom } : {}),
  };
}
