// Run the eval suite: every eval set × every setup (config/setups.yaml → setups) × repeat, in waves.
// Runs from tsx (not the dev server) so it always executes the current code and config.
//   npx tsx scripts/suite.mts                         # all eval sets, all setups, repeat = 3
//   npx tsx scripts/suite.mts --evalsets skyhop_2026-11-09_2026-11-13 --repeat 1   # pilot one company-week
//   npx tsx scripts/suite.mts --setups jev-sonnet,baseline-sonnet
import { parseArgs } from "node:util";
import { startArena, suiteCells } from "../src/lib/arena";
import { evalsets, pinConfig } from "../src/lib/config";

// Freeze config for the whole suite: editing config/ while it runs can't change or crash it.
pinConfig();
const { values: a } = parseArgs({ options: { evalsets: { type: "string" }, setups: { type: "string" }, repeat: { type: "string", default: "3" } } });
const evalsetIds = a.evalsets ? a.evalsets.split(",") : evalsets().map((e) => e.id);
const cellKeys = a.setups ? a.setups.split(",") : suiteCells().map((c) => c.key);
const { arena, runIds, estimateUsd, go } = await startArena({ evalsetIds, cellKeys, repeat: Number(a.repeat) });
console.log(`${arena}: ${runIds.length} runs (${evalsetIds.length} eval sets × ${cellKeys.length} setups × ${a.repeat}), est $${estimateUsd.toFixed(2)}`);
console.log(`watch: http://localhost:3457/arena/${arena}`);
const t0 = Date.now();
await go();
const { compactTraces } = await import("../src/lib/trace");
console.log(`compacted ${compactTraces()} traces`);
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
