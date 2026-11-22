"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SPLIT_WORD } from "@/lib/evals/cases";
import type { EvalDirectory } from "@/lib/evals/evalsetInfo";
import type { EvalIndex, RunsIndex } from "@/lib/evals/index-schema";
import { loadRunsIndex, loadTraceChecks, USER_VIEW } from "@/lib/evals/loader";
import { evalsetOfRun, runRows, type RunRow } from "@/lib/evals/runList";
import { cn } from "@/lib/utils";
import { iterationNumber } from "./EvalSidebar";
import { LoadState, useEvalIndex } from "./EvalSummary";
import { traceHref } from "./RunPanel";

type Listing = { id: string; title: string; sub: string; rows: RunRow[] };

/** Every suite's runs-index.json and trace-checks.json, plus the example runs' listing: a few hundred KB in all. */
function useListings(index: EvalIndex | null) {
  const [state, setState] = useState<{ listings: Listing[] | null; error: string | null }>({ listings: null, error: null });
  useEffect(() => {
    if (!index) return;
    let live = true;
    const suites = [...index.suites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const usedBy = (id: string) => index.iterations.filter((i) => i.suite === id).map((i) => iterationNumber(i.id));
    Promise.all([
      ...suites.map(async (s): Promise<Listing> => {
        const [listing, checks] = await Promise.all([loadRunsIndex(s.id), loadTraceChecks(s.id)]);
        const its = usedBy(s.id);
        return {
          id: s.id,
          title: s.id,
          sub: `${s.runs} runs${s.failed ? `, ${s.failed} failed` : ""} · ${s.setups.map((x) => x.key).join(", ")}${its.length ? ` · iteration ${its.join(", ")}` : ""}`,
          rows: runRows(listing, checks),
        };
      }),
      loadRunsIndex(USER_VIEW).then(
        (listing: RunsIndex): Listing => ({
          id: USER_VIEW,
          title: "Example runs (GC view)",
          sub: "Recorded runs of the GC view, failed ones included; they record no trace checks.",
          rows: runRows(listing, null),
        }),
      ),
    ])
      .then((listings) => live && setState({ listings, error: null }))
      .catch((e: Error) => live && setState({ listings: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [index]);
  return state;
}

/** "jev-sonnet-strict · SkyHop Airlines · Oct 26–30 · tuning · run 2 · failed", from the listing and config/ names. */
function runText({ run }: RunRow, directory: EvalDirectory) {
  const evalset = evalsetOfRun(run, directory.evalsets);
  const info = evalset ? directory.evalsets[evalset] : null;
  const where = info
    ? `${info.companyName} · ${info.week} · ${SPLIT_WORD[info.split]}`
    : `${directory.companyNames[run.profileId] ?? run.profileId} · ${run.window.start} to ${run.window.end}`;
  const status = run.status === "done" ? "" : ` · ${run.status === "error" ? "failed" : run.status}`;
  return `${run.setup ?? "no setup recorded"} · ${where}${run.repeat === null ? "" : ` · run ${run.repeat + 1}`}${status}${run.superseded ? " · superseded" : ""}`;
}

function Section({ listing, directory }: { listing: Listing; directory: EvalDirectory }) {
  return (
    <section id={listing.id} aria-labelledby={`${listing.id}-h`} className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${listing.id}-h`} className="m-0 text-[15px] font-semibold break-all">
          {listing.title}
        </h2>
        <span className="text-[13px] text-muted-foreground">{listing.sub}</span>
      </div>
      <ul className="m-0 list-none rounded-lg border border-border p-0">
        {listing.rows.map((r) => (
          <li key={r.run.runId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-row-border px-3 py-2 first:border-t-0">
            <div className="flex min-w-0 grow basis-[260px] flex-col">
              <span className="[overflow-wrap:anywhere]">{runText(r, directory)}</span>
              <span className="font-mono text-xs break-all text-muted-foreground">
                {r.run.runId}
                {r.checks ? (
                  <>
                    {" · "}
                    <span className={cn("whitespace-nowrap", r.checks.failing.length && "text-status-red-fg")}>
                      {r.checks.passed}/{r.checks.total} trace checks
                    </span>
                  </>
                ) : null}
              </span>
            </div>
            {/* 461 links: no viewport prefetch, or scrolling the list would request a route payload per row. */}
            <Link href={traceHref(listing.id, r.run.runId)} prefetch={false} className={cn("shrink-0 whitespace-nowrap", r.run.status === "error" && "text-status-red-fg")}>
              Raw trace
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * /evals/runs: every shipped run, newest suite first, then the example runs, each with a direct raw-trace link,
 * so any run's trace is two clicks from the summary (sidebar Runs, then the link). Labels come from the small
 * runs-index.json listings; runs.jsonl.gz is never downloaded here.
 */
export function RunsView({ directory }: { directory: EvalDirectory }) {
  const { index, error } = useEvalIndex();
  const { listings, error: listError } = useListings(index);
  if (!index || !listings) return <LoadState error={error ?? listError} />;
  return (
    <div className="flex flex-col gap-7">
      <p className="m-0 max-w-[75ch] leading-relaxed text-muted-foreground">
        {index.counts.runs} runs in {index.counts.suites} suites, and {index.counts.userViewRuns} example runs. Each links to its full trace.
      </p>
      {listings.map((l) => (
        <Section key={l.id} listing={l} directory={directory} />
      ))}
    </div>
  );
}
