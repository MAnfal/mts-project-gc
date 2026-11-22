"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FailedStep } from "@/components/gc/FailedStep";
import { ReportView } from "@/components/gc/ReportView";
import { RunSteps } from "@/components/gc/RunSteps";
import { loadRecordedRun, loadWeekDocs, type WeekDoc } from "@/lib/evals/loader";
import { recordedEvents, reviewerLabel } from "@/lib/pipeline/recorded-events";
import { recordedView, type RecordedView } from "@/lib/runs/recorded-view";
import { reduceEvents } from "@/lib/runs/reduce";
import { formatWindow, sortItems } from "@/lib/runs/report";
import { LoadState } from "./EvalSummary";
import { traceHref } from "./RunPanel";

type Loaded = { raw: unknown; view: RecordedView; docs: WeekDoc[] };

/** One recorded run, mapped by recordedView, with the frozen week's titles for its closest calls and held-back items. */
function useRecorded(suiteId: string, runId: string, companyNames: Record<string, string>) {
  const [state, setState] = useState<{ loaded: Loaded | null; error: string | null }>({ loaded: null, error: null });
  useEffect(() => {
    let live = true;
    (async (): Promise<Loaded> => {
      const raw = await loadRecordedRun(suiteId, runId);
      const view = recordedView(raw, { companyNames });
      // Every recorded window is a frozen week; without its titles the report still renders, minus closest calls.
      const docs = await loadWeekDocs(`${view.windowStart}_${view.windowEnd}`).catch(() => []);
      return { raw, view, docs };
    })()
      .then((loaded) => live && setState({ loaded, error: null }))
      .catch((e: Error) => live && setState({ loaded: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [suiteId, runId, companyNames]);
  return state;
}

const secs = (ms: number) => (ms < 1000 ? "<1s" : `${(ms / 1000).toFixed(1)}s`);

/**
 * The reviewer's read-only report of one recorded run (a suite run or an example run, failed ones included), rendered
 * by the GC's own Report screen: the record goes through recordedView and recordedEvents, the same mapping the GC's
 * examples use, then reduceEvents → ReportView with `readOnly` (no draft emails, no memo, no Retry or Edit settings).
 * Reviewer-facing, so steps carry their internal stage ids and the header names the suite, setup and model.
 */
export function RecordedReport({ suiteId, runId, companyNames }: { suiteId: string; runId: string; companyNames: Record<string, string> }) {
  const { loaded, error } = useRecorded(suiteId, runId, companyNames);
  const state = useMemo(() => {
    if (!loaded) return null;
    const v = loaded.view;
    const view = reduceEvents(recordedEvents(loaded.raw, v, loaded.docs, (stage) => reviewerLabel(stage, v.company)));
    return { v, view, items: sortItems(view.items) };
  }, [loaded]);
  if (!state) return <LoadState error={error} />;
  const { v, view, items } = state;
  const steps = <RunSteps steps={view.steps} live={false} />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        {/* Not a heading: the report below has its own h1. */}
        <p className="m-0 text-[15px] font-semibold">
          {v.company} · {formatWindow(v.windowStart, v.windowEnd)}
        </p>
        <p className="m-0 text-[13px] break-all text-muted-foreground">{[suiteId, v.setup, v.model, `${secs(v.totalMs)} total`].filter(Boolean).join(" · ")}</p>
        <p className="m-0 font-mono text-xs break-all text-caption">{v.id}</p>
      </div>

      {view.status === "done" ? (
        <ReportView view={view} items={items} company={v.company} trace={steps} readOnly />
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-2xl font-bold text-heading">The run failed</h1>
          <p className="m-0 text-[15px] text-muted-foreground">It stopped before it finished. The steps it completed:</p>
          {steps}
          <FailedStep alert message={view.failure?.message ?? "The run failed."} />
        </div>
      )}

      <Link href={traceHref(suiteId, runId)} className="self-start">
        Open this run&apos;s raw trace
      </Link>
    </div>
  );
}
