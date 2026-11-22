import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { RunEvent } from "../pipeline/events";
import type { CompanyProfile } from "../types";
import { createRunner, readNdjson } from "./reader";
import { openRunStore } from "./store";
import type { RunRequest } from "./types";

const profile: CompanyProfile = {
  id: "ledgerly",
  name: "Ledgerly Inc.",
  summary: "US fintech",
  businessLines: [],
  applies: [],
  doesNotApply: [],
  areas: {},
  generalCounsel: { name: "Jordan Blake", email: "gc@example.com" },
};
const request: RunRequest = { profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" };

// A title with multi-byte characters, so a chunk boundary can fall inside one.
const TITLE = "Café — “Sanctions” Notice §1";
const EVENTS: RunEvent[] = [
  { type: "run.start", company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06", steps: [{ step: "scan", label: "Scanned the Federal Register" }] },
  { type: "step.start", step: "scan", label: "Scanned the Federal Register" },
  { type: "step.progress", step: "scan", count: 1, title: TITLE },
  { type: "step.done", step: "scan", count: 466, ms: 2000 },
  { type: "run.done", items: [], dropped: [], screenedOut: [], notReviewedCount: 0, scanned: 466, markdown: "# Report", ms: 2100 },
];
const FAILED: RunEvent[] = [EVENTS[0], EVENTS[1], { type: "step.failed", step: "scan", label: "Scanned", message: "No response" }, { type: "run.failed", step: "scan", message: "No response" }];

const bytesOf = (events: RunEvent[]) => new TextEncoder().encode(events.map((e) => JSON.stringify(e)).join("\n") + "\n");

/** Splits `bytes` every `size` bytes: lines and multi-byte characters both get cut. */
function chunked(bytes: Uint8Array, size: number, opts: { failAfter?: number } = {}): ReadableStream<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.slice(i, i + size));
  let n = 0;
  return new ReadableStream({
    pull(c) {
      if (opts.failAfter !== undefined && n === opts.failAfter) return c.error(new TypeError("network error"));
      if (n < parts.length) c.enqueue(parts[n++]);
      else c.close();
    },
  });
}

describe("readNdjson", () => {
  it("parses every event exactly once when chunks split lines and characters mid-way", async () => {
    const bytes = bytesOf(EVENTS);
    const multiByteAt = bytes.indexOf(0xe2); // first byte of "—"
    expect(multiByteAt).toBeGreaterThan(0);
    for (const size of [1, 3, 7, 64, bytes.length]) {
      const got: RunEvent[] = [];
      await readNdjson(chunked(bytes, size), (e) => got.push(e));
      expect(got, `chunk size ${size}`).toEqual(EVENTS);
    }
  });

  it("reads a last line that has no trailing newline, and skips blank lines", async () => {
    const text = `\n${JSON.stringify(EVENTS[0])}\n\n${JSON.stringify(EVENTS[1])}`;
    const got: RunEvent[] = [];
    await readNdjson(chunked(new TextEncoder().encode(text), 5), (e) => got.push(e));
    expect(got).toEqual([EVENTS[0], EVENTS[1]]);
  });

  it("rejects on a line that isn't JSON", async () => {
    const text = `${JSON.stringify(EVENTS[0])}\n<html>502 Bad Gateway</html>\n`;
    await expect(readNdjson(chunked(new TextEncoder().encode(text), 10), () => {})).rejects.toThrow();
  });
});

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

async function setup(respond: () => Response | Promise<Response>, idb = new IDBFactory()) {
  const store = await openRunStore(idb);
  const f = fakeFetch(respond);
  let n = 0;
  const runner = createRunner({ fetch: f.fetch, store, newId: () => `run-${++n}`, now: () => `2026-11-23T10:00:0${n}.000Z` });
  return { store, runner, calls: f.calls, idb };
}

const ndjson = (events: RunEvent[], size = 13, opts: { failAfter?: number } = {}) =>
  new Response(chunked(bytesOf(events), size, opts), { headers: { "content-type": "application/x-ndjson" } });

