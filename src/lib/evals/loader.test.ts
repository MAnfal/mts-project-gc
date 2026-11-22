import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadIndex, loadIteration, loadIterationFile, loadSuiteRuns, loadTrace, USER_VIEW } from "./loader";

// The loader is browser-side and fetch-based. These tests build a small bundle on disk in the
// public/evals layout and serve it through a fetch stub, so what is asserted is what a page receives.
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "eval-bundle-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function put(rel: string, body: string | Buffer) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

/** Serves `dir` at `/evals/...`, 404 for anything else. Bodies are raw bytes, as a static host sends a .gz. */
function stubFetch(dir: string) {
  const requested: string[] = [];
  const f = async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const rel = url.replace(/^\/evals\//, "");
    const file = path.join(dir, rel);
    if (!url.startsWith("/evals/") || !fs.existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200, headers: { "content-type": "application/gzip" } });
  };
  return { fetch: f as typeof fetch, requested };
}

const gz = (text: string) => zlib.gzipSync(text);

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("loadSuiteRuns", () => {
  it("parses every run in runs.jsonl.gz, ignoring the trailing newline export.mts writes", async () => {
    const runs = [{ id: "r1", status: "done" }, { id: "r2", status: "error" }];
    put("suites/arena-x/runs.jsonl.gz", gz(runs.map((r) => JSON.stringify(r)).join("\n") + "\n"));
    const { fetch } = stubFetch(root);
    expect(await loadSuiteRuns("arena-x", { fetch })).toEqual(runs);
  });

  it("throws naming the URL when the suite is missing", async () => {
    const { fetch } = stubFetch(root);
    await expect(loadSuiteRuns("nope", { fetch })).rejects.toThrow("/evals/suites/nope/runs.jsonl.gz");
  });
});

describe("loadTrace", () => {
  it("decompresses a .jsonl.gz trace into its events, in order", async () => {
    const events = [0, 1, 2].map((seq) => ({ seq, type: seq ? "stage.end" : "run.start", runId: "r1" }));
    put("suites/arena-x/traces/r1.jsonl.gz", gz(events.map((e) => JSON.stringify(e)).join("\n") + "\n"));
    const { fetch, requested } = stubFetch(root);
    expect(await collect(loadTrace("arena-x", "r1", { fetch }))).toEqual(events);
    expect(requested).toEqual(["/evals/suites/arena-x/traces/r1.jsonl.gz"]);
  });

  it("parses lazily: the first event arrives before a later bad line is reached", async () => {
    put("suites/arena-x/traces/r1.jsonl.gz", gz('{"seq":0,"type":"run.start"}\nnot json\n'));
    const { fetch } = stubFetch(root);
    const it = loadTrace("arena-x", "r1", { fetch });
    expect((await it.next()).value).toEqual({ seq: 0, type: "run.start" });
    await expect(it.next()).rejects.toThrow();
  });

  it("yields nothing for a gzipped empty trace", async () => {
    put("suites/arena-x/traces/empty.jsonl.gz", gz(""));
    const { fetch } = stubFetch(root);
    expect(await collect(loadTrace("arena-x", "empty", { fetch }))).toEqual([]);
  });

  it("yields nothing for a 0-byte trace file", async () => {
    put("suites/arena-x/traces/zero.jsonl.gz", Buffer.alloc(0));
    const { fetch } = stubFetch(root);
    expect(await collect(loadTrace("arena-x", "zero", { fetch }))).toEqual([]);
  });

  it("rejects bytes that are not gzip, naming the URL", async () => {
    put("suites/arena-x/traces/plain.jsonl.gz", '{"seq":0}\n');
    const { fetch } = stubFetch(root);
    await expect(collect(loadTrace("arena-x", "plain", { fetch }))).rejects.toThrow("/evals/suites/arena-x/traces/plain.jsonl.gz");
  });

  it("reads user-view traces from user-view/traces/", async () => {
    put("user-view/traces/u1.jsonl.gz", gz('{"seq":0,"type":"run.start"}\n'));
    const { fetch } = stubFetch(root);
    expect(await collect(loadTrace(USER_VIEW, "u1", { fetch }))).toEqual([{ seq: 0, type: "run.start" }]);
  });
});

