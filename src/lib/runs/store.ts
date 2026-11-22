// Where live runs, and the GC's own company profiles, persist: the browser's IndexedDB (the server keeps nothing).
// Raw IndexedDB rather than the `idb` wrapper: a handful of calls on two object stores, and a dependency would buy
// little over the request → promise helper below.
//
// When IndexedDB is missing (some private modes), refuses to open, or fails mid-session (another tab cleared site
// data), every call falls back to an in-memory copy and `persistent` turns false, so the UI can say runs won't
// survive a reload. The memory copy holds every run and profile saved in this tab, so nothing already shown disappears.
import type { SavedProfile, StoredRun } from "./types";

const DB = "reg-monitor";
const RUNS = "runs";
const PROFILES = "profiles";
/** 1: runs. 2: + profiles. */
const VERSION = 2;

export interface RunStore {
  /** False when runs are kept only in this tab's memory (IndexedDB unavailable or failed). */
  readonly persistent: boolean;
  save(run: StoredRun): Promise<void>;
  get(id: string): Promise<StoredRun | null>;
  /** Newest first, by createdAt. */
  list(): Promise<StoredRun[]>;
  /** A run still marked running is set to interrupted (its stream is gone). Any other status is left as it is. */
  markInterrupted(id: string): Promise<StoredRun | null>;
  /** Saves (or replaces, by key) one of the GC's own profiles. */
  saveProfile(p: SavedProfile): Promise<void>;
  getProfile(key: string): Promise<SavedProfile | null>;
  /** Newest first, by savedAt. */
  listProfiles(): Promise<SavedProfile[]>;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB, VERSION);
    // Create only the stores the old version lacks: an upgrade from version 1 keeps its runs store, and every run in it.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RUNS)) db.createObjectStore(RUNS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PROFILES)) db.createObjectStore(PROFILES, { keyPath: "key" });
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
const newestSaved = (ps: SavedProfile[]) => [...ps].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.key.localeCompare(a.key));

export async function openRunStore(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<RunStore> {
  const memory = new Map<string, StoredRun>();
  const memoryProfiles = new Map<string, SavedProfile>();
  let db: IDBDatabase | null = null;
  try {
    if (!factory) throw new Error("indexedDB is not defined");
    db = await openDb(factory);
  } catch (e) {
    console.warn("[Runs] IndexedDB unavailable, keeping runs in memory:", e);
  }

  /** Runs `op` on IndexedDB; on any failure switches to memory for good and returns `fallback()`. */
  async function idb<T>(name: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest, fallback: () => T, map: (r: unknown) => T): Promise<T> {
    if (!db) return fallback();
    try {
      const store = db.transaction(name, mode).objectStore(name);
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
      await idb(RUNS, "readwrite", (s) => s.put(run), () => undefined, () => undefined);
    },
    get(id) {
      return idb(RUNS, "readonly", (s) => s.get(id), () => memory.get(id) ?? null, (r) => (r as StoredRun | undefined) ?? null);
    },
    list() {
      return idb(RUNS, "readonly", (s) => s.getAll(), () => newestFirst([...memory.values()]), (r) => newestFirst(r as StoredRun[]));
    },
    async markInterrupted(id) {
      const run = await store.get(id);
      if (!run || run.status !== "running") return run;
      const marked: StoredRun = { ...run, status: "interrupted" };
      await store.save(marked);
      return marked;
    },
    async saveProfile(p) {
      memoryProfiles.set(p.key, p);
      await idb(PROFILES, "readwrite", (s) => s.put(p), () => undefined, () => undefined);
    },
    getProfile(key) {
      return idb(PROFILES, "readonly", (s) => s.get(key), () => memoryProfiles.get(key) ?? null, (r) => (r as SavedProfile | undefined) ?? null);
    },
    listProfiles() {
      return idb(PROFILES, "readonly", (s) => s.getAll(), () => newestSaved([...memoryProfiles.values()]), (r) => newestSaved(r as SavedProfile[]));
    },
  };
  return store;
}
