"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvalTargets } from "@/lib/config/schemas";
import type { AgreementNumber, EvalIndex, LabelledNumber } from "@/lib/evals/index-schema";
import type { EvalStory } from "@/lib/evals/story-schema";
import { formatShare, formatValue } from "@/lib/evals/story";
import { measureOf, SCOREBOARD_MEASURES, targetStatus, type TargetStatus } from "@/lib/evals/verdict";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<Exclude<TargetStatus, "unmeasured">, string> = {
  met: "bg-status-green-surface text-status-green-fg",
  near: "bg-status-yellow-surface text-status-yellow-fg",
  missed: "bg-status-red-surface text-status-red-fg",
};
const STATUS_TEXT: Record<TargetStatus, string> = { met: "met", near: "within a point", missed: "missed", unmeasured: "not measured" };

/** "arena-2026-11-21-22-52-l92" → "l92": suites are named by their short id on screen, in full in tooltips. */
export const shortSuite = (id: string) => id.split("-").at(-1) ?? id;

/** What a number was computed over: split, run count, suite(s); agreement numbers add their numerator. */
export function provenance(n: LabelledNumber | AgreementNumber): string {
  const split = n.split === "all" ? "all weeks" : n.split === "test" ? "held-out weeks" : "tuning weeks";
  const ratio = "numerator" in n ? `${n.numerator} of ${n.denominator} cases · ` : "";
  return `${ratio}${split} · ${n.runs} runs · ${n.suite.join(" + ")}`;
}

function Value({ measure, n, status }: { measure: string; n: LabelledNumber | AgreementNumber | undefined; status?: TargetStatus }) {
  if (!n || n.value === null) return <span className="text-caption">—</span>;
  const text = formatValue(measure, n.value);
  const badge = status && status !== "unmeasured" ? STATUS_CLASS[status] : null;
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn("cursor-help rounded-sm px-2 py-0.5 tabular-nums", badge ? `${badge} font-semibold` : "")}
        aria-label={`${text}${status ? `, target ${STATUS_TEXT[status]}` : ""} (${provenance(n)})`}
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>{provenance(n)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Measure | Target | Live, all weeks | Held-out | Baseline. Live cells carry a status badge against the
 * config target (met green, within nearMiss yellow, missed red). Every value names its split, runs and suites
 * on hover, and the footnote states them for the whole table.
 */
export function Scoreboard({ index, story, targets }: { index: EvalIndex; story: EvalStory; targets: EvalTargets }) {
  const { live, baseline } = index;
  const target = (m: string) => (m in targets && m !== "nearMiss" && m !== "beatsBaseline" ? (targets[m as keyof EvalTargets] as number) : null);
  const agreementRuns = (r: EvalIndex["live"]) => r.relevanceAgreement.all.runs;
  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse tabular-nums">
          <thead>
            <tr className="bg-secondary text-right">
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">Measure</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Target</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Live, all weeks</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Held-out</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Baseline</th>
            </tr>
          </thead>
          <tbody className="text-right">
            {SCOREBOARD_MEASURES.map((m) => {
              const min = target(m);
              const all = measureOf(live, m, "all");
              const test = measureOf(live, m, "test");
              return (
                <tr key={m} className="border-t border-row-border">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">{story.measures[m]}</th>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{min === null ? "—" : min === 1 ? "100%" : `≥ ${formatShare(min)}`}</td>
                  <td className="px-4 py-2.5">
                    <Value measure={m} n={all} status={min === null ? undefined : targetStatus(all?.value, min, targets.nearMiss)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Value measure={m} n={test} status={min === null ? undefined : targetStatus(test?.value, min, targets.nearMiss)} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <Value measure={m} n={measureOf(baseline, m, "all")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-caption">
        Live = {live.setup}, all weeks {live.runCounts.all.graded} graded runs pooled over {live.suite.map(shortSuite).join(" + ")}; held-out{" "}
        {live.runCounts.test.graded} runs. Baseline = {baseline.setup}, {baseline.runCounts.all.graded} graded runs pooled over{" "}
        {baseline.suite.map(shortSuite).join(" + ")}, graded by the same code. Cost averages over every run ({live.runCounts.all.total} live,{" "}
        {baseline.runCounts.all.total} baseline). Agreement compares the finished repeats of each company-week within one suite (
        {agreementRuns(live)} live runs, {agreementRuns(baseline)} baseline): relevance counts a keyed document as agreeing when every
        repeat flagged it or none did; tier counts a document flagged in every repeat as agreeing when each gave it the same tier. Dates
        right means a date on the card matches the hand-checked answer key. Hover a value for its exact basis.
      </p>
    </TooltipProvider>
  );
}
