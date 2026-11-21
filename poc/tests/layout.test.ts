import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunRecord } from "../src/lib/types";

const run = (id: string, over: Partial<RunRecord["config"]> = {}): RunRecord => ({
  id,
  createdAt: id,
  config: { mode: "pipeline", profileId: "p", windowStart: "a", windowEnd: "b", asOf: "b", model: "m", filter: "llm", jevThreshold: 0.1, webLeads: false, ...over },
  status: "done",
  stages: [],
  calls: [],
  totalCostUsd: 0,
  totalMs: 0,
});

describe("data layout: evals and user-view runs live in their own folders", () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("saves, lists and loads runs and traces by scope", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "layout-"));
    vi.stubEnv("POC_CONFIG_DIR", path.resolve(cwd, "config"));
    process.chdir(dir);
    vi.resetModules();
    const store = await import("../src/lib/store");
    const { Tracer, readTrace } = await import("../src/lib/trace");

    await store.saveRun(run("e1", { arena: "arena-x", cell: "jev-sonnet" }));
    await store.saveRun(run("u1", { group: "user-view" }));
    expect(fs.existsSync("data/evals/arena-x/runs/e1.json")).toBe(true);
    expect(fs.existsSync("data/user-view/runs/u1.json")).toBe(true);

    const t = new Tracer(run("e1", { arena: "arena-x" }));
    t.emit("run.start");
    await t.flush();
    expect(fs.existsSync("data/evals/arena-x/traces/e1.jsonl")).toBe(true);
    expect(readTrace("e1")).toHaveLength(1);

    expect((await store.listRuns()).map((r) => r.id).sort()).toEqual(["e1", "u1"]);
    expect((await store.loadRun("u1"))?.id).toBe("u1");
  });
});

describe("finished traces are stored gzipped and still readable", () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("compactTraces gzips .jsonl in place; readTrace reads .jsonl.gz", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gz-"));
    vi.stubEnv("POC_CONFIG_DIR", path.resolve(cwd, "config"));
    process.chdir(dir);
    vi.resetModules();
    const { Tracer, readTrace, compactTraces, traceFile } = await import("../src/lib/trace");
    const t = new Tracer(run("e2", { arena: "arena-y" }));
    t.emit("run.start");
    t.emit("run.end");
    await t.flush();
    expect(compactTraces()).toBe(1);
    expect(fs.existsSync("data/evals/arena-y/traces/e2.jsonl")).toBe(false);
    expect(traceFile("e2")).toMatch(/e2\.jsonl\.gz$/);
    expect(readTrace("e2").map((e) => e.type)).toEqual(["run.start", "run.end"]);
  });
});
