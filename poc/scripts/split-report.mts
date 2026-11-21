// Recall / precision per split (dev vs held-out test) for each setup in a suite.
//   npx tsx scripts/split-report.mts <arenaId>
import { arenaRuns } from "../src/lib/arena";
import { evalsets, getCompany, loadKey, pipelineCfg } from "../src/lib/config";
import { aggregate, gradeRun } from "../src/lib/grade";
const runs = (await arenaRuns(process.argv[2])).filter((r) => r.status === "done");
const split = new Map(evalsets().map((e) => [e.id, e.split]));
const cells = [...new Set(runs.map((r) => r.config.cell!))];
for (const c of cells)
  for (const s of ["dev", "test"]) {
    const g = runs.filter((r) => r.config.cell === c && split.get(r.config.evalset!) === s).map((r) => gradeRun(r, loadKey(r.config.profileId, r.config.windowStart, r.config.windowEnd)!, getCompany(r.config.profileId), pipelineCfg().tiering));
    const a = aggregate(g);
    const p = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
    console.log(`${c.padEnd(24)} ${s.padEnd(4)} runs ${String(g.length).padStart(2)}  recall ${p(a.recall)} (${a.counts.tp}/${a.counts.tp + a.counts.fn})  precision ${p(a.precision)}  trapHits ${a.counts.trapHit} extras ${a.counts.unlabeled}`);
  }
