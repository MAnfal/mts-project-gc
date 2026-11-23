"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SPLIT_WORD } from "@/lib/evals/cases";
import { COMPARED, modelComparisons, type ModelGroup } from "@/lib/evals/models";
import type { EvalStory } from "@/lib/evals/story-schema";
import { modelsStory, shortSuite, type JudgePanel } from "@/lib/evals/story";
import { formatWindow } from "@/lib/runs/report";
import { cn } from "@/lib/utils";
import { LoadState, useEvalIndex } from "./EvalSummary";
import { Value } from "./Scoreboard";

/** The table's measure columns, in the order the acceptance criteria name them. */
const COLUMNS = COMPARED;

/** "2026-11-02_2026-11-06" (a frozen week's id) → "Nov 2–6, 2026". */
const weekOf = (id: string) => {
  const [start, end] = id.split("_");
  return end ? formatWindow(start, end) : id;
};

const casesHref = (suite: string, setup: string) => `/evals/cases?suite=${encodeURIComponent(suite)}&setup=${encodeURIComponent(setup)}`;

/**
 * One suite's setups side by side (rows are setups, as recorded): Setup | Model | Method · prompt | the compared
 * measures | Runs. Only the winner row (the one the live setup came from) is highlighted; rows on the live model carry a badge. Every value names its split, runs and suite on hover;
 * each setup links to its cases in this suite. Scrolls inside its own box on a narrow screen.
 */
