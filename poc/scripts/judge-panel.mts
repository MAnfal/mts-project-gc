// (Re-)judge finished runs with the panel in config/judges.yaml, without re-running the pipeline.
// Only runs whose stored verdicts came from a different panel config are re-judged (unless --force).
//   npx tsx scripts/judge-panel.mts <arenaId> [--limit N] [--force]
import { arenaRuns } from "../src/lib/arena";
import { judgePanel, panelHash } from "../src/lib/panel";
import { archiveSpend, budgetUsd, saveRun, spentUsd } from "../src/lib/store";

const args = process.argv.slice(2);
const force = args.includes("--force");
const li = args.indexOf("--limit");
const limit = li >= 0 ? Number(args[li + 1]) : Infinity;
const arena = args.find((a) => !a.startsWith("--") && a !== String(limit));
if (!arena) throw new Error("usage: judge-panel.mts <arenaId> [--limit N] [--force]");

const hash = panelHash();
// Same policy as the suite: the panel judges the first repeat of each (setup, eval set) only.
const todo = (await arenaRuns(arena)).filter((r) => r.status === "done" && !r.config.repeatIndex && (force || r.panel?.panelHash !== hash)).slice(0, limit);
console.log(`${todo.length} runs to judge (panel ${hash})`);
for (const r of todo) {
  if ((await spentUsd()) >= budgetUsd()) throw new Error("budget cap reached");
  // The new verdicts replace the old ones on the run record; keep the old judging's real spend in the ledger.
  if (r.panel?.costUsd) await archiveSpend({ reason: `re-judge ${r.id}: replaced panel ${r.panel.panelHash}`, runs: 0, usd: r.panel.costUsd });
  r.panel = await judgePanel(r);
  await saveRun(r);
  const errs = r.panel.judges.filter((j) => j.error).map((j) => `${j.model}: ${j.error}`);
  const c = r.panel.verdicts.reduce((a, v) => ((a[v.verdict] = (a[v.verdict] ?? 0) + 1), a), {} as Record<string, number>);
  console.log(r.config.cell, JSON.stringify(c), `$${r.panel.costUsd.toFixed(3)}`, errs.length ? `ERRORS ${errs.join(" | ")}` : "");
}
