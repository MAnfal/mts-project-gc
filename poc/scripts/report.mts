// Prints the suite report for an arena (the numbers behind the dashboard).
//   npx tsx scripts/report.mts <arenaId>
import { arenaRuns } from "../src/lib/arena";
import { suiteReport } from "../src/lib/suite";
const rep = suiteReport(await arenaRuns(process.argv[2]));
const f = (v: number | null) => (v === null ? "  —" : `${Math.round(v * 100)}%`.padStart(4));
for (const s of rep.setups)
  console.log(
    `${s.label.padEnd(32)} score ${f(s.score)} | ${Object.entries(s.metrics).map(([k, v]) => `${k} ${f(v)}`).join(" · ")} | ${JSON.stringify(s.counts)} | contested ${f(s.panel.contested)} | $${s.costUsd.toFixed(2)} ${s.msMean ? Math.round(s.msMean / 1000) : "—"}s`,
  );
console.log(`total ${rep.totals.runs} runs $${rep.totals.costUsd.toFixed(2)}`);
