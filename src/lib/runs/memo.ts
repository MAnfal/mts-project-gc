// The "no action" memo a GC downloads when nothing applies, and the held-back section any report download carries.
// Written in code from the run's own lists: no model writes any of it. Pure: no React, no I/O.
import { format, parseISO } from "date-fns";
import { frDocUrl, type RunViewState } from "./reduce";
import { closestCalls, emptySummary, formatWindow } from "./report";

interface Ctx {
  company: string;
  windowStart: string;
  windowEnd: string;
}

type HeldView = Pick<RunViewState, "dropped" | "checkedByYou">;

/** "## Held back for you to check" and "## Added by you after checking"; "" when the run has neither. */
export function heldBackSection(view: HeldView): string {
  const parts: string[] = [];
  if (view.dropped.length)
    parts.push(
      "## Held back for you to check",
      "",
      "These looked relevant but failed verification, so they are not in the report.",
      "",
      ...view.dropped.map((d) => `- ${d.title} (${d.document_number}): ${d.reason} ${frDocUrl(d.document_number)}`),
      "",
    );
  if (view.checkedByYou.length)
    parts.push(
      "## Added by you after checking",
      "",
      "Not tiered, and their dates were not verified against the Federal Register.",
      "",
      ...view.checkedByYou.map((d) => `- ${d.title} (${d.document_number}): ${d.url}`),
      "",
    );
  return parts.join("\n");
}

/** The run's report markdown with the held-back section appended, when there is one. */
export function withHeldBack(markdown: string, view: HeldView): string {
  const section = heldBackSection(view);
  return section ? `${markdown.replace(/\n*$/, "\n")}\n${section}` : markdown;
}

/** The memo for a run in which nothing applies: window, count checked, closest calls, and anything held back. */
export function noActionMemo(view: Pick<RunViewState, "scanned" | "screenedOut" | "asOf" | "dropped" | "checkedByYou">, ctx: Ctx): string {
  const calls = closestCalls(view);
  const asOf = view.asOf ? ` (as of ${format(parseISO(view.asOf), "MMM d, yyyy")})` : "";
  const lines = [
    `# No action needed: ${ctx.company}`,
    "",
    `Federal Register documents published ${formatWindow(ctx.windowStart, ctx.windowEnd)}${asOf}.`,
    "",
    emptySummary(view, ctx),
    "",
    "## Closest calls",
    "",
    ...(calls.length ? calls.map((c, i) => `${i + 1}. ${c.title} (${c.document_number}): ${c.reason}`) : ["No document came close: none reached the final screening."]),
    "",
  ];
  const held = heldBackSection(view);
  return held ? `${lines.join("\n")}\n${held}` : lines.join("\n");
}
