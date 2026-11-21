// Bundle one eval suite (+ the user-view pre-runs) for the real build: everything needed to show results without
// re-running anything, laid out as static files (drop the folder into the real app's public/, the CDN serves it;
// the browser gunzips traces with DecompressionStream).
//   npx tsx scripts/export.mts <arenaId>   →  data/exports/<arenaId>/
import fs from "node:fs";
import zlib from "node:zlib";
import { listRuns } from "../src/lib/store";
import path from "node:path";
import { arenaRuns } from "../src/lib/arena";
import { CONFIG_DIR, configHash } from "../src/lib/config";
import { suiteReport } from "../src/lib/suite";
import { traceFile } from "../src/lib/trace";
import { checkTrace } from "../src/lib/trace-checks";
import { readTrace } from "../src/lib/trace";

const id = process.argv[2];
const runs = (await arenaRuns(id)).sort((a, b) => a.id.localeCompare(b.id));
if (!runs.length) throw new Error(`no runs for ${id}`);
const out = path.resolve("data/exports", id);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "traces"), { recursive: true });

fs.writeFileSync(path.join(out, "runs.jsonl.gz"), zlib.gzipSync(runs.map((r) => JSON.stringify(r)).join("\n") + "\n", { level: 9 }));
let events = 0;
const gz = (f: string) => (f.endsWith(".gz") ? fs.readFileSync(f) : zlib.gzipSync(fs.readFileSync(f), { level: 9 }));
for (const r of runs) {
  const t = traceFile(r.id);
  if (!t) continue;
  fs.writeFileSync(path.join(out, "traces", `${r.id}.jsonl.gz`), gz(t));
  events += readTrace(r.id).length;
}
const report = suiteReport(runs);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(out, "trace-checks.json"),
  JSON.stringify(Object.fromEntries(runs.map((r) => [r.id, checkTrace(readTrace(r.id) as never)])), null, 2),
);
fs.cpSync(CONFIG_DIR, path.join(out, "config"), { recursive: true });

// User-view pre-runs: their own folder in the bundle.
const uv = (await listRuns()).filter((r) => r.config.group === "user-view" && r.status === "done").sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.join(out, "user-view", "traces"), { recursive: true });
fs.writeFileSync(path.join(out, "user-view", "runs.jsonl"), uv.map((r) => JSON.stringify(r)).join("\n") + (uv.length ? "\n" : ""));
for (const r of uv) {
  const t = traceFile(r.id);
  if (t) fs.writeFileSync(path.join(out, "user-view", "traces", `${r.id}.jsonl.gz`), gz(t));
}
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify({ schemaVersion: 1, arena: id, exportedAt: new Date().toISOString(), configHash: configHash(), runs: runs.length, traceEvents: events, totalCostUsd: report.totals.costUsd, userViewRuns: uv.length, files: ["runs.jsonl.gz", "traces/<runId>.jsonl.gz", "report.json", "trace-checks.json", "config/", "user-view/runs.jsonl", "user-view/traces/<runId>.jsonl.gz"], schemaDoc: "poc/SCHEMA.md" }, null, 2),
);
console.log(`exported ${runs.length} runs, ${events} trace events → ${out}`);
