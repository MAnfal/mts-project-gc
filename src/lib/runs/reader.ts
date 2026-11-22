// Starting a run from the browser and reading its stream. Pure TypeScript with injected fetch and store, so it is
// tested without a browser; src/components/gc/useRun.ts wires it to React.
//
// A run's stream belongs to this module, not to a component: the Run button lives on one page and the run renders
// on /runs/<id>, so the reader must outlive the component that started it. A run saved as "running" that this
// module isn't reading is therefore one whose page was reloaded or closed mid-run: it can't resume, only be retried.
import type { RunEvent } from "../pipeline/events";
import type { CompanyProfile } from "../types";
import type { RunStore } from "./store";
import type { RunRequest, StoredRun } from "./types";

/** Calls `onEvent` once per NDJSON line of `body`, in order. Rejects if the stream errors or a line isn't JSON. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (e: RunEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (text: string) => {
    for (const line of text.split("\n")) if (line.trim()) onEvent(JSON.parse(line) as RunEvent);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }); // a multi-byte character split across chunks stays whole
    const end = buffer.lastIndexOf("\n");
    if (end >= 0) {
      flush(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
    }
  }
  flush(buffer + decoder.decode());
}

export interface RunnerDeps {
  fetch: typeof fetch;
  store: RunStore;
  newId: () => string;
  /** ISO timestamp for createdAt. */
  now: () => string;
}

export interface Started {
  id: string;
  /** Settles when the stream has ended and the final state is saved; never rejects. */
  finished: Promise<StoredRun>;
}

export function createRunner(deps: RunnerDeps) {
  /** Every run started in this page, in its latest state. */
  const live = new Map<string, StoredRun>();
  /** The ones whose stream is still being read. */
  const streaming = new Set<string>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  async function consume(run: StoredRun): Promise<StoredRun> {
    let current = run;
    // Saves run one after another, so a slow write can never land after a later one.
    let saving = Promise.resolve();
    const update = (next: StoredRun) => {
      current = next;
      live.set(next.id, next);
      saving = saving.then(() => deps.store.save(next));
      notify();
    };
    try {
      const res = await deps.fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(run.request) });
      if (!res.ok || !res.body) throw new Error(`run request answered ${res.status}: ${await res.text()}`);
      await readNdjson(res.body, (event) => {
        const status = event.type === "run.done" ? "done" : event.type === "run.failed" ? "failed" : current.status;
        update({ ...current, events: [...current.events, event], status, result: event.type === "run.done" ? event : current.result });
      });
    } catch (e) {
      console.warn("[Runs] stream ended early:", e);
    }
    // No run.done or run.failed: the connection dropped, the function timed out, or the request was refused.
    if (current.status === "running") update({ ...current, status: "interrupted" });
    await saving;
    streaming.delete(run.id);
    notify();
    return current;
  }

  async function start(request: RunRequest, profile: CompanyProfile): Promise<Started> {
    const run: StoredRun = { id: deps.newId(), createdAt: deps.now(), request, events: [], status: "running", result: null, profile };
    live.set(run.id, run);
    streaming.add(run.id);
    await deps.store.save(run);
    notify();
    return { id: run.id, finished: consume(run) };
  }

  return {
    start,
    /** Starts a new run with exactly the request and profile `id` ran with. Null if `id` isn't known. */
    async retry(id: string): Promise<Started | null> {
      const old = live.get(id) ?? (await deps.store.get(id));
      return old ? start(old.request, old.profile) : null;
    },
    /** A run started in this page as it is now; otherwise the saved copy, marked interrupted if it was left running. */
    async load(id: string): Promise<StoredRun | null> {
      return live.get(id) ?? deps.store.markInterrupted(id);
    },
    /** Saved runs, newest first; one left running by an earlier page is marked interrupted, as in load. */
    async list(): Promise<StoredRun[]> {
      const runs = await deps.store.list();
      return Promise.all(runs.map(async (run) => (run.status === "running" && !streaming.has(run.id) ? ((await deps.store.markInterrupted(run.id)) ?? run) : run)));
    },
    /** The latest state of a run started in this page. */
    snapshot: (id: string) => live.get(id),
    isStreaming: (id: string) => streaming.has(id),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    store: deps.store,
  };
}

export type Runner = ReturnType<typeof createRunner>;
