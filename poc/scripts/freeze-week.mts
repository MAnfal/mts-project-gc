// Fetches one Federal Register week and freezes it into config/evalsets/weeks/<start>_<end>.json.
// Usage: npx tsx scripts/freeze-week.mts 2026-11-02 2026-11-06
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "../src/lib/config";
import { listWindow } from "../src/lib/fr";
const [start, end] = process.argv.slice(2);
const out = path.join(CONFIG_DIR, "evalsets/weeks", `${start}_${end}.json`);
if (fs.existsSync(out)) throw new Error(`${out} already frozen`);
const docs = await listWindow(start, end, false);
fs.writeFileSync(out, JSON.stringify(docs));
console.log(`${docs.length} docs → ${out}`);
