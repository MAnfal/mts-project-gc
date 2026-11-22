"use client";

import { Check, ChevronDown, ChevronRight, ExternalLink, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CheckedRow, RunViewState } from "@/lib/runs/reduce";
import { deadlineLabel, draftEmails, isNothingToReport, ownerName, reportCounts, reportHeading, reportSummary, TIERS, whyTier } from "@/lib/runs/report";
import type { ActionItem, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyReport } from "./EmptyReport";
import { HeldBack } from "./HeldBack";
import { sourceId } from "./SourcesPanel";

export const TIER_TONE: Record<Tier, string> = {
  Critical: "bg-status-red-surface text-status-red-fg",
  High: "bg-status-orange-surface text-status-orange-fg",
  Medium: "bg-status-yellow-surface text-status-yellow-fg",
  Low: "bg-status-neutral-surface text-status-neutral-fg",
};
const MUTED = "bg-status-neutral-surface text-status-neutral-fg font-normal";

/**
 * The finished report (design/HiReport.dc.html). Every sentence and count comes from the run's items through
 * src/lib/runs/report.ts; nothing is typed from the mockup. `items` must already be in report order (sortItems), so
 * the numbered source chips match the Sources panel. `followUp` renders in the composer slot under the report.
 * Edge states (design/HiStates.dc.html): nothing applies → EmptyReport; held-back items above the table, with "Add after
 * checking" when `onConfirm` is given; items the GC confirmed (view.checkedByYou) in the table, never tiered.
 */