export function ModelTable({ group, story }: { group: ModelGroup; story: EvalStory }) {
  const th = "px-3 py-2.5 font-semibold align-bottom";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[980px] border-collapse tabular-nums">
        <thead>
          <tr className="bg-secondary text-right">
            <th scope="col" className={`${th} text-left`}>
              Setup
            </th>
            <th scope="col" className={`${th} text-left`}>
              Model
            </th>
            <th scope="col" className={`${th} text-left`}>
              Method · prompt
            </th>
            {COLUMNS.map((m) => (
              <th key={m} scope="col" className={th}>
                {story.measures[m]}
              </th>
            ))}
            <th scope="col" className={th}>
              Runs
            </th>
          </tr>
        </thead>
        <tbody className="text-right">
          {group.rows.map((r) => {
            const counts = r.result.runCounts.all;
            return (
              <tr key={r.setup} className={cn("border-t border-row-border", r.winner && "bg-status-blue-surface")}>
                <th scope="row" className="min-w-[190px] px-3 py-2.5 text-left font-normal">
                  <Link href={casesHref(group.suite, r.setup)} className="font-semibold whitespace-nowrap" aria-label={`${r.setup}: open its cases in suite ${shortSuite(group.suite)}`}>
                    {r.setup}
                  </Link>
                  {r.winner ? <Badge className="ml-1.5 rounded-sm bg-status-blue-fg text-primary-foreground">Winner</Badge> : null}
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                </th>
                <td className="px-3 py-2.5 text-left whitespace-nowrap">
                  {r.modelLabel}
                  {r.live ? <Badge variant="outline" className="ml-1.5 rounded-sm">live model</Badge> : null}
                </td>
                <td className="px-3 py-2.5 text-left whitespace-nowrap">
                  {r.method} · {r.promptSet ?? "default"}
                </td>
                {COLUMNS.map((m) => (
                  <td key={m} className="px-3 py-2.5 whitespace-nowrap">
                    <Value measure={m} n={r.result[m].all} />
                    {m === "judgePass" ? <div className="text-xs text-muted-foreground">{r.result.judgePass.all.runs} runs judged</div> : null}
                  </td>
                ))}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {counts.total}
                  {counts.finished < counts.total ? <div className="text-xs text-muted-foreground">{counts.finished} finished</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="m-0 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * /evals/models: why the live model, each multi-model suite's table, the suites that ran one model, the caveats and
 * the judge panel. Numbers come from index.json (models.ts); prose from config/eval-story.yaml (models section),
 * filled by modelsStory; the judge panel from config/judges.yaml, read by the page.
 */
export function ModelsView({ story, judges }: { story: EvalStory; judges: JudgePanel }) {
  const { index, error } = useEvalIndex();
  if (!index) return <LoadState error={error} />;
  let cmp;
  try {
    cmp = modelComparisons(index);
  } catch (e) {
    return <LoadState error={(e as Error).message} />;
  }
  let prose: ReturnType<typeof modelsStory> | null = null;
  let proseError: string | null = null;
  try {
    prose = modelsStory(index, judges, story, cmp);
  } catch (e) {
    // A models sentence the data can't fill (e.g. no like-for-like pair): say which, and still show the tables.
    proseError = `config/eval-story.yaml does not match index.json: ${(e as Error).message}`;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-[30px]">
        {prose ? (
          <Section id="why-h" title={prose.heading}>
            <p className="m-0 max-w-[74ch] leading-relaxed">{prose.intro}</p>
            <ul className="m-0 flex max-w-[74ch] flex-col gap-1.5 list-disc pl-5 leading-relaxed">
              {prose.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="m-0 max-w-[74ch] leading-relaxed text-muted-foreground">{prose.closing}</p>
          </Section>
        ) : (
          <LoadState error={proseError} />
        )}

        {cmp.groups.map((g) => (
          <SuiteGroup key={g.suite} group={g} story={story} liveRule={prose?.liveRule ?? null} />
        ))}

        {cmp.singleModel.length ? (
          <Section id="single-h" title={story.models.singleModel}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
              {cmp.singleModel.map((s) => (
                <li key={s.suite} className="[overflow-wrap:anywhere]">
                  <span className="font-semibold">{shortSuite(s.suite)}</span> <span className="text-muted-foreground">{s.suite}</span> · {s.models.join(", ") || "no results"}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {prose ? (
          <Section id="caveats-h" title="Caveats">
            <ul className="m-0 flex max-w-[74ch] flex-col gap-1.5 list-disc pl-5 leading-relaxed">
              {prose.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section id="judges-h" title="Judge panel">
          {prose ? <p className="m-0 max-w-[74ch] leading-relaxed">{prose.judges}</p> : null}
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {judges.models.map((m) => (
              <li key={m} className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[13px]">
                {m}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </TooltipProvider>
  );
}

/** A suite's name, weeks (with their split) and run counts, then its table and the live-row rule. */
function SuiteGroup({ group, story, liveRule }: { group: ModelGroup; story: EvalStory; liveRule: string | null }) {
  const perSetup = [...new Set(group.rows.map((r) => r.result.runCounts.all.total))];
  return (
    <Section id={`suite-${shortSuite(group.suite)}-h`} title={`Suite ${shortSuite(group.suite)}: ${group.models.join(" vs ")}`}>
      <p className="m-0 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {group.suite} · {group.weeks.length} weeks:{" "}
        {group.weeks.map((w, i) => (
          <span key={w.id}>
            {i ? ", " : ""}
            {weekOf(w.id)} ({SPLIT_WORD[w.split]})
          </span>
        ))}{" "}
        · {group.evalsets} company-weeks · {group.runs} runs over {group.rows.length} setups
        {perSetup.length === 1 ? ` (${perSetup[0]} each)` : ""}
      </p>
      {liveRule && group.rows.some((r) => r.winner) ? <p className="m-0 max-w-[74ch] text-sm leading-relaxed">{liveRule}</p> : null}
      <ModelTable group={group} story={story} />
      <p className="m-0 text-[13px] leading-relaxed text-caption">
        All values are over this suite&apos;s weeks only. Recall, precision and dates are over graded runs;
        the judge panel judged only the first repeat of each company-week, so its pass rate rests on the runs judged; cost averages
        over every run and time over finished runs. Hover a value for its exact basis; open a setup for its cases.
      </p>
    </Section>
  );
}
