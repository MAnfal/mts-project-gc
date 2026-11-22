import { ChartColumn, ListChecks, RotateCcw, ScrollText } from "lucide-react";
import Link from "next/link";
import { SidebarNav, SidebarNavItem, SidebarSectionLabel, SidebarWordmark } from "@/components/shell/SidebarNav";
import { Badge } from "@/components/ui/badge";
import type { EvalStory, Outcome } from "@/lib/evals/story-schema";
import { iterationNumber } from "@/lib/evals/story";
import { cn } from "@/lib/utils";

/** How each outcome reads in the iteration list (design/HiEvalSummary.dc.html: kept in green, the rest muted). */
export const OUTCOME_LABEL: Record<Outcome, string> = {
  reference: "reference",
  kept: "kept",
  promoted: "promoted",
  rejected: "rejected",
  "not promoted": "not promoted",
  next: "next, not run",
};
const KEPT: ReadonlySet<Outcome> = new Set(["kept", "promoted"]);

/** Re-exported for the eval components that already import it from here; defined in story.ts (client-safe lib). */
export { iterationNumber };

/**
 * The reviewer-facing sidebar: Summary, Iterations, Cases, Runs, and the iteration log with each outcome. Marked
 * with an "Evals" badge so it never reads as the GC's sidebar; the GC sidebar does not link here.
 * Server-safe: the page passes `active` and the parsed config/eval-story.yaml.
 */
export function EvalSidebar({ appName, story, active }: { appName: string; story: EvalStory; active: "summary" | "cases" | "runs" | string }) {
  const ids = Object.keys(story.iterations).sort();
  const onIteration = active in story.iterations;
  return (
    <SidebarNav label="Evaluation">
      <div className="flex items-center gap-2">
        <SidebarWordmark href="/evals">{appName}</SidebarWordmark>
        <Badge className="mb-2 rounded-sm bg-status-purple-surface text-status-purple-fg">Evals</Badge>
      </div>
      <SidebarNavItem href="/evals" icon={<ChartColumn />} active={active === "summary"}>
        Summary
      </SidebarNavItem>
      <SidebarNavItem href={`/evals/iterations/${ids[0]}`} icon={<RotateCcw />} active={onIteration}>
        Iterations
      </SidebarNavItem>
      <SidebarNavItem href="/evals/cases" icon={<ListChecks />} active={active === "cases"}>
        Cases
      </SidebarNavItem>
      <SidebarNavItem href="/evals/runs" icon={<ScrollText />} active={active === "runs"}>
        Runs
      </SidebarNavItem>
      <SidebarSectionLabel>Iterations</SidebarSectionLabel>
      {ids.map((id) => {
        const { label, outcome } = story.iterations[id];
        return (
          <Link
            key={id}
            href={`/evals/iterations/${id}`}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "flex min-h-[32px] items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-foreground no-underline hover:bg-nav-hover hover:text-foreground",
              active === id && "bg-nav-active font-medium",
            )}
          >
            <span className="min-w-0 truncate">
              {iterationNumber(id)} {label}
            </span>
            <span className={cn("shrink-0 text-xs", KEPT.has(outcome) ? "text-status-green-fg" : "text-caption")}>{OUTCOME_LABEL[outcome]}</span>
          </Link>
        );
      })}
    </SidebarNav>
  );
}
