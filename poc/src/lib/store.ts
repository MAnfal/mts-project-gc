import fs from "node:fs/promises";
import path from "node:path";
import type { LabelSet, RunRecord } from "./types";

const DATA = path.resolve(process.cwd(), "data");
const RUNS = path.join(DATA, "runs");
const LABELS = path.join(DATA, "labels");

/** Hard cap for the whole experiment (user-set: $15). Runs refuse to start past it. */
export const BUDGET_USD = Number(process.env.POC_BUDGET_USD ?? 15);

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

const labelFile = (profileId: string, start: string, end: string) => path.join(LABELS, `${profileId}_${start}_${end}.json`);

export async function loadLabels(profileId: string, start: string, end: string): Promise<LabelSet | null> {
  try {
    return JSON.parse(await fs.readFile(labelFile(profileId, start, end), "utf8"));
  } catch {
    return null;
  }
}

export async function saveLabels(l: LabelSet) {
  await fs.mkdir(LABELS, { recursive: true });
  await fs.writeFile(labelFile(l.profileId, l.windowStart, l.windowEnd), JSON.stringify({ ...l, updatedAt: new Date().toISOString() }, null, 2));
}

/** Spend = sum of every persisted run's cost (no shared counter → no write races) + smoke-test spend. */
export const SMOKE_SPEND_USD = 0.05;
export async function spentUsd(): Promise<number> {
  const runs = await listRuns();
  return runs.reduce((a, r) => a + (r.totalCostUsd ?? 0), 0) + SMOKE_SPEND_USD;
}
