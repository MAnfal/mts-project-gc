import fs from "node:fs/promises";
import path from "node:path";
import { experiment, keyPath, loadKey } from "./config";
import type { LabelSet, RunRecord } from "./types";

// Outputs (runs) live in data/; inputs, keys and settings live in config/.
const RUNS = path.resolve(process.cwd(), "data", "runs");

/** Hard cap for the whole experiment (config/experiment.yaml → budgetUsd). Runs refuse to start past it. */
export const budgetUsd = () => experiment().budgetUsd;

export async function saveRun(run: RunRecord) {
  await fs.mkdir(RUNS, { recursive: true });
  await fs.writeFile(path.join(RUNS, `${run.id}.json`), JSON.stringify(run, null, 2));
}

export async function loadRun(id: string): Promise<RunRecord | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(RUNS, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function listRuns(): Promise<RunRecord[]> {
  await fs.mkdir(RUNS, { recursive: true });
  const files = (await fs.readdir(RUNS)).filter((f) => f.endsWith(".json"));
  const runs = await Promise.all(files.map((f) => fs.readFile(path.join(RUNS, f), "utf8").then((s) => JSON.parse(s) as RunRecord)));
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Answer key for a company-week (config/evalsets/keys/), or null. */
export async function loadLabels(profileId: string, start: string, end: string): Promise<LabelSet | null> {
  return loadKey(profileId, start, end);
}

export async function saveLabels(l: LabelSet) {
  // A key with provenance is frozen: every arena is graded against the same file.
  const existing = loadKey(l.profileId, l.windowStart, l.windowEnd);
  if (existing?.provenance) throw new Error(`Answer key is frozen (${existing.provenance}); edit the file deliberately if it must change`);
  const p = keyPath(l.profileId, l.windowStart, l.windowEnd);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify({ ...l, updatedAt: new Date().toISOString() }, null, 2));
}

/** Spend = sum of every persisted run's cost (no shared counter → no write races) + out-of-run smoke-test spend. */
export async function spentUsd(): Promise<number> {
  const runs = await listRuns();
  return runs.reduce((a, r) => a + (r.totalCostUsd ?? 0) + (r.judge?.costUsd ?? 0), 0) + experiment().smokeSpendUsd;
}
