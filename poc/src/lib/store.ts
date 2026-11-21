import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { experiment } from "./config";
import { findFile, scopeDir, scopeDirs } from "./paths";
import type { RunRecord } from "./types";

// Outputs (runs, traces) live in data/ (see paths.ts); inputs, keys and settings live in config/.

/** Hard cap for the whole experiment (config/experiment.yaml → budgetUsd). Runs refuse to start past it. */
export const budgetUsd = () => experiment().budgetUsd;

export async function saveRun(run: RunRecord) {
  const dir = path.join(scopeDir(run.config), "runs");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${run.id}.json`), JSON.stringify(run, null, 2));
}

export async function loadRun(id: string): Promise<RunRecord | null> {
  const f = findFile("runs", id);
  return f ? JSON.parse(await fs.readFile(f, "utf8")) : null;
}

export async function listRuns(): Promise<RunRecord[]> {
  const files = scopeDirs().flatMap((d) => {
    const runs = path.join(d, "runs");
    return fsSync.existsSync(runs) ? fsSync.readdirSync(runs).filter((f) => f.endsWith(".json")).map((f) => path.join(runs, f)) : [];
  });
  const runs = await Promise.all(files.map((f) => fs.readFile(f, "utf8").then((s) => JSON.parse(s) as RunRecord)));
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Spend of deleted runs, so cleaning up old data never makes the budget forget money already spent.
const LEDGER = path.resolve(process.cwd(), "data", "spend-ledger.json");
interface Ledger {
  entries: { date: string; reason: string; runs: number; usd: number }[];
}
async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await fs.readFile(LEDGER, "utf8"));
  } catch {
    return { entries: [] };
  }
}
export async function archiveSpend(e: { reason: string; runs: number; usd: number }) {
  const l = await readLedger();
  l.entries.push({ date: new Date().toISOString(), ...e });
  await fs.mkdir(path.dirname(LEDGER), { recursive: true });
  await fs.writeFile(LEDGER, JSON.stringify(l, null, 2));
}

export const runCostUsd = (r: RunRecord) => (r.totalCostUsd ?? 0) + (r.judge?.costUsd ?? 0) + (r.panel?.costUsd ?? 0);

/** Spend = saved runs (incl. judge panel) + archived spend of deleted runs + out-of-run smoke-test spend. */
export async function spentUsd(): Promise<number> {
  const runs = await listRuns();
  const archived = (await readLedger()).entries.reduce((a, e) => a + e.usd, 0);
  return runs.reduce((a, r) => a + runCostUsd(r), 0) + archived + experiment().smokeSpendUsd;
}
