import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { findFile, scopeDir, scopeDirs } from "./paths";
import type { RunRecord } from "./types";

/**
 * Append-only execution trace: one JSONL file per run (data/traces/<runId>.jsonl), one event per line, in order.
 * It records every model call (system, prompt, output, tools, usage, cost), every decision (filter, verify, tier,
 * owner, action guardrail, baseline resolution, judge votes) and every stage's cost and time, so an eval result
 * can be replayed and audited step by step.
 */
/** Existing trace file for a run id (searched across data/evals/* and data/user-view), or null. */
export const traceFile = (runId: string) => findFile("traces", runId);

export class Tracer {
  private seq: number;
  private chain: Promise<void> = Promise.resolve();
  private file: string;
  readonly runId: string;
  constructor(run: Pick<RunRecord, "id" | "config">) {
    this.runId = run.id;
    const dir = path.join(scopeDir(run.config), "traces");
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${run.id}.jsonl`);
    // Continue numbering if the trace already exists (e.g. the judge panel appends after the pipeline).
    // A compacted trace is re-opened as plain .jsonl so appends keep working.
    if (!fs.existsSync(this.file) && fs.existsSync(`${this.file}.gz`)) {
      fs.writeFileSync(this.file, zlib.gunzipSync(fs.readFileSync(`${this.file}.gz`)));
      fs.rmSync(`${this.file}.gz`);
    }
    this.seq = fs.existsSync(this.file) ? fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean).length : 0;
  }
  emit(type: string, data: Record<string, unknown> = {}) {
    const line = JSON.stringify({ seq: this.seq++, ts: new Date().toISOString(), runId: this.runId, type, ...data }) + "\n";
    this.chain = this.chain.then(() => fs.promises.appendFile(this.file, line));
  }
  flush() {
    return this.chain;
  }
}

export function readTrace(runId: string): Record<string, unknown>[] {
  const f = traceFile(runId);
  if (!f) return [];
  const raw = fs.readFileSync(f);
  const text = f.endsWith(".gz") ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/**
 * Gzip finished traces in place (<id>.jsonl → <id>.jsonl.gz, ~10× smaller). Run after a suite; live runs keep
 * appending to plain .jsonl until compacted. Returns how many files were compacted.
 */
export function compactTraces(): number {
  let n = 0;
  for (const d of scopeDirs()) {
    const dir = path.join(d, "traces");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
      const p = path.join(dir, f);
      fs.writeFileSync(`${p}.gz`, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
      fs.rmSync(p);
      n++;
    }
  }
  return n;
}
