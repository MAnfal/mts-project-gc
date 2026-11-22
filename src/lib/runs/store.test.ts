import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { RunEvent } from "../pipeline/events";
import type { CompanyProfile } from "../types";
import { openRunStore } from "./store";
import type { StoredRun } from "./types";

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

const start: RunEvent = { type: "run.start", company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06", steps: [] };

function run(id: string, createdAt: string, over: Partial<StoredRun> = {}): StoredRun {
  return {
    id,
    createdAt,
    request: { profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" },
    events: [start],
    status: "running",
    result: null,
    profile,
    ...over,
  };
}

describe("run store on IndexedDB", () => {
  it("saves a run and reads it back by id", async () => {
    const store = await openRunStore(new IDBFactory());
    const r = run("r1", "2026-11-23T10:00:00.000Z");
    await store.save(r);
    expect(store.persistent).toBe(true);
    expect(await store.get("r1")).toEqual(r);
    expect(await store.get("nope")).toBeNull();
  });

  it("lists runs newest first, whatever order they were saved or keyed in", async () => {
    const store = await openRunStore(new IDBFactory());
    await store.save(run("c", "2026-11-23T11:00:00.000Z"));
    await store.save(run("a", "2026-11-23T12:00:00.000Z"));
    await store.save(run("b", "2026-11-23T10:00:00.000Z"));
    expect((await store.list()).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps runs across a reopen (a page reload), so they are in IndexedDB and not only in memory", async () => {
    const idb = new IDBFactory();
    const first = await openRunStore(idb);
    await first.save(run("r1", "2026-11-23T10:00:00.000Z", { status: "done" }));
    const second = await openRunStore(idb);
    expect((await second.get("r1"))?.status).toBe("done");
    expect((await second.list()).map((r) => r.id)).toEqual(["r1"]);
  });

  it("saving a run again replaces it (events appended while streaming)", async () => {
    const store = await openRunStore(new IDBFactory());
    const r = run("r1", "2026-11-23T10:00:00.000Z");
    await store.save(r);
    await store.save({ ...r, events: [start, { type: "step.start", step: "scan", label: "Scanned" }] });
    expect((await store.get("r1"))?.events).toHaveLength(2);
    expect(await store.list()).toHaveLength(1);
  });

  it("marks a run that was still streaming (no terminal event) as interrupted", async () => {
    const idb = new IDBFactory();
    await (await openRunStore(idb)).save(run("r1", "2026-11-23T10:00:00.000Z"));
    const store = await openRunStore(idb); // after a reload
    const marked = await store.markInterrupted("r1");
    expect(marked?.status).toBe("interrupted");
    expect(marked?.events).toEqual([start]);
    expect((await store.get("r1"))?.status).toBe("interrupted");
  });

  it("leaves a finished or failed run alone when asked to mark it interrupted", async () => {
    const store = await openRunStore(new IDBFactory());
    await store.save(run("done", "2026-11-23T10:00:00.000Z", { status: "done" }));
    await store.save(run("failed", "2026-11-23T10:00:00.000Z", { status: "failed" }));
    expect((await store.markInterrupted("done"))?.status).toBe("done");
    expect((await store.markInterrupted("failed"))?.status).toBe("failed");
    expect(await store.markInterrupted("missing")).toBeNull();
  });
});

describe("run store without IndexedDB", () => {
  const exercise = async (store: Awaited<ReturnType<typeof openRunStore>>) => {
    await store.save(run("old", "2026-11-23T10:00:00.000Z"));
    await store.save(run("new", "2026-11-23T11:00:00.000Z"));
    expect((await store.list()).map((r) => r.id)).toEqual(["new", "old"]);
    expect((await store.get("old"))?.id).toBe("old");
    expect((await store.markInterrupted("old"))?.status).toBe("interrupted");
  };

  it("falls back to memory when indexedDB is undefined (private mode, old browser), and says so", async () => {
    const store = await openRunStore(undefined);
    expect(store.persistent).toBe(false);
    await exercise(store);
  });

  it("falls back to memory when opening the database throws", async () => {
    const throwing = { open: () => { throw new DOMException("denied", "SecurityError"); } } as unknown as IDBFactory;
    const store = await openRunStore(throwing);
    expect(store.persistent).toBe(false);
    await exercise(store);
  });

  it("falls back to memory when the open request fails", async () => {
    const failing = {
      open: () => {
        const req = { error: new DOMException("blocked", "InvalidStateError") } as unknown as IDBOpenDBRequest;
        setTimeout(() => req.onerror?.(new Event("error")));
        return req;
      },
    } as unknown as IDBFactory;
    const store = await openRunStore(failing);
    expect(store.persistent).toBe(false);
    await exercise(store);
  });

  it("degrades to memory, keeping this tab's runs, when the database goes away mid-session", async () => {
    const idb = new IDBFactory();
    const store = await openRunStore(idb);
    await store.save(run("before", "2026-11-23T10:00:00.000Z"));
    await new Promise<void>((resolve, reject) => {
      const del = idb.deleteDatabase("reg-monitor"); // another tab clearing site data: our connection must let go
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
    await store.save(run("after", "2026-11-23T11:00:00.000Z"));
    expect(store.persistent).toBe(false);
    expect((await store.list()).map((r) => r.id)).toEqual(["after", "before"]);
    expect((await store.get("after"))?.id).toBe("after");
  });
});