export function ReportView({
  view,
  items,
  company,
  trace,
  followUp,
  onConfirm,
}: {
  view: RunViewState;
  items: ActionItem[];
  company: string;
  trace: ReactNode;
  followUp?: ReactNode;
  onConfirm?: (documentNumber: string) => void;
}) {
  const ctx = { company, windowStart: view.windowStart ?? "", windowEnd: view.windowEnd ?? "" };
  const counts = reportCounts(view);
  const emails = draftEmails(items, ctx);
  const worked = (
    <Collapsible>
      <CollapsibleTrigger className="group -ml-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-nav-hover">
        Worked for {Math.max(1, Math.round((view.ms ?? 0) / 1000))}s
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{trace}</CollapsibleContent>
    </Collapsible>
  );
  if (isNothingToReport(view))
    return (
      <div className="flex flex-col gap-[18px]">
        {worked}
        <EmptyReport view={view} company={company} />
        {followUp}
      </div>
    );
  return (
    <div className="flex flex-col gap-[18px]">
      {worked}

      <h1 className="m-0 text-2xl leading-snug font-bold text-heading">{reportHeading(items, ctx, view.checkedByYou.length)}</h1>
      <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed">{reportSummary(view, ctx)}</p>

      <ul aria-label="Counts" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {TIERS.map((t) => (
          <li key={t} className={cn("rounded-full px-2.5 py-[3px]", counts.tiers[t] ? `${TIER_TONE[t]} font-semibold` : MUTED)}>
            {t} {counts.tiers[t]}
          </li>
        ))}
        <li className={cn("rounded-full px-2.5 py-[3px]", counts.heldBack ? "bg-status-orange-surface font-semibold text-status-orange-fg" : "bg-status-green-surface text-status-green-fg")}>
          Held back {counts.heldBack}
        </li>
      </ul>

      <HeldBack items={view.dropped} onConfirm={onConfirm} />

      {items.length || view.checkedByYou.length ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="min-w-[680px] leading-normal tabular-nums">
            <TableHeader>
              <TableRow className="border-0 bg-secondary hover:bg-secondary">
                <TableHead className="w-[90px] px-3.5 py-2.5 font-semibold">Priority</TableHead>
                <TableHead className="px-3.5 py-2.5 font-semibold">Rule and what to do</TableHead>
                <TableHead className="w-[130px] px-3.5 py-2.5 font-semibold">Deadline</TableHead>
                <TableHead className="w-[120px] px-3.5 py-2.5 font-semibold">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <ItemRow key={item.document_number} item={item} n={i + 1} />
              ))}
              {view.checkedByYou.map((row) => (
                <CheckedItemRow key={row.document_number} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {emails.map((e) => (
          <a key={e.email} href={e.href} className={cn(buttonVariants(), "no-underline hover:text-primary-foreground")}>
            <Mail aria-hidden="true" />
            Draft email to {e.name.split(/\s+/)[0]}
          </a>
        ))}
      </div>

      <NotRelevant view={view} />

      {followUp}
    </div>
  );
}

function ItemRow({ item, n }: { item: ActionItem; n: number }) {
  const [why, setWhy] = useState(false);
  const d = item.deadline ? deadlineLabel(item.deadline) : null;
  return (
    <TableRow className="border-row-border align-top hover:bg-transparent">
      <TableCell className="px-3.5 py-3.5 align-top">
        <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold", TIER_TONE[item.tier])}>{item.tier}</span>
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">
        <div className="font-semibold">
          {item.title}
          <a href={`#${sourceId(n)}`} aria-label={`Source ${n}`} className="ml-0.5 inline-flex h-4 min-w-4 -translate-y-1.5 items-center justify-center rounded-full bg-cite px-1 align-baseline text-[10px] font-semibold text-heading no-underline">
            {n}
          </a>
        </div>
        <div className="mt-1 text-muted-foreground">{item.action || item.reason}</div>
        {!item.citationVerified ? <div className="mt-1 text-[13px] text-status-orange-fg">Citation not matched against the Federal Register: check the source before forwarding.</div> : null}
        <button type="button" aria-expanded={why} onClick={() => setWhy(!why)} className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-[13px] text-caption hover:text-foreground">
          Why {item.tier}?
          <ChevronRight aria-hidden="true" className={cn("size-3 transition-transform", why && "rotate-90")} />
        </button>
        {why ? <div className="mt-2 rounded-md bg-secondary px-3 py-2.5 text-[13px]">{whyTier(item)}</div> : null}
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">
        {d ? (
          <>
            <div title={d.kind}>{d.date.replace(/, \d{4}$/, "")}</div>
            <div className="text-xs text-caption">{d.kind}</div>
            {item.deadline!.verified ? (
              <div className="inline-flex items-center gap-1 text-xs text-status-green-fg">
                <Check aria-hidden="true" className="size-3" />
                Verified
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-caption">None</span>
        )}
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">{ownerName(item.owner)}</TableCell>
    </TableRow>
  );
}

/** A held-back item the GC confirmed: no tier (code computed none), no verified deadline, owned by the GC. */
function CheckedItemRow({ row }: { row: CheckedRow }) {
  return (
    <TableRow className="border-row-border align-top hover:bg-transparent">
      <TableCell className="px-3.5 py-3.5 align-top">
        <span className={cn("rounded-sm px-2 py-0.5 text-xs whitespace-nowrap", MUTED)}>Not tiered</span>
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">
        <div className="font-semibold">
          {row.title}{" "}
          <span className="ml-0.5 inline-block rounded-sm bg-status-blue-surface px-1.5 py-px align-[1px] text-xs font-semibold text-status-blue-fg">Confirmed by you</span>
        </div>
        <div className="mt-1 text-muted-foreground">{row.reason}</div>
        <div className="mt-1 text-[13px] text-caption">Added after you checked it: its dates weren&apos;t verified against the Federal Register.</div>
        <a href={row.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[13px]">
          Open on Federal Register
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">
        <span className="text-caption">None</span>
      </TableCell>
      <TableCell className="px-3.5 py-3.5 align-top whitespace-normal">{ownerName(row.owner)}</TableCell>
    </TableRow>
  );
}

function NotRelevant({ view }: { view: RunViewState }) {
  const { notRelevant, notReviewed } = reportCounts(view);
  if (!notRelevant && !notReviewed) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(buttonVariants({ variant: "outline" }), "group")}>
        {notRelevant} not relevant · see why
        <ChevronRight aria-hidden="true" className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {view.screenedOut.map((d) => (
            <li key={d.document_number} className="rounded-md bg-background px-3 py-2">
              <div className="font-medium">{d.title}</div>
              <div className="text-[13px] text-muted-foreground">{d.reason}</div>
            </li>
          ))}
        </ul>
        {notReviewed ? <p className="m-0 mt-2 text-[13px] text-caption">{notReviewed} more were too far from the profile to read closely.</p> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
