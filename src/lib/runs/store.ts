// Where live runs persist: the browser's IndexedDB (the server keeps nothing). Raw IndexedDB rather than the `idb`
// wrapper: the store needs four calls on one object store, and a dependency would buy little over the request →
// promise helper below.
//
// When IndexedDB is missing (some private modes), refuses to open, or fails mid-session (another tab cleared site
// data), every call falls back to an in-memory copy and `persistent` turns false, so the UI can say runs won't
// survive a reload. The memory copy holds every run saved in this tab, so nothing already shown disappears.
import type { StoredRun } from "./types";

const DB = "reg-monitor";
const RUNS = "runs";
const VERSION = 1;

export interface RunStore {
  /** False when runs are kept only in this tab's memory (IndexedDB unavailable or failed). */
  readonly persistent: boolean;
  save(run: StoredRun): Promise<void>;
  get(id: string): Promise<StoredRun | null>;
  /** Newest first, by createdAt. */
  list(): Promise<StoredRun[]>;
  /** A run still marked running is set to interrupted (its stream is gone). Any other status is left as it is. */
  markInterrupted(id: string): Promise<StoredRun | null>;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(RUNS)) req.result.createObjectStore(RUNS, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Let another tab upgrade or delete the database; our next call then fails over to memory.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

const newestFirst = (runs: StoredRun[]) => [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

export async function openRunStore(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<RunStore> {
  const memory = new Map<string, StoredRun>();
  let db: IDBDatabase | null = null;
  try {
    if (!factory) throw new Error("indexedDB is not defined");
    db = await openDb(factory);
  } catch (e) {
    console.warn("[Runs] IndexedDB unavailable, keeping runs in memory:", e);
  }

  /** Runs `op` on IndexedDB; on any failure switches to memory for good and returns `fallback()`. */
  async function idb<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest, fallback: () => T, map: (r: unknown) => T): Promise<T> {
    if (!db) return fallback();
    try {
      const store = db.transaction(RUNS, mode).objectStore(RUNS);
      return map(await done(op(store)));
    } catch (e) {
      console.warn("[Runs] IndexedDB failed, keeping runs in memory from now on:", e);
      db = null;
      return fallback();
    }
  }

  const store: RunStore = {
    get persistent() {
      return db !== null;
    },
    async save(run) {
      memory.set(run.id, run);
      await idb("readwrite", (s) => s.put(run), () => undefined, () => undefined);
    },
    get(id) {
      return idb("readonly", (s) => s.get(id), () => memory.get(id) ?? null, (r) => (r as StoredRun | undefined) ?? null);
    },
    list() {
      return idb("readonly", (s) => s.getAll(), () => newestFirst([...memory.values()]), (r) => newestFirst(r as StoredRun[]));
    },
    async markInterrupted(id) {
      const run = await store.get(id);
      if (!run || run.status !== "running") return run;
      const marked: StoredRun = { ...run, status: "interrupted" };
      await store.save(marked);
      return marked;
    },
  };
  return store;
}
