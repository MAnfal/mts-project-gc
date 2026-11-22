import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { RunEvent } from "../pipeline/events";
import type { CompanyProfile } from "../types";
import { openRunStore } from "./store";
import type { SavedProfile, StoredChat, StoredRun } from "./types";

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

const saved = (key: string, savedAt: string, name = "Ledgerly Inc."): SavedProfile => ({ key, savedAt, profile: { ...profile, name } });

describe("profile store (the GC's own profiles, listed under Company profiles)", () => {
  it("saves a profile and reads it back by key, from IndexedDB after a reopen", async () => {
    const idb = new IDBFactory();
    const first = await openRunStore(idb);
    const p = saved("k1", "2026-11-23T10:00:00.000Z");
    await first.saveProfile(p);
    const second = await openRunStore(idb); // a page reload: only IndexedDB can answer
    expect(second.persistent).toBe(true);
    expect(await second.getProfile("k1")).toEqual(p);
    expect(await second.getProfile("nope")).toBeNull();
  });

  it("lists saved profiles newest first; saving under the same key replaces the old copy", async () => {
    const idb = new IDBFactory();
    const store = await openRunStore(idb);
    await store.saveProfile(saved("a", "2026-11-23T10:00:00.000Z"));
    await store.saveProfile(saved("b", "2026-11-23T11:00:00.000Z"));
    await store.saveProfile(saved("a", "2026-11-23T12:00:00.000Z", "Ledgerly West"));
    const reopened = await openRunStore(idb);
    expect((await reopened.listProfiles()).map((p) => [p.key, p.profile.name])).toEqual([
      ["a", "Ledgerly West"],
      ["b", "Ledgerly Inc."],
    ]);
  });

  it("an edited preset is saved beside the preset it came from: same profile id, its own key", async () => {
    const store = await openRunStore(new IDBFactory());
    await store.saveProfile(saved("k1", "2026-11-23T10:00:00.000Z"));
    await store.saveProfile(saved("k2", "2026-11-23T11:00:00.000Z"));
    expect((await store.listProfiles()).map((p) => [p.key, p.profile.id])).toEqual([
      ["k2", "ledgerly"],
      ["k1", "ledgerly"],
    ]);
  });

  it("keeps profiles in memory, newest first, when IndexedDB is unavailable", async () => {
    const store = await openRunStore(undefined);
    await store.saveProfile(saved("old", "2026-11-23T10:00:00.000Z"));
    await store.saveProfile(saved("new", "2026-11-23T11:00:00.000Z"));
    expect(store.persistent).toBe(false);
    expect((await store.listProfiles()).map((p) => p.key)).toEqual(["new", "old"]);
    expect((await store.getProfile("old"))?.key).toBe("old");
  });
});

describe("upgrading the database from version 1 (runs only)", () => {
  it("adds the profiles store and keeps every run saved under version 1", async () => {
    const idb = new IDBFactory();
    // A browser that ran chunk 04's app: database version 1 with only the runs store, one run in it.
    await new Promise<void>((resolve, reject) => {
      const req = idb.open("reg-monitor", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("runs", { keyPath: "id" });
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("runs", "readwrite");
        tx.objectStore("runs").put(run("v1-run", "2026-11-20T10:00:00.000Z", { status: "done" }));
        tx.oncomplete = () => {
          db.close(); // or the version-2 open below waits on this connection forever
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = await openRunStore(idb);
    expect(store.persistent).toBe(true);
    expect((await store.get("v1-run"))?.status).toBe("done");
    await store.saveProfile(saved("k1", "2026-11-23T10:00:00.000Z"));
    const reopened = await openRunStore(idb);
    expect(reopened.persistent).toBe(true);
    expect((await reopened.listProfiles()).map((p) => p.key)).toEqual(["k1"]);
    expect((await reopened.list()).map((r) => r.id)).toEqual(["v1-run"]);
  });
});

const chat = (id: string, n = 1): StoredChat => ({
  id,
  savedAt: "2026-11-23T10:00:00.000Z",
  turns: Array.from({ length: n }, (_, i) => [
    { role: "user" as const, content: `Question ${i + 1}` },
    { role: "assistant" as const, content: `Answer ${i + 1}` },
  ]).flat(),
});

describe("chat store (follow-up turns, keyed live:<id> or example:<id>)", () => {
  it("saves a conversation and reads it back after a reopen, so the turns survive a reload", async () => {
    const idb = new IDBFactory();
    await (await openRunStore(idb)).saveChat(chat("live:r1"));
    const reopened = await openRunStore(idb);
    expect(reopened.persistent).toBe(true);
    expect(await reopened.getChat("live:r1")).toEqual(chat("live:r1"));
    expect(await reopened.getChat("live:nope")).toBeNull();
  });

  it("keeps a live run's chat and an example's chat apart, and never touches the run record", async () => {
    const idb = new IDBFactory();
    const store = await openRunStore(idb);
    await store.save(run("r1", "2026-11-23T10:00:00.000Z", { status: "done" }));
    await store.saveChat(chat("live:r1", 1));
    await store.saveChat(chat("example:r1", 2));
    const reopened = await openRunStore(idb);
    expect((await reopened.getChat("live:r1"))?.turns).toHaveLength(2);
    expect((await reopened.getChat("example:r1"))?.turns).toHaveLength(4);
    expect(await reopened.get("r1")).toEqual(run("r1", "2026-11-23T10:00:00.000Z", { status: "done" }));
  });

  it("saving again replaces the conversation (a new turn pair, or a cleared chat)", async () => {
    const store = await openRunStore(new IDBFactory());
    await store.saveChat(chat("live:r1", 1));
    await store.saveChat(chat("live:r1", 3));
    expect((await store.getChat("live:r1"))?.turns).toHaveLength(6);
    await store.saveChat({ ...chat("live:r1"), turns: [] });
    expect((await store.getChat("live:r1"))?.turns).toEqual([]);
  });

  it("keeps chats in memory when IndexedDB is unavailable", async () => {
    const store = await openRunStore(undefined);
    await store.saveChat(chat("example:e1", 2));
    expect(store.persistent).toBe(false);
    expect(await store.getChat("example:e1")).toEqual(chat("example:e1", 2));
    expect(await store.getChat("example:e2")).toBeNull();
  });
});

describe("upgrading the database from version 2 (runs and profiles)", () => {
  it("adds the chats store and keeps every run and profile saved under version 2", async () => {
    const idb = new IDBFactory();
    // A browser that ran chunk 05's app: database version 2 with the runs and profiles stores, one record in each.
    await new Promise<void>((resolve, reject) => {
      const req = idb.open("reg-monitor", 2);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("runs", { keyPath: "id" });
        req.result.createObjectStore("profiles", { keyPath: "key" });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(["runs", "profiles"], "readwrite");
        tx.objectStore("runs").put(run("v2-run", "2026-11-22T10:00:00.000Z", { status: "done" }));
        tx.objectStore("profiles").put(saved("v2-profile", "2026-11-22T10:00:00.000Z"));
        tx.oncomplete = () => {
          db.close(); // or the version-3 open below waits on this connection forever
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = await openRunStore(idb);
    expect(store.persistent).toBe(true);
    await store.saveChat(chat("live:v2-run"));
    const reopened = await openRunStore(idb);
    expect(reopened.persistent).toBe(true);
    expect((await reopened.get("v2-run"))?.status).toBe("done");
    expect((await reopened.listProfiles()).map((p) => p.key)).toEqual(["v2-profile"]);
    expect(await reopened.getChat("live:v2-run")).toEqual(chat("live:v2-run"));
  });
});
