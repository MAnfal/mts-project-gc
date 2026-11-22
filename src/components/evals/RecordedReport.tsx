"use client";

import { Check, CircleX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TIER_TONE } from "@/components/gc/ReportView";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadRecordedRun, loadWeekDocs } from "@/lib/evals/loader";
import { recordedView, type RecordedView } from "@/lib/runs/recorded-view";
import { deadlineLabel, formatWindow, ownerName, sortItems } from "@/lib/runs/report";
import { cn } from "@/lib/utils";
import { LoadState } from "./EvalSummary";
import { traceHref } from "./RunPanel";

/** One recorded run through the shared mapping (src/lib/runs/recorded-view.ts); held-back titles from the frozen week. */
function useRecordedView(suiteId: string, runId: string, companyNames: Record<string, string>) {
  const [state, setState] = useState<{ view: RecordedView | null; error: string | null }>({ view: null, error: null });
  useEffect(() => {
    let live = true;
    (async () => {
      const raw = await loadRecordedRun(suiteId, runId);
      let view = recordedView(raw, { companyNames });
      if (view.dropped.length) {
        const docs = await loadWeekDocs(`${view.windowStart}_${view.windowEnd}`);
        const titles = new Map(docs.map((d) => [d.document_number, d.title]));
        view = recordedView(raw, { companyNames, titleOf: (n) => titles.get(n) });
      }
      return view;
    })()
      .then((view) => live && setState({ view, error: null }))
      .catch((e: Error) => live && setState({ view: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [suiteId, runId, companyNames]);
  return state;
}

const secs = (ms: number) => (ms < 1000 ? "<1s" : `${(ms / 1000).toFixed(1)}s`);

/**
 * The reviewer's read-only report of one recorded run (a suite run or an example run, failed ones included): what it
 * returned (items with the tier code assigned, deadline, owner), what it held back, and each stage under its internal
 * name. Reviewer-facing, so internal names (setup, model, stage ids) are shown.
 */
export function RecordedReport({ suiteId, runId, companyNames }: { suiteId: string; runId: string; companyNames: Record<string, string> }) {
  const { view: v, error } = useRecordedView(suiteId, runId, companyNames);
  if (!v) return <LoadState error={error} />;
  const items = sortItems(v.items);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-xl font-semibold text-heading">
          {v.company} · {formatWindow(v.windowStart, v.windowEnd)}
        </h1>
        <p className="m-0 text-[13px] break-all text-muted-foreground">
          {[suiteId, v.setup, v.model, `${secs(v.totalMs)} total`].filter(Boolean).join(" · ")}
        </p>
        <p className="m-0 font-mono text-xs break-all text-caption">{v.id}</p>
      </div>

      {v.status === "error" ? (
        <section className="flex flex-col gap-1.5 rounded-md bg-status-red-surface px-3.5 py-3 text-status-red-fg">
          <h2 className="m-0 flex items-center gap-2 text-sm font-semibold">
            <CircleX aria-hidden className="size-4" />
            The run failed
          </h2>
          <p className="m-0 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">{v.error}</p>
        </section>
      ) : (
        <p className="m-0">
          {v.scanned === null ? "" : `${v.scanned} documents scanned · `}
          {items.length} {items.length === 1 ? "item" : "items"} reported · {v.dropped.length} held back
        </p>
      )}

      {items.length ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table className="min-w-[640px] leading-normal tabular-nums">
            <TableHeader>
              <TableRow className="border-0 bg-secondary hover:bg-secondary">
                <TableHead className="w-[90px] px-3 py-2 font-semibold">Tier</TableHead>
                <TableHead className="px-3 py-2 font-semibold">Document</TableHead>
                <TableHead className="w-[140px] px-3 py-2 font-semibold">Deadline</TableHead>
                <TableHead className="w-[140px] px-3 py-2 font-semibold">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const d = i.deadline ? deadlineLabel(i.deadline) : null;
                return (
                  <TableRow key={i.document_number} className="border-row-border align-top hover:bg-transparent">
                    <TableCell className="px-3 py-3 align-top">
                      <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", TIER_TONE[i.tier])}>{i.tier}</span>
                    </TableCell>
                    <TableCell className="px-3 py-3 align-top whitespace-normal">
                      <a href={i.url} target="_blank" rel="noreferrer" className="font-semibold">
                        {i.title}
                      </a>
                      <div className="text-xs text-caption">
                        {i.citation ?? i.document_number} · {i.citationVerified ? "citation matched" : "citation not matched"} · {i.tierReason}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 align-top whitespace-normal">
                      {d ? (
                        <>
                          <div>{d.date}</div>
                          <div className="text-xs text-caption">{d.kind}</div>
                          {i.deadline!.verified ? (
                            <div className="inline-flex items-center gap-1 text-xs text-status-green-fg">
                              <Check aria-hidden className="size-3" />
                              Verified
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-caption">None</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-3 align-top whitespace-normal">{ownerName(i.owner)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {v.dropped.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[15px] font-semibold">Held back (failed verification)</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {v.dropped.map((d) => (
              <li key={d.document_number} className="rounded-md bg-status-orange-surface px-3 py-2 text-status-orange-fg">
                <span className="font-medium">{d.title}</span> ({d.document_number}): {d.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Stages</h2>
        <ol className="m-0 list-none rounded-lg border border-border p-0">
          {v.stages.map((s) => (
            <li key={s.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-row-border px-3 py-2 first:border-t-0">
              <span className="font-mono text-[13px]">{s.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {s.inCount === null ? "" : `${s.inCount} → `}
                {s.outCount ?? "—"} · {secs(s.ms)}
                {s.note ? ` · ${s.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Link href={traceHref(suiteId, runId)} className="self-start">
        Open this run&apos;s raw trace
      </Link>
    </div>
  );
}
