"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createRunner, type Runner } from "@/lib/runs/reader";
import { openRunStore } from "@/lib/runs/store";
import type { RunRequest, SavedProfile, StoredRun } from "@/lib/runs/types";
import type { CompanyProfile } from "@/lib/types";

// React's view of the browser's runs. The runner (src/lib/runs/reader.ts) owns every stream and the store; one
// instance per page load, so a run started on / keeps streaming after the page navigates to /runs/<id>.

let runner: Promise<Runner> | null = null;

/** The page's runner, opened on first use (browser only). */
export function getRunner(): Promise<Runner> {
  runner ??= openRunStore().then((store) =>
    createRunner({ fetch: (input, init) => fetch(input, init), store, newId: () => crypto.randomUUID(), now: () => new Date().toISOString() }),
  );
  return runner;
}

/** Bumps on every runner change, so effects that read the store re-run. */
let version = 0;
const versionListeners = new Set<() => void>();
let wired = false;
function subscribeVersion(listener: () => void) {
  versionListeners.add(listener);
  if (!wired) {
    wired = true;
    void getRunner().then((r) =>
      r.subscribe(() => {
        version++;
        versionListeners.forEach((l) => l());
      }),
    );
  }
  return () => void versionListeners.delete(listener);
}
const useRunnerVersion = () =>
  useSyncExternalStore(
    subscribeVersion,
    () => version,
    () => 0,
  );

/** Starts a run and resolves with its id once it is saved; the stream keeps going in the background. */
export async function startRun(request: RunRequest, profile: CompanyProfile): Promise<string> {
  const r = await getRunner();
  return (await r.start(request, profile)).id;
}

export interface UseRun {
  /** undefined while loading; null when this browser has no such run. */
  run: StoredRun | null | undefined;
  /** False when runs are kept only in memory (IndexedDB unavailable). */
  persistent: boolean;
  /** Starts the same request again; resolves with the new run's id. */
  retry: () => Promise<string | null>;
}

export function useRun(id: string): UseRun {
  const v = useRunnerVersion();
  const [state, setState] = useState<{ run: StoredRun | null | undefined; persistent: boolean }>({ run: undefined, persistent: true });
  useEffect(() => {
    let cancelled = false;
    void getRunner().then(async (r) => {
      const run = r.snapshot(id) ?? (await r.load(id));
      if (!cancelled) setState({ run, persistent: r.store.persistent });
    });
    return () => {
      cancelled = true;
    };
  }, [id, v]);
  const retry = useCallback(async () => {
    const r = await getRunner();
    return (await r.retry(id))?.id ?? null;
  }, [id]);
  return { ...state, retry };
}

/** Saved runs, newest first, refreshed whenever a run changes. */
export function useRecentRuns(): { runs: StoredRun[]; persistent: boolean } {
  const v = useRunnerVersion();
  const [state, setState] = useState<{ runs: StoredRun[]; persistent: boolean }>({ runs: [], persistent: true });
  useEffect(() => {
    let cancelled = false;
    void getRunner().then(async (r) => {
      const runs = await r.list();
      if (!cancelled) setState({ runs, persistent: r.store.persistent });
    });
    return () => {
      cancelled = true;
    };
  }, [v]);
  return state;
}

/** This browser's saved company profiles, newest first (empty until IndexedDB answers). */
export function useSavedProfiles(): SavedProfile[] {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  useEffect(() => {
    let cancelled = false;
    void getRunner().then(async (r) => {
      const list = await r.store.listProfiles();
      if (!cancelled) setProfiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return profiles;
}

/** Saves one of the GC's own profiles so "Company profiles" offers it again. */
export async function saveProfile(p: SavedProfile): Promise<void> {
  await (await getRunner()).store.saveProfile(p);
}
