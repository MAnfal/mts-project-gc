// Delete all user-view runs (e.g. after changing userView.setup), archiving their spend in the ledger first.
import fs from "node:fs";
import path from "node:path";
import { DATA } from "../src/lib/paths";
import { archiveSpend, listRuns, runCostUsd } from "../src/lib/store";
const uv = (await listRuns()).filter((r) => r.config.group === "user-view");
const usd = uv.reduce((a, r) => a + runCostUsd(r), 0);
await archiveSpend({ reason: `reset user view: deleted ${uv.length} runs`, runs: uv.length, usd });
fs.rmSync(path.join(DATA(), "user-view"), { recursive: true, force: true });
console.log(`deleted ${uv.length} user-view runs ($${usd.toFixed(2)} → ledger)`);
