"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadTrace, loadTraceChecks, USER_VIEW, type TraceCheck, type TraceEvent } from "@/lib/evals/loader";
import { eventLabel, eventSummary, filterTrace, indexTrace } from "@/lib/evals/traceIndex";
import { cn } from "@/lib/utils";
import { ChecksBox } from "./RunPanel";

/** Fixed row height: every row is one line, so the virtualizer never measures rows (smooth at the largest shipped trace). */
const ROW = 34;

type Loaded = { events: TraceEvent[]; done: boolean; error: string | null };

/** Streams the trace in, publishing what has arrived every few hundred events so a large trace shows progress. */
function useTraceEvents(suiteId: string, runId: string): Loaded {
  const [state, setState] = useState<Loaded>({ events: [], done: false, error: null });
  useEffect(() => {
    let live = true;
    (async () => {
      const events: TraceEvent[] = [];
      try {
        for await (const e of loadTrace(suiteId, runId)) {
          events.push(e);
          if (events.length % 500 === 0 && live) setState({ events: [...events], done: false, error: null });
        }
        if (live) setState({ events, done: true, error: null });
      } catch (e) {
        if (live) setState({ events, done: true, error: (e as Error).message });
      }
    })();
    return () => {
      live = false;
    };
  }, [suiteId, runId]);
  return state;
}

function useChecks(suiteId: string, runId: string) {
  const [state, setState] = useState<{ checks: TraceCheck[] | null; loaded: boolean; error: string | null }>({ checks: null, loaded: false, error: null });
  useEffect(() => {
    let live = true;
    loadTraceChecks(suiteId)
      .then((all) => live && setState({ checks: all?.[runId] ?? null, loaded: true, error: null }))
      .catch((e: Error) => live && setState({ checks: null, loaded: true, error: e.message }));
    return () => {
      live = false;
    };
  }, [suiteId, runId]);
  return state;
}

/**
 * One run's raw trace (/evals/traces/<suite>/<run>): the trace-check summary first, then every event in a
 * virtualized list with type chips and a search over values. Clicking an event opens its full JSON below.
 */
export function TraceViewer({ suiteId, runId }: { suiteId: string; runId: string }) {
  const { events, done, error } = useTraceEvents(suiteId, runId);
  const checks = useChecks(suiteId, runId);
  const index = useMemo(() => indexTrace(events), [events]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const shown = useMemo(() => filterTrace(index, { hidden, query }), [index, hidden, query]);

  const scroller = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open !== null) detail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);
  // eslint-disable-next-line react-hooks/incompatible-library -- the virtualizer's functions are not memoizable; nothing here memoizes them
  const v = useVirtualizer({ count: shown.length, getScrollElement: () => scroller.current, estimateSize: () => ROW, overscan: 12 });

  const start = events[0] as (TraceEvent & { config?: { cell?: string; evalset?: string; repeatIndex?: number; profileId?: string } }) | undefined;
  const cfg = start?.type === "run.start" ? start.config : undefined;
  const openEvent = open === null ? null : events[open];
  const toggle = (t: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-lg font-semibold">Raw trace{done && !error ? ` · ${events.length.toLocaleString("en-US")} events` : ""}</h1>
        <p className="m-0 text-[13px] break-all text-muted-foreground">
          {cfg ? `${cfg.cell ?? "—"} · ${cfg.evalset ?? cfg.profileId ?? "—"} · run ${(cfg.repeatIndex ?? 0) + 1} · ` : ""}
          {suiteId === USER_VIEW ? "example run" : `suite ${suiteId}`} · {runId}
        </p>
      </div>

      {!checks.loaded ? (
        <p className="m-0 text-muted-foreground">Loading the trace checks…</p>
      ) : checks.error ? (
        <p role="alert" className="m-0 rounded-md bg-status-red-surface px-3 py-2 text-status-red-fg">
          The trace checks could not be loaded: {checks.error}
        </p>
      ) : (
        <ChecksBox checks={checks.checks} />
      )}

      {error ? (
        <p role="alert" className="m-0 rounded-md bg-status-red-surface px-3 py-2 text-status-red-fg">
          The trace could not be read: {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Event types">
        {index.types.map(({ type, count }) => (
          <button
            key={type}
            type="button"
            aria-pressed={!hidden.has(type)}
            onClick={() => toggle(type)}
            className={cn("rounded-full border border-border px-2.5 py-1", hidden.has(type) ? "text-muted-foreground line-through opacity-60" : "bg-card hover:bg-nav-hover")}
          >
            {eventLabel(type)} · {count.toLocaleString("en-US")}
          </button>
        ))}
        {index.types.length ? (
          <>
            <button type="button" onClick={() => setHidden(new Set(index.types.map((t) => t.type).filter((t) => t !== "filter.decision")))} className="px-1.5 py-1 text-primary underline underline-offset-[3px]">
              Decisions only
            </button>
            <button type="button" onClick={() => setHidden(new Set())} className="px-1.5 py-1 text-primary underline underline-offset-[3px]">
              Show all
            </button>
          </>
        ) : null}
      </div>

      <label className="flex h-9 max-w-[420px] items-center gap-2 rounded-md border border-border bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Search the trace</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Document number or word"
          className="min-w-0 grow bg-transparent outline-none"
        />
      </label>

      <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
        {done ? `Showing ${shown.length.toLocaleString("en-US")} of ${events.length.toLocaleString("en-US")} events` : `Reading the trace… ${events.length.toLocaleString("en-US")} events so far`}
      </p>

      <div ref={scroller} data-testid="trace-list" className="h-[60vh] min-h-[240px] overflow-y-auto rounded-lg border border-border">
        <ol className="relative m-0 list-none p-0" style={{ height: v.getTotalSize() }}>
          {v.getVirtualItems().map((item) => {
            const i = shown[item.index];
            const e = events[i];
            return (
              <li key={item.key} className="absolute inset-x-0 top-0" style={{ height: ROW, transform: `translateY(${item.start}px)` }}>
                <button
                  type="button"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                  className={cn("flex h-full w-full items-center gap-2 border-b border-row-border px-3 text-left text-[13px]", open === i ? "bg-accent" : "hover:bg-background")}
                >
                  <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">#{e.seq}</span>
                  <span className="w-[72px] shrink-0 truncate rounded-sm bg-secondary px-1.5 text-xs">{eventLabel(e.type)}</span>
                  <span className="min-w-0 grow truncate">{eventSummary(e)}</span>
                  <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">{String(e.ts ?? "").slice(11, 19)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {openEvent ? (
        <section ref={detail} aria-label={`Event ${openEvent.seq}`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold">
              Event #{openEvent.seq} · {openEvent.type}
            </h2>
            <button type="button" onClick={() => setOpen(null)} className="rounded-md p-1 hover:bg-nav-hover" aria-label="Close event">
              <X className="size-4" />
            </button>
          </div>
          <pre className="m-0 max-h-[60vh] overflow-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
            {JSON.stringify(openEvent, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
