"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noActionMemo } from "@/lib/runs/memo";
import type { RunViewState } from "@/lib/runs/reduce";
import { closestCalls, emptySummary, reportHeading } from "@/lib/runs/report";
import { saveText } from "./download";

/**
 * The nothing-applies report (design/HiStates.dc.html, first panel): how many documents were checked, the closest
 * calls (the first 3 the final screen rejected), and the "no action" memo built in code (src/lib/runs/memo.ts), unless
 * `memo` is false (the reviewer's read-only report).
 */
export function EmptyReport({ view, company, memo = true }: { view: RunViewState; company: string; memo?: boolean }) {
  const ctx = { company, windowStart: view.windowStart ?? "", windowEnd: view.windowEnd ?? "" };
  const calls = closestCalls(view);
  const file = `reg-monitor_no-action_${company.split(/\s+/)[0].toLowerCase()}_${ctx.windowStart}_${ctx.windowEnd}.md`;
  return (
    <section aria-labelledby="empty-heading" className="flex flex-col items-center gap-2.5 rounded-lg bg-card px-5 py-9 text-center shadow-xs sm:px-7">
      <h1 id="empty-heading" className="m-0 text-xl font-semibold text-heading">
        {reportHeading([], ctx)}
      </h1>
      <p className="m-0 max-w-[44ch] leading-relaxed text-muted-foreground">{emptySummary(view, ctx)}</p>
      <div className="mt-2.5 w-full overflow-hidden rounded-md border border-border text-left">
        <h2 className="m-0 bg-secondary px-3 py-2 text-sm font-semibold">Closest calls</h2>
        {calls.length ? (
          <ul className="m-0 list-none p-0">
            {calls.map((c) => (
              <li key={c.document_number} className="border-t border-row-border px-3 py-2.5 text-muted-foreground">
                <span className="font-medium text-foreground">{c.title}</span> · {c.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 border-t border-row-border px-3 py-2.5 text-muted-foreground">No document came close: none reached the final screening.</p>
        )}
      </div>
      {memo ? (
        <Button variant="outline" className="mt-1.5" onClick={() => saveText(file, "text/markdown", noActionMemo(view, ctx))}>
          <Download aria-hidden="true" />
          Download &quot;no action&quot; memo
        </Button>
      ) : null}
    </section>
  );
}