describe("loadIndex", () => {
  it("rejects an index whose numbers are not labelled", async () => {
    put("index.json", JSON.stringify({ schemaVersion: 1, live: { recall: { all: 0.898 } } }));
    const { fetch } = stubFetch(root);
    await expect(loadIndex({ fetch })).rejects.toThrow();
  });
});

// Real shipped data: public/evals is generated from the poc branch by scripts/build-eval-bundle.sh.
const BUNDLE = path.resolve(import.meta.dirname, "../../../public/evals");

describe("the shipped public/evals bundle through the loader", () => {
  it("loads the index, a suite's runs and one of its traces", async () => {
    const { fetch } = stubFetch(BUNDLE);
    const idx = await loadIndex({ fetch });
    const suite = idx.suites.find((s) => s.id === "arena-2026-11-21-23-16-du8")!;
    const runs = await loadSuiteRuns(suite.id, { fetch });
    expect(runs).toHaveLength(suite.runs);
    const events = await collect(loadTrace(suite.id, String(runs[0].id), { fetch }));
    expect(events[0]).toMatchObject({ seq: 0, type: "run.start", runId: runs[0].id });
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
  });
});

// The real generated bundle (scripts/build-eval-bundle.sh), served through the same stub.
const SHIPPED = path.resolve(import.meta.dirname, "../../../public/evals");

describe("loadIteration", () => {
  it("returns the shipped iteration.json with its recorded hypothesis, change and decision", async () => {
    const { fetch, requested } = stubFetch(SHIPPED);
    const it06 = await loadIteration("06-passages", { fetch });
    expect(requested).toEqual(["/evals/iterations/06-passages/iteration.json"]);
    expect(it06.id).toBe("06-passages");
    expect(it06.evidenceOnly).toBe(false);
    expect(it06.hypothesis).toMatch(/^Dev-only error analysis/);
    expect(it06.change).toMatch(/^New setup jev-sonnet-strict-passages/);
    expect(it06.decision).toMatch(/^Promoted/);
  });

  it("returns the evidence-only record of 07-next with no hypothesis", async () => {
    const { fetch } = stubFetch(SHIPPED);
    const it07 = await loadIteration("07-next", { fetch });
    expect(it07).toMatchObject({ id: "07-next", evidenceOnly: true });
    expect(it07.hypothesis).toBeUndefined();
  });

  it("throws naming the URL for an unknown iteration", async () => {
    const { fetch } = stubFetch(SHIPPED);
    await expect(loadIteration("99-nope", { fetch })).rejects.toThrow("/evals/iterations/99-nope/iteration.json returned 404");
  });

  it("rejects a record whose recorded text fields are not strings", async () => {
    put("iterations/01-x/iteration.json", JSON.stringify({ id: "01-x", evidenceOnly: false, decision: 42 }));
    const { fetch } = stubFetch(root);
    await expect(loadIteration("01-x", { fetch })).rejects.toThrow();
  });
});

describe("loadIterationFile", () => {
  it("returns an evidence file's text as shipped", async () => {
    const { fetch } = stubFetch(SHIPPED);
    const diff = await loadIterationFile("06-passages", "config.diff", { fetch });
    expect(diff).toBe(fs.readFileSync(path.join(SHIPPED, "iterations/06-passages/config.diff"), "utf8"));
  });

  it("throws naming the URL when the iteration has no such file", async () => {
    const { fetch } = stubFetch(SHIPPED);
    await expect(loadIterationFile("00-baseline", "system.diff", { fetch })).rejects.toThrow("/evals/iterations/00-baseline/system.diff returned 404");
  });
});
