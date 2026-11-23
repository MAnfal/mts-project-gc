import type { EvalTargets } from "@/lib/config/schemas";
import type { EvalStory } from "@/lib/evals/story-schema";
import { formatShare, formatValue } from "@/lib/evals/story";
import type { ScoreMeasure, TargetStatus, Verdict } from "@/lib/evals/verdict";
import { cn } from "@/lib/utils";

/** The headline measures, in card order. Each must be a scoreboard measure, so the verdict has compared it. */
const CARDS: ScoreMeasure[] = ["recall", "precision", "datesRight", "costPerRunUsd"];

const STATUS: Record<Exclude<TargetStatus, "unmeasured">, { cls: string; text: (t: string) => string }> = {
  met: { cls: "bg-status-green-surface text-status-green-fg", text: (t) => `meets the ${t} target` },
  near: { cls: "bg-status-yellow-surface text-status-yellow-fg", text: (t) => `within a point of the ${t} target` },
  missed: { cls: "bg-status-red-surface text-status-red-fg", text: (t) => `below the ${t} target` },
};

const splitText = (s: string) => (s === "all" ? "all weeks" : s === "test" ? "held-out weeks" : "tuning weeks");

/**
 * The summary's big numbers: live (all weeks) beside the baseline, for the measures a reviewer asks about first.
 * Values and statuses come from computeVerdict (the scoreboard's own comparison), so the cards can't disagree with
 * the table under them; each names its split and run count.
 */
export function StatCards({ verdict, story, targets }: { verdict: Verdict; story: EvalStory; targets: EvalTargets }) {
  const cards = CARDS.flatMap((m) => {
    const c = verdict.baseline.comparisons.find((x) => x.measure === m);
    return c ? [c] : [];
  });
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
      {cards.map(({ measure, live, baseline }) => {
        const t = verdict.targets.find((x) => x.measure === measure);
        const status = t && t.measure !== "beatsBaseline" && t.status !== "unmeasured" ? STATUS[t.status] : null;
        return (
          <li key={measure} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5">
            <span className="text-[13px] leading-snug text-muted-foreground">{story.measures[measure]}</span>
            <span className="text-[30px] leading-none font-bold tracking-[-0.02em] text-heading tabular-nums">{formatValue(measure, live.value)}</span>
            {status && measure in targets ? (
              <span className={cn("self-start rounded-sm px-1.5 py-0.5 text-xs font-semibold", status.cls)}>
                {status.text(formatShare(targets[measure as keyof EvalTargets] as number))}
              </span>
            ) : null}
            <span className="text-[13px] text-muted-foreground tabular-nums">
              Baseline {formatValue(measure, baseline.value)} · {baseline.runs} runs
            </span>
            <span className="text-xs text-caption">
              {splitText(live.split)} · {live.runs} runs
            </span>
          </li>
        );
      })}
    </ul>
  );
}
