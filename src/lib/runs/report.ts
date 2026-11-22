// Every sentence and number the Report screen derives from a run, written in code from the run's own items: no model
// writes any of it, so the same run always reads the same. Pure: no React, no I/O.
import { format, parseISO } from "date-fns";
import type { ActionItem, Deadline, DocType, Owner, Tier } from "../types";
import type { RunViewState } from "./reduce";

export const TIERS: Tier[] = ["Critical", "High", "Medium", "Low"];

/** "Nov 2–6, 2026", "Oct 30 – Nov 3, 2026", "Dec 29, 2026 – Jan 2, 2027"; `year: false` drops the year. */
export function formatWindow(start: string, end: string, opts: { year?: boolean } = {}): string {
  const withYear = opts.year ?? true;
  const a = parseISO(start);
  const b = parseISO(end);
  const y = withYear ? `, ${format(b, "yyyy")}` : "";
  if (start === end) return `${format(a, "MMM d")}${y}`;
  if (format(a, "yyyy") !== format(b, "yyyy")) return withYear ? `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}` : `${format(a, "MMM d")} – ${format(b, "MMM d")}`;
  if (format(a, "MM") !== format(b, "MM")) return `${format(a, "MMM d")} – ${format(b, "MMM d")}${y}`;
  return `${format(a, "MMM d")}–${format(b, "d")}${y}`;
}

/** "Marcus Lee (Sanctions)" → "Marcus Lee". */
export const ownerName = (o: Owner) => o.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
const firstName = (o: Owner) => ownerName(o).split(/\s+/)[0];

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
/** Ends `s` with one full stop: a company called "Ledgerly Inc." must not end a sentence with "..". */
export const stop = (s: string) => (s.endsWith(".") ? s : `${s}.`);

const DOC_NOUN: Record<DocType, string> = { Rule: "rule", "Proposed Rule": "proposed rule", Notice: "notice", "Presidential Document": "presidential document" };

/** Critical first; the run's own order within a tier. */
export const sortItems = (items: ActionItem[]) => [...items].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));

const uniqueOwners = (items: ActionItem[]) => [...new Map(items.map((i) => [i.owner.email, i.owner])).values()];

interface Ctx {
  company: string;
  windowStart: string;
  windowEnd: string;
}

/** "3 notices for Marcus Lee, nothing Critical". */
export function reportHeading(items: ActionItem[], ctx: Ctx): string {
  if (!items.length) return `Nothing published ${formatWindow(ctx.windowStart, ctx.windowEnd, { year: false })} affects ${ctx.company}`;
  const types = new Set(items.map((i) => i.type));
  const noun = types.size === 1 ? DOC_NOUN[items[0].type] : "item";
  const owners = uniqueOwners(items);
  const who = owners.length === 1 ? ownerName(owners[0]) : `${owners.length} owners`;
  const critical = items.filter((i) => i.tier === "Critical").length;
  return `${items.length} ${plural(items.length, noun)} for ${who}, ${critical ? `${critical} Critical` : "nothing Critical"}`;
}

type SummaryView = Pick<RunViewState, "items" | "scanned" | "dropped">;

/** The paragraph under the heading: what was read, what matters, what was checked, what was held back. */
export function reportSummary(view: SummaryView, ctx: Ctx): string {
  const window = formatWindow(ctx.windowStart, ctx.windowEnd, { year: false });
  const n = view.items.length;
  const docs = `${view.scanned} federal ${plural(view.scanned, "document")}`;
  const parts: string[] = [];
  if (!n) parts.push(stop(`None of the ${docs} published ${window} affects ${ctx.company}`));
  else {
    parts.push(stop(`Of ${docs} published ${window}, ${n} ${n === 1 ? "affects" : "affect"} ${ctx.company}`));
    const tiers = TIERS.map((t) => [t, view.items.filter((i) => i.tier === t).length] as const).filter(([, c]) => c > 0);
    parts.push(`Priority: ${tiers.map(([t, c]) => `${c} ${t}`).join(", ")}.`);
    const unmatched = view.items.filter((i) => !i.citationVerified).length;
    parts.push(
      unmatched
        ? `Every deadline below matched the Federal Register; ${unmatched} ${plural(unmatched, "citation")} couldn't be matched and ${unmatched === 1 ? "is" : "are"} marked.`
        : "Every deadline and citation below matched the Federal Register.",
    );
  }
  const held = view.dropped.length;
  if (held) parts.push(`${held} more ${held === 1 ? "was" : "were"} held back because ${held === 1 ? "its" : "their"} dates or citation couldn't be confirmed.`);
  return parts.join(" ");
}

/** Badge counts. Each comes from its own list: the lists can sum to less than `scanned`. */
export function reportCounts(view: Pick<RunViewState, "items" | "dropped" | "screenedOut" | "notReviewedCount">) {
  const tiers = Object.fromEntries(TIERS.map((t) => [t, view.items.filter((i) => i.tier === t).length])) as Record<Tier, number>;
  return { tiers, heldBack: view.dropped.length, notRelevant: view.screenedOut.length, notReviewed: view.notReviewedCount };
}

/** "Why Critical: comment deadline in 21 days (under 90)." — the tier rule's own reason. */
export const whyTier = (item: ActionItem) => `Why ${item.tier}: ${item.tierReason.replace(/\(<\s*(\d+)\)/, "(under $1)")}.`;

const KIND: Record<Deadline["kind"], string> = { comment: "Comments due", effective: "Effective", compliance: "Comply by", other: "Date" };

export const deadlineLabel = (d: Deadline) => ({ kind: KIND[d.kind], date: format(parseISO(d.date), "MMM d, yyyy") });

/** One mailto: per owner, in report order, listing only that owner's items. */
export function draftEmails(items: ActionItem[], ctx: Ctx): { name: string; email: string; count: number; href: string }[] {
  const window = formatWindow(ctx.windowStart, ctx.windowEnd);
  return uniqueOwners(items).map((owner) => {
    const mine = items.filter((i) => i.owner.email === owner.email);
    const lines = mine.map((i, n) => {
      const d = i.deadline ? deadlineLabel(i.deadline) : null;
      const when = d ? `${d.kind} ${d.date}${i.deadline!.verified ? " (verified against the Federal Register)" : ""}` : "No dated deadline";
      return `${n + 1}. ${i.title} [${i.tier}]\n   What to do: ${i.action}\n   ${when}\n   Source: ${i.url}`;
    });
    const body = `Hi ${firstName(owner)},\n\nThese federal rules published ${window} need your review for ${ctx.company}:\n\n${lines.join("\n\n")}\n\nThanks`;
    const subject = `Federal rules for you to review: ${window} (${mine.length} ${plural(mine.length, "item")})`;
    return {
      name: ownerName(owner),
      email: owner.email,
      count: mine.length,
      href: `mailto:${encodeURI(owner.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  });
}

/** The .json download: the report as the GC sees it. Built from public run.done fields only. */
export function reportJson(view: RunViewState, ctx: { company: string }): string {
  return JSON.stringify(
    {
      company: ctx.company,
      windowStart: view.windowStart,
      windowEnd: view.windowEnd,
      asOf: view.asOf,
      scanned: view.scanned,
      items: sortItems(view.items),
      heldBack: view.dropped,
      screenedOut: view.screenedOut,
      notReviewedCount: view.notReviewedCount,
    },
    null,
    2,
  );
}
