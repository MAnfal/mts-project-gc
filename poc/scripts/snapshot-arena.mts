// Prints every cell's scoreboard summary for an arena as JSON (used to prove refactors change nothing).
import { allCells, arenaRuns } from "../src/lib/arena";
import { summarizeCell } from "../src/lib/score";
import { loadLabels } from "../src/lib/store";
const runs = await arenaRuns(process.argv[2]);
const c = runs[0].config;
const key = (await loadLabels(c.profileId, c.windowStart, c.windowEnd))!;
const out = Object.fromEntries(allCells().map((cell) => [cell.key, summarizeCell(runs.filter((r) => r.config.cell === cell.key), key)]));
console.log(JSON.stringify(out, null, 1));
