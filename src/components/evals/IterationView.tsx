"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { bandApplies, noiseVerdict } from "@/lib/evals/chartSeries";
import { METRICS, type EvalIndex, type Metric, type Split } from "@/lib/evals/index-schema";
import { loadIteration, type IterationFile, type IterationRecord } from "@/lib/evals/loader";
import type { EvalStory, Outcome, Quote } from "@/lib/evals/story-schema";
import { formatPoints, formatValue, resolveQuote } from "@/lib/evals/story";
import { cn } from "@/lib/utils";
import { DiffSheet } from "./DiffSheet";
import { ErrorAnalysisSheet } from "./ErrorAnalysisSheet";
import { LoadState, useEvalIndex } from "./EvalSummary";
import { OUTCOME_LABEL, iterationNumber } from "./EvalSidebar";
import { shortSuite } from "./Scoreboard";

type SetupResult = EvalIndex["live"];
type Iteration = EvalIndex["iterations"][number];

const OUTCOME_CLASS: Record<Outcome, string> = {
  reference: "bg-status-blue-surface text-status-blue-fg",
  kept: "bg-status-green-surface text-status-green-fg",
  promoted: "bg-status-green-surface text-status-green-fg",
  rejected: "bg-status-neutral-surface text-status-neutral-fg",
  "not promoted": "bg-status-neutral-surface text-status-neutral-fg",
  next: "bg-status-purple-surface text-status-purple-fg",
};
const TAG_CLASS = { fixed: "bg-status-green-surface text-status-green-fg", better: "bg-status-green-surface text-status-green-fg", worse: "bg-status-orange-surface text-status-orange-fg" };
const TAG_TEXT = { fixed: "Fixed", better: "Better", worse: "Worse" };
/** suiteReport's own nine metrics (the collapsible); score, cost and time are not among them. */
const NINE: Metric[] = METRICS.filter((m) => !["score", "costPerRunUsd", "secondsPerRun"].includes(m));
const SPLIT_TEXT: Record<Exclude<Split, "all">, string> = { dev: "tuning", test: "held-out" };

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="m-0 text-[15px] font-semibold text-foreground">{title}</h2>
        {aside ? <span className="text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Recall, precision, dates right, cost · time: candidate vs the setup it replaced, all weeks, gaps against the band. */
function ResultTable({ index, it, c, p, story }: { index: EvalIndex; it: Iteration; c: SetupResult; p: SetupResult | null; story: EvalStory }) {
  const applies = it.suite ? bandApplies(index, it.suite) : false;
  const nb = index.noiseBand;
  const change = (m: Metric) => {
    if (!p) return null;
    const a = c[m].all.value;
    const b = p[m].all.value;
    if (a === null || b === null) return "—";
    const word = noiseVerdict(a - b, applies ? nb?.measures[m].value : null);
    const sign = a - b > 0 ? "+" : a - b < 0 ? "−" : "±";
    return word === "no change" ? "no change" : `${sign}${formatPoints(a - b)}${word ? ` · ${word}` : ""}`;
  };
  const costA = c.costPerRunUsd.all.value;
  const costB = p?.costPerRunUsd.all.value ?? null;
  const costChange = costA !== null && costB ? (costA - costB) / costB : null;
  const td = "px-4 py-2.5";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] border-collapse tabular-nums">
        <thead>
          <tr className="bg-secondary text-right">
            <th scope="col" className={`${td} text-left font-semibold`}>Measure</th>
            <th scope="col" className={`${td} font-semibold`}>{c.label}</th>
            {p ? <th scope="col" className={`${td} font-semibold`}>{p.label}</th> : null}
            {p ? <th scope="col" className={`${td} font-semibold`}>Change</th> : null}
          </tr>
        </thead>
        <tbody className="text-right">
          {(["recall", "precision", "datesRight"] as const).map((m) => (
            <tr key={m} className="border-t border-row-border">
              <th scope="row" className={`${td} text-left font-normal`}>{story.measures[m]}</th>
              <td className={`${td} font-semibold`}>{formatValue(m, c[m].all.value)}</td>
              {p ? <td className={td}>{formatValue(m, p[m].all.value)}</td> : null}
              {p ? <td className={`${td} whitespace-nowrap text-muted-foreground`}>{change(m)}</td> : null}
            </tr>
          ))}
          <tr className="border-t border-row-border">
            <th scope="row" className={`${td} text-left font-normal`}>Cost · time per run</th>
            <td className={`${td} font-semibold`}>
              {formatValue("costPerRunUsd", costA)} · {formatValue("secondsPerRun", c.secondsPerRun.all.value)}
            </td>
            {p ? (
              <td className={td}>
                {formatValue("costPerRunUsd", costB)} · {formatValue("secondsPerRun", p.secondsPerRun.all.value)}
              </td>
            ) : null}
            {p ? (
              <td className={td}>
                {costChange === null ? (
                  "—"
                ) : (
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 font-semibold whitespace-nowrap",
                      costChange > 0 ? "bg-status-orange-surface text-status-orange-fg" : "bg-status-green-surface text-status-green-fg",
                    )}
                  >
                    {costChange > 0 ? "+" : "−"}
                    {Math.abs(Math.round(costChange * 100))}% cost
                  </span>
                )}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NoiseNote({ index, it }: { index: EvalIndex; it: Iteration }) {
  const nb = index.noiseBand;
  if (!nb) return <p className="m-0 text-[13px] text-caption">No noise band: the data has no unchanged control run in two suites, so no gap is called within or beyond noise.</p>;
  const size = (id: string) => index.suites.find((s) => s.id === id)?.evalsets.length;
  const band = `${nb.setup} re-run unchanged in ${nb.suites.map(shortSuite).join(" and ")}: recall swung ${formatPoints(nb.measures.recall.value ?? 0)}, precision ${formatPoints(nb.measures.precision.value ?? 0)}`;
  return it.suite && bandApplies(index, it.suite) ? (
    <p className="m-0 text-[13px] text-caption">Noise band: {band}. A gap under the band is within noise.</p>
  ) : (
    <p className="m-0 text-[13px] text-caption">
      No noise verdict here: this suite has {it.suite ? size(it.suite) : "no"} company-weeks, and the band ({band}) was measured on suites of{" "}
      {size(nb.suites[0])}.
    </p>
  );
}

function AllMeasures({ c, p, story }: { c: SetupResult; p: SetupResult | null; story: EvalStory }) {
  const td = "px-3 py-2";
  const cols: [SetupResult, Exclude<Split, "all">][] = [
    [c, "dev"],
    [c, "test"],
    ...(p ? ([[p, "dev"], [p, "test"]] as [SetupResult, Exclude<Split, "all">][]) : []),
  ];
  return (
    <Collapsible className="flex flex-col gap-2">
      <CollapsibleTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start [&[data-panel-open]_svg]:rotate-180")}>
        All {NINE.length} measures, tuning vs held-out
        <ChevronDown />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse tabular-nums">
            <thead>
              <tr className="bg-secondary text-right">
                <th scope="col" className={`${td} text-left font-semibold`}>Measure</th>
                {cols.map(([r, sp]) => (
                  <th key={`${r.setup}-${sp}`} scope="col" className={`${td} font-semibold`}>
                    {r.setup}, {SPLIT_TEXT[sp]} ({r.runCounts[sp].graded} runs)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-right">
              {NINE.map((m) => (
                <tr key={m} className="border-t border-row-border">
                  <th scope="row" className={`${td} text-left font-normal`}>{story.measures[m]}</th>
                  {cols.map(([r, sp]) => (
                    <td key={`${r.setup}-${sp}`} className={td}>
                      {formatValue(m, r[m][sp].value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[13px] text-caption">
          Tuning weeks were looked at while choosing changes; held-out weeks never were. Judge panel results cover first repeats only.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A moved item's quote, resolved verbatim; a quote that no longer resolves shows why instead of crashing the page. */
function Quoted({ rec, quote }: { rec: IterationRecord; quote: Quote }) {
  let text: string;
  try {
    text = resolveQuote(rec, quote);
  } catch (e) {
    return (
      <span role="alert" className="text-[13px] text-status-red-fg">
        Quote unavailable: {(e as Error).message} (config/eval-story.yaml)
      </span>
    );
  }
  return (
    <q className="text-[13px] text-muted-foreground">
      {text}
      <span className="sr-only"> (quoted from the recorded {quote.from})</span>
    </q>
  );
}

/**
 * One iteration (design/HiEvalIteration.dc.html): outcome, why and change, the result against the setup it
 * replaced, what moved, the decision, and the evidence. Recorded text comes from iteration.json verbatim;
 * numbers from index.json; labels and outcomes from config/eval-story.yaml.
 */
export function IterationView({ id, story }: { id: string; story: EvalStory }) {
  const { index, error } = useEvalIndex();
  const [record, setRecord] = useState<{ rec: IterationRecord | null; error: string | null }>({ rec: null, error: null });
  const known = index?.iterations.some((i) => i.id === id) ?? false;
  useEffect(() => {
    if (!known) return;
    let live = true;
    loadIteration(id)
      .then((rec) => live && setRecord({ rec, error: null }))
      .catch((e: Error) => live && setRecord({ rec: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [id, known]);

  if (!index) return <LoadState error={error} />;
  const it = index.iterations.find((i) => i.id === id);
  const s = story.iterations[id];
  if (!it || !s)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-2xl font-bold">No such iteration</h1>
        <p className="m-0 text-muted-foreground">The recorded evaluation has no iteration “{id}”.</p>
        <Link href="/evals">Back to the summary</Link>
      </div>
    );
  if (!record.rec) return <LoadState error={record.error} />;
  const rec = record.rec;
  const isLive = it.setup === index.live.setup;
  const badge = isLive && s.outcome === "promoted" ? "Promoted to live" : OUTCOME_LABEL[s.outcome][0].toUpperCase() + OUTCOME_LABEL[s.outcome].slice(1);
  const m = it.measured;
  const diffs = (["config.diff", "system.diff"] as IterationFile[]).filter((f) => (f === "config.diff" ? it.evidence.configDiff : it.evidence.systemDiff));
  const evalsets = it.suite ? index.suites.find((x) => x.id === it.suite)?.evalsets.length : undefined;

  return (
    <div className="flex flex-col gap-[26px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grow font-semibold">
          Iteration {iterationNumber(id)} · {s.label}
          {it.date ? ` · ${it.date}` : ""}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 font-semibold", OUTCOME_CLASS[s.outcome])}>{badge}</span>
      </div>
      <h1 className="m-0 max-w-[48ch] text-2xl leading-snug font-bold">{it.title ?? "Evidence for the next change (not run)"}</h1>

      {it.evidenceOnly ? (
        <p className="m-0 max-w-[74ch] leading-relaxed text-muted-foreground">
          Not run. This iteration holds evidence only: the error analysis of the live setup that the next change would start from.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Why">
            <p className="m-0 leading-relaxed whitespace-pre-line">{rec.hypothesis ?? "—"}</p>
          </Section>
          <Section title="Change">
            <p className="m-0 leading-relaxed whitespace-pre-line">{rec.change ?? "—"}</p>
          </Section>
        </div>
      )}

      {m ? (
        <Section
          title={m.comparedTo ? "Result against the setup it replaced" : "Result (reference point)"}
          aside={`suite ${it.suite ? shortSuite(it.suite) : "—"} · ${m.candidate.runCounts.all.graded}${m.comparedTo ? ` and ${m.comparedTo.runCounts.all.graded}` : ""} graded runs · all ${evalsets ?? "—"} company-weeks`}
        >
          <ResultTable index={index} it={it} c={m.candidate} p={m.comparedTo} story={story} />
          {m.comparedTo ? <NoiseNote index={index} it={it} /> : null}
          <AllMeasures c={m.candidate} p={m.comparedTo} story={story} />
        </Section>
      ) : null}

      {s.moved.length ? (
        <Section title="What actually moved">
          <ul className="m-0 flex list-none flex-col gap-3 p-0 leading-relaxed">
            {s.moved.map((x, i) => (
              <li key={i} className="flex gap-2.5">
                <span className={cn("mt-0.5 h-5 shrink-0 rounded-sm px-1.5 text-xs leading-5 font-semibold", TAG_CLASS[x.tag])}>{TAG_TEXT[x.tag]}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span>{x.text}</span>
                  {x.quote ? <Quoted rec={rec} quote={x.quote} /> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[13px] text-caption">
            Quoted text is verbatim from the iteration&apos;s recorded{" "}
            {[...new Set(s.moved.flatMap((x) => (x.quote ? [x.quote.from] : [])))].join(" and ")}.
          </p>
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {m ? (
          <Link href={`/evals/cases?iteration=${encodeURIComponent(id)}`} className={cn(buttonVariants(), "no-underline")}>
            Cases that changed
          </Link>
        ) : null}
        {it.evidence.errorAnalysis ? <ErrorAnalysisSheet iterationId={id} /> : null}
        {diffs.length ? <DiffSheet iterationId={id} files={diffs} /> : null}
      </div>

      {rec.decision ? (
        <section className="flex flex-col gap-1.5 rounded-lg bg-secondary px-[18px] py-4">
          <h2 className="m-0 text-[15px] font-semibold text-foreground">Decision: {OUTCOME_LABEL[s.outcome]}</h2>
          <p className="m-0 max-w-[80ch] leading-relaxed">{rec.decision}</p>
          {rec.notes ? (
            <Collapsible className="mt-1">
              <CollapsibleTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 [&[data-panel-open]_svg]:rotate-180")}>
                Recorded notes
                <ChevronDown />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="m-0 mt-1 max-w-[80ch] leading-relaxed text-muted-foreground">{rec.notes}</p>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
