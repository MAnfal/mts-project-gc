// Re-run some cells of an existing arena with fresh code (e.g. after a cell failed).
// Superseded runs are kept (their spend is real) but marked so the scoreboard shows them as failed.
// Usage: tsx scripts/arena-rerun.mts <arenaId> <cellKey> [cellKey...] [--supersede-reason "..."]
import { judgeClarity } from "../src/lib/judge";
import { execute, newRun } from "../src/lib/pipeline/run";
import { listRuns, saveRun } from "../src/lib/store";

const args = process.argv.slice(2);
const ri = args.indexOf("--supersede-reason");
const reason = ri >= 0 ? args.splice(ri, 2)[1] : null;
const [arena, ...cells] = args;
const runs = (await listRuns()).filter((r) => r.config.arena === arena && cells.includes(r.config.cell!));
if (!runs.length) throw new Error("no matching runs");

const fresh = [];
for (const cell of cells) {
  const old = runs.filter((r) => r.config.cell === cell);
  for (const o of old) {
    if (reason && o.status === "done") {
      o.status = "error";
      o.error = `Superseded: ${reason}`;
      await saveRun(o);
    }
  }
  fresh.push(newRun({ ...old[0].config }));
}
await Promise.all(fresh.map(saveRun));
await Promise.all(
  fresh.map(async (r) => {
    await execute(r);
    if (r.status === "done") {
      r.judge = await judgeClarity(r);
      await saveRun(r);
    }
    console.log(r.config.cell, r.status, r.items?.length ?? 0, `$${r.totalCostUsd.toFixed(3)}`, `${Math.round(r.totalMs / 1000)}s`, r.error ?? "");
  }),
);
