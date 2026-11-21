// Per-step scores (Jev → LLM filter → verify) for each setup in a suite, split dev / test. Free: reads saved runs.
//   npx tsx scripts/step-report.mts <arenaId>
import { arenaRuns } from "../src/lib/arena";
import { evalsets, loadKey } from "../src/lib/config";
import { aggregateSteps, formatSteps, stepGrade } from "../src/lib/grade";

const runs = (await arenaRuns(process.argv[2])).filter((r) => r.status === "done");
const split = new Map(evalsets().map((e) => [e.id, e.split]));
for (const c of [...new Set(runs.map((r) => r.config.cell!))])
  for (const s of ["dev", "test"]) {
    const g = runs.filter((r) => r.config.cell === c && split.get(r.config.evalset!) === s).map((r) => stepGrade(r, loadKey(r.config.profileId, r.config.windowStart, r.config.windowEnd)!));
    if (!g.length) continue;
    console.log(`${c} · ${s} · ${g.length} runs`);
    for (const l of formatSteps(aggregateSteps(g))) console.log(l);
  }
