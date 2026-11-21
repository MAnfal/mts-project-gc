import { judgeClarity } from "./judge";
import { ARENA_MODELS, modelLabel } from "./models";
import { execute, newRun } from "./pipeline/run";
import { BUDGET_USD, listRuns, saveRun, spentUsd } from "./store";
import type { RunConfig, RunRecord } from "./types";

/** An arena cell = one config. The facade is RunConfig; cells just name a point in the model × method grid. */
export interface Cell {
  key: string;
  label: string;
  model: string;
  method: "jev+llm" | "llm" | "baseline";
  /** Rough $/run used for the pre-flight budget check (measured on Sonnet 5.5; reasoning models may differ). */
  estUsd: number;
}

export const METHODS: { id: Cell["method"]; label: string; estUsd: number }[] = [
  { id: "jev+llm", label: "Pipeline · Jev filter → LLM", estUsd: 0.2 },
  { id: "llm", label: "Pipeline · LLM filter only", estUsd: 0.4 },
  { id: "baseline", label: "Baseline · 1 prompt + web search", estUsd: 0.6 },
];

export const ALL_CELLS: Cell[] = METHODS.flatMap((m) =>
  ARENA_MODELS.map((x) => ({ key: `${m.id}:${x.id}`, label: `${modelLabel(x.id)} · ${m.label}`, model: x.id, method: m.id, estUsd: m.estUsd })),
);

export const cellByKey = (k: string) => ALL_CELLS.find((c) => c.key === k);

export const JEV_THRESHOLD = 0.1;
const CONCURRENCY = 4;

export function cellConfig(cell: Cell, base: { profileId: string; windowStart: string; windowEnd: string; asOf: string }, arena: string): RunConfig {
  return {
    ...base,
    mode: cell.method === "baseline" ? "baseline" : "pipeline",
    model: cell.model,
    filter: cell.method === "llm" ? "llm" : "jev+llm",
    jevThreshold: JEV_THRESHOLD,
    webLeads: false, // measured redundant for federal scope in the pilot (24 URLs → 0 new docs)
    group: `${arena}:${cell.key}`,
    arena,
    cell: cell.key,
  };
}

export function estimate(cells: Cell[], repeat: number) {
  return cells.reduce((a, c) => a + c.estUsd, 0) * repeat;
}

/**
 * Creates every run up front (so the page shows all cells immediately), then executes in waves of
 * CONCURRENCY. Each run snapshots spend at start and can't see siblings, so the budget is re-checked
 * between waves using the worst-case estimate of the next wave.
 */
export async function startArena(args: { profileId: string; windowStart: string; windowEnd: string; asOf: string; cellKeys: string[]; repeat: number }) {
  const cells = args.cellKeys.map(cellByKey).filter((c): c is Cell => !!c);
  const est = estimate(cells, args.repeat);
  const spent = await spentUsd();
  if (spent + est > BUDGET_USD) throw new Error(`Estimated $${est.toFixed(2)} would exceed the budget ($${spent.toFixed(2)} of $${BUDGET_USD} spent)`);

  const arena = `arena-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${Math.random().toString(36).slice(2, 5)}`;
  const runs: { run: RunRecord; cell: Cell }[] = [];
  for (let i = 0; i < args.repeat; i++) for (const cell of cells) runs.push({ run: newRun(cellConfig(cell, args, arena)), cell });
  await Promise.all(runs.map((r) => saveRun(r.run)));

  const go = async () => {
    for (let i = 0; i < runs.length; i += CONCURRENCY) {
      const wave = runs.slice(i, i + CONCURRENCY);
      const waveEst = wave.reduce((a, w) => a + w.cell.estUsd, 0);
      if ((await spentUsd()) + waveEst > BUDGET_USD) {
        for (const w of runs.slice(i)) {
          w.run.status = "error";
          w.run.error = "Skipped: budget cap would be exceeded";
          await saveRun(w.run);
        }
        return;
      }
      await Promise.all(
        wave.map(async (w) => {
          await execute(w.run);
          if (w.run.status === "done") {
            w.run.judge = await judgeClarity(w.run);
            await saveRun(w.run);
          }
        }),
      );
    }
  };
  return { arena, runIds: runs.map((r) => r.run.id), estimateUsd: est, go };
}

export async function arenaRuns(arena: string) {
  return (await listRuns()).filter((r) => r.config.arena === arena);
}

export async function listArenas() {
  const runs = (await listRuns()).filter((r) => r.config.arena);
  const by = new Map<string, RunRecord[]>();
  for (const r of runs) by.set(r.config.arena!, [...(by.get(r.config.arena!) ?? []), r]);
  return [...by.entries()]
    .map(([id, rs]) => ({
      id,
      createdAt: rs.map((r) => r.createdAt).sort()[0],
      profileId: rs[0].config.profileId,
      windowStart: rs[0].config.windowStart,
      windowEnd: rs[0].config.windowEnd,
      runs: rs.length,
      running: rs.filter((r) => r.status === "running").length,
      costUsd: rs.reduce((a, r) => a + r.totalCostUsd + (r.judge?.costUsd ?? 0), 0),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