describe("createRunner: start", () => {
  it("POSTs the request, saves a running record first, then appends every event to the store", async () => {
    const { runner, store, calls } = await setup(() => ndjson(EVENTS));
    const { id, finished } = await runner.start(request, profile);
    expect(id).toBe("run-1");
    const saved = await finished;
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/run");
    expect(calls[0].init.method).toBe("POST");
    expect(new Headers(calls[0].init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(calls[0].init.body as string)).toEqual(request);
    expect(saved.status).toBe("done");
    expect(saved.result).toEqual(EVENTS.at(-1));
    const stored = await store.get(id);
    expect(stored?.events).toEqual(EVENTS);
    expect(stored).toMatchObject({ id, status: "done", request, profile, createdAt: "2026-11-23T10:00:01.000Z" });
  });

  it("saves the record as running before the response arrives", async () => {
    let release!: (r: Response) => void;
    const { runner, store } = await setup(() => new Promise<Response>((r) => (release = r)));
    const { id, finished } = await runner.start(request, profile);
    expect(await store.get(id)).toMatchObject({ status: "running", events: [] });
    release(ndjson(EVENTS));
    await finished;
  });

  it("ends failed, with the events, when the stream ends in run.failed", async () => {
    const { runner, store } = await setup(() => ndjson(FAILED));
    const { id, finished } = await runner.start(request, profile);
    expect((await finished).status).toBe("failed");
    expect(await store.get(id)).toMatchObject({ status: "failed", events: FAILED, result: null });
  });

  it("notifies subscribers as events arrive", async () => {
    const { runner } = await setup(() => ndjson(EVENTS));
    const seen: number[] = [];
    let current = "";
    const off = runner.subscribe(() => seen.push(runner.snapshot(current)?.events.length ?? -1));
    const { id, finished } = await runner.start(request, profile);
    current = id;
    await finished;
    off();
    expect(seen.at(-1)).toBe(EVENTS.length);
    expect(new Set(seen.filter((n) => n > 0)).size).toBeGreaterThanOrEqual(EVENTS.length - 1);
  });
});

describe("createRunner: a stream that never reaches run.done or run.failed is saved as interrupted", () => {
  const cases: [string, () => Response | Promise<Response>, number][] = [
    ["fetch rejects (offline)", () => Promise.reject(new TypeError("Failed to fetch")), 0],
    ["the response is not OK (a plain-text 400)", () => new Response("Pick a window of at most 7 days.", { status: 400 }), 0],
    ["the response is not OK even though its body parses as JSON (a platform error page)", () => new Response('{"error":{"code":"504"}}\n', { status: 504 }), 0],
    ["reading the body fails mid-stream", () => ndjson(EVENTS, 13, { failAfter: 4 }), -1],
    ["the body ends cleanly with no terminal event (function timeout)", () => ndjson(EVENTS.slice(0, 3)), 3],
  ];
  for (const [name, respond, kept] of cases)
    it(name, async () => {
      const { runner, store } = await setup(respond);
      const { id, finished } = await runner.start(request, profile);
      expect((await finished).status).toBe("interrupted");
      const stored = await store.get(id);
      expect(stored?.status).toBe("interrupted");
      expect(stored?.result).toBeNull();
      if (kept >= 0) expect(stored?.events).toHaveLength(kept);
      else expect(stored!.events.length).toBeLessThan(EVENTS.length);
    });
});

describe("createRunner: retry", () => {
  it("posts the stored request unchanged, as a new run with the same profile", async () => {
    const custom: RunRequest = { customProfile: { ...profile, id: "custom", name: "My Co" }, windowStart: "2026-11-09", windowEnd: "2026-11-13" };
    const { runner, store, calls } = await setup(() => ndjson(FAILED));
    const first = await runner.start(custom, custom.customProfile);
    await first.finished;
    const second = await runner.retry(first.id);
    if (!second) throw new Error("retry returned null");
    await second.finished;
    expect(second.id).not.toBe(first.id);
    expect(calls).toHaveLength(2);
    expect(calls[1].init.body).toBe(calls[0].init.body);
    expect(JSON.parse(calls[1].init.body as string)).toEqual(custom);
    expect(await store.get(second.id)).toMatchObject({ request: custom, profile: custom.customProfile });
  });

  it("retries a run saved before a reload (read from the store, not memory)", async () => {
    const idb = new IDBFactory();
    const before = await setup(() => ndjson(FAILED), idb);
    const first = await before.runner.start(request, profile);
    await first.finished;
    const after = await setup(() => ndjson(EVENTS), idb);
    const second = await after.runner.retry(first.id);
    await second?.finished;
    expect(JSON.parse(after.calls[0].init.body as string)).toEqual(request);
  });

  it("returns null for a run it can't find", async () => {
    const { runner, calls } = await setup(() => ndjson(EVENTS));
    expect(await runner.retry("missing")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("createRunner: load", () => {
  it("marks a run left 'running' by a previous page (reload mid-run) as interrupted", async () => {
    const idb = new IDBFactory();
    const before = await setup(() => new Promise<Response>(() => {}), idb); // never answers
    const { id } = await before.runner.start(request, profile);
    const after = await setup(() => ndjson(EVENTS), idb);
    expect((await after.runner.load(id))?.status).toBe("interrupted");
    expect((await after.store.get(id))?.status).toBe("interrupted");
  });

  it("returns a run streaming in this page as it is, without marking it", async () => {
    let release!: (r: Response) => void;
    const { runner, store } = await setup(() => new Promise<Response>((r) => (release = r)));
    const { id, finished } = await runner.start(request, profile);
    expect((await runner.load(id))?.status).toBe("running");
    expect((await store.get(id))?.status).toBe("running");
    release(ndjson(EVENTS));
    await finished;
    expect((await runner.load(id))?.status).toBe("done");
  });

  it("returns null for an unknown id", async () => {
    const { runner } = await setup(() => ndjson(EVENTS));
    expect(await runner.load("missing")).toBeNull();
  });
});
