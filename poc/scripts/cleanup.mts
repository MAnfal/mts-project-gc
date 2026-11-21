// Keep ONE canonical eval suite (+ user-view runs); delete everything else so the data isn't polluted.
// Also migrates the legacy flat layout (data/runs, data/traces) into data/evals/<arena>/ and data/user-view/.
// Deleted runs' spend is archived in data/spend-ledger.json first, so the budget cap still counts it.
//   npx tsx scripts/cleanup.mts --keep <arenaId> [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DATA, scopeDir } from "../src/lib/paths";
import { archiveSpend, runCostUsd } from "../src/lib/store";
import type { RunRecord } from "../src/lib/types";

const { values: a } = parseArgs({ options: { keep: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
if (!a.keep) throw new Error("--keep <arenaId> is required");
const dry = a["dry-run"];

// Every run file anywhere: legacy flat folder + scoped folders.
const runFiles: string[] = [];
const legacyRuns = path.join(DATA(), "runs");
if (fs.existsSync(legacyRuns)) for (const f of fs.readdirSync(legacyRuns)) if (f.endsWith(".json")) runFiles.push(path.join(legacyRuns, f));
for (const base of [path.join(DATA(), "evals"), DATA()])
  if (fs.existsSync(base))
    for (const d of fs.readdirSync(base)) {
      const r = path.join(base, d, "runs");
      if ((base !== DATA() || d === "user-view") && fs.existsSync(r)) for (const f of fs.readdirSync(r)) if (f.endsWith(".json")) runFiles.push(path.join(r, f));
    }

const legacyTrace = (id: string) => path.join(DATA(), "traces", `${id}.jsonl`);
let kept = 0, deleted = 0, usd = 0;
for (const f of runFiles) {
  const run = JSON.parse(fs.readFileSync(f, "utf8")) as RunRecord;
  const isKeep = run.config.arena === a.keep;
  const isUserView = run.config.group === "user-view";
  if (isKeep && run.status === "running") throw new Error(`${a.keep} still has running runs`);
  if (isKeep || isUserView) {
    kept++;
    const dir = scopeDir(run.config);
    const dest = path.join(dir, "runs", `${run.id}.json`);
    if (f !== dest && !dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(f, dest);
      const t = legacyTrace(run.id);
      if (fs.existsSync(t)) {
        fs.mkdirSync(path.join(dir, "traces"), { recursive: true });
        fs.renameSync(t, path.join(dir, "traces", `${run.id}.jsonl`));
      }
    }
  } else {
    deleted++;
    usd += runCostUsd(run);
    if (!dry) {
      fs.rmSync(f);
      fs.rmSync(legacyTrace(run.id), { force: true });
    }
  }
}
console.log(`keep ${kept} runs (${a.keep} + user view); delete ${deleted} runs ($${usd.toFixed(2)} → spend ledger)`);
if (dry) process.exit(0);
if (deleted) await archiveSpend({ reason: `cleanup: deleted ${deleted} runs not in canonical suite ${a.keep}`, runs: deleted, usd });

// Remove other eval-suite folders, leftovers of the flat layout, and regenerable caches.
const evals = path.join(DATA(), "evals");
if (fs.existsSync(evals)) for (const d of fs.readdirSync(evals)) if (d !== a.keep) fs.rmSync(path.join(evals, d), { recursive: true, force: true });
for (const d of ["runs", "traces", "cache", "labels"]) fs.rmSync(path.join(DATA(), d), { recursive: true, force: true });
console.log("done");
