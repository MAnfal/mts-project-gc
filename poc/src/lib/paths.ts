import fs from "node:fs";
import path from "node:path";
import type { RunConfig } from "./types";

/**
 * Where run outputs live. Eval suites and the user view are kept apart:
 *   data/evals/<arenaId>/{runs,traces}/   — eval suite runs (one folder per suite)
 *   data/user-view/{runs,traces}/         — user-view runs (pre-runs + fresh runs)
 */
export const DATA = () => path.resolve(process.cwd(), "data");
export const scopeDir = (cfg: Pick<RunConfig, "arena" | "group">) =>
  cfg.arena && cfg.arena !== "user-view" ? path.join(DATA(), "evals", cfg.arena) : path.join(DATA(), "user-view");

/** Every scope folder that exists (each has runs/ and traces/). */
export function scopeDirs(): string[] {
  const out: string[] = [];
  const evals = path.join(DATA(), "evals");
  if (fs.existsSync(evals)) for (const a of fs.readdirSync(evals)) out.push(path.join(evals, a));
  if (fs.existsSync(path.join(DATA(), "user-view"))) out.push(path.join(DATA(), "user-view"));
  return out;
}

/** Find a run's file of the given kind by id, across all scopes. Traces may be live (.jsonl) or compacted (.jsonl.gz). */
export function findFile(kind: "runs" | "traces", id: string): string | null {
  const names = kind === "runs" ? [`${id}.json`] : [`${id}.jsonl`, `${id}.jsonl.gz`];
  for (const d of scopeDirs())
    for (const name of names) {
      const p = path.join(d, kind, name);
      if (fs.existsSync(p)) return p;
    }
  return null;
}
