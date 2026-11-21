// CLI: npx tsx scripts/run.mts --mode pipeline --filter jev+llm --runs 1
import { parseArgs } from "node:util";
import { execute, newRun } from "../src/lib/pipeline/run";
import type { RunConfig } from "../src/lib/types";

const { values: a } = parseArgs({
  options: {
    mode: { type: "string", default: "pipeline" },
    profile: { type: "string", default: "ledgerly" },
    start: { type: "string", default: "2026-11-09" },
    end: { type: "string", default: "2026-11-13" },
    asOf: { type: "string" },
    model: { type: "string", default: "anthropic/claude-sonnet-5.5" },
    filter: { type: "string", default: "jev+llm" },
    threshold: { type: "string", default: "0.3" },
    webLeads: { type: "boolean", default: false },
    runs: { type: "string", default: "1" },
    group: { type: "string" },
  },
});

for (let i = 0; i < Number(a.runs); i++) {
  const cfg: RunConfig = {
    mode: a.mode as RunConfig["mode"],
    profileId: a.profile!,
    windowStart: a.start!,
    windowEnd: a.end!,
    asOf: a.asOf ?? a.end!,
    model: a.model!,
    filter: a.filter as RunConfig["filter"],
    jevThreshold: Number(a.threshold),
    webLeads: a.webLeads!,
    group: a.group,
  };
  const r = await execute(newRun(cfg));
  console.log(`${r.id} ${r.status} ${r.error ?? ""} items=${r.items?.length ?? 0} cost=$${r.totalCostUsd.toFixed(4)} ms=${r.totalMs}`);
  for (const s of r.stages) console.log(`  ${s.name.padEnd(26)} ${String(s.ms).padStart(7)}ms $${s.costUsd.toFixed(4)} in=${s.inCount ?? "-"} out=${s.outCount ?? "-"} ${s.note ?? ""}`);
}
