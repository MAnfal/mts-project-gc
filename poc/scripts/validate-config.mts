// Validates every file in config/ (schemas + cross-references) and prints the eval-set inventory.
import { evalsets, loadKey, validateAll } from "../src/lib/config";
const problems = validateAll();
console.log(problems.length ? `PROBLEMS:\n- ${problems.join("\n- ")}` : "config OK");
let flags = 0, traps = 0;
for (const e of evalsets()) {
  const k = loadKey(e.company, e.windowStart, e.windowEnd);
  const t = Object.keys(k?.traps ?? {}).length;
  flags += k?.relevant.length ?? 0; traps += t;
  console.log(`${e.id.padEnd(34)} ${e.split.padEnd(4)} ${k ? `flags ${k.relevant.length}  traps ${t}` : "NO KEY"}`);
}
console.log(`total: ${flags} should-flag cases, ${traps} trap cases`);
if (problems.length) process.exit(1);
