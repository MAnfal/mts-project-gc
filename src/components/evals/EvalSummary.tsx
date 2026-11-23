"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EvalTargets } from "@/lib/config/schemas";
import { liveIterationId } from "@/lib/evals/cases";
import { chartSeries } from "@/lib/evals/chartSeries";
import type { EvalIndex } from "@/lib/evals/index-schema";
import { loadIndex } from "@/lib/evals/loader";
import type { EvalStory } from "@/lib/evals/story-schema";
import { fillTemplate, storyContext, verdictHeading } from "@/lib/evals/story";
import { computeVerdict } from "@/lib/evals/verdict";
import { CarlTable } from "./CarlTable";
import { ProgressChart } from "./ProgressChart";
import { Scoreboard } from "./Scoreboard";
import { StatCards } from "./StatCards";

/** Loads public/evals/index.json in the browser; the summary and iteration views share it. */
export function useEvalIndex(): { index: EvalIndex | null; error: string | null } {
  const [state, setState] = useState<{ index: EvalIndex | null; error: string | null }>({ index: null, error: null });
  useEffect(() => {
    let live = true;
    loadIndex()
      .then((index) => live && setState({ index, error: null }))
      .catch((e: Error) => live && setState({ index: null, error: e.message }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function LoadState({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="m-0 rounded-md bg-status-red-surface px-3 py-2 text-status-red-fg">
      The recorded evaluation could not be loaded: {error}
    </p>
  ) : (
    <p className="m-0 text-muted-foreground" aria-live="polite">
      Loading the recorded evaluation…
    </p>
  );
}

const LINK: Record<EvalStory["carl"]["context"]["link"], (liveId: string, firstId: string) => string> = {
  cases: () => "/evals/cases",
  iterations: (_live, first) => `/evals/iterations/${first}`,
  scoreboard: () => "#scoreboard",
  "live-iteration": (live) => `/evals/iterations/${live}`,
};

function summaryView(index: EvalIndex, story: EvalStory, targets: EvalTargets) {
  const verdict = computeVerdict(index, targets);
  const ctx = storyContext(index, verdict, story);
  const series = chartSeries(index, story);
  const liveId = liveIterationId(index) ?? index.iterations[0].id;
  const rows = (["context", "action", "result", "learning"] as const).map((k) => ({
    title: k[0].toUpperCase() + k.slice(1),
    text: fillTemplate(story.carl[k].text, ctx),
    href: LINK[story.carl[k].link](liveId, index.iterations[0].id),
    linkLabel: story.carl[k].linkLabel,
  }));
  return { verdict, ctx, series, rows, heading: verdictHeading(story, ctx, verdict), sub: fillTemplate(story.verdict.sub, ctx) };
}

/**
 * The eval summary, big picture first (design/HiEvalSummary.dc.html): the computed verdict, the CARL table,
 * the scoreboard and the iteration chart. Prose comes from config/eval-story.yaml, numbers from index.json.
 */
export function EvalSummary({ story, targets }: { story: EvalStory; targets: EvalTargets }) {
  const { index, error } = useEvalIndex();
  if (!index) return <LoadState error={error} />;

  let view;
  try {
    view = summaryView(index, story, targets);
  } catch (e) {
    // A story template or iteration entry that no longer matches the data: say which, rather than a blank page.
    return <LoadState error={`config/eval-story.yaml does not match index.json: ${(e as Error).message}`} />;
  }
  const { series, rows } = view;

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 max-w-[34ch] text-[26px] leading-snug font-bold">{view.heading}</h1>
        <p className="m-0 max-w-[74ch] text-[15px] leading-relaxed text-muted-foreground">{view.sub}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <StatCards verdict={view.verdict} story={story} targets={targets} />
        <p className="m-0 text-[13px] text-muted-foreground">
          {fillTemplate(story.cards.liveLine, view.ctx)}{" "}
          <Link href="/evals/setup">{story.cards.liveLink}</Link>
        </p>
      </div>
      <CarlTable rows={rows} />
      <section id="scoreboard" aria-labelledby="scoreboard-h" className="flex scroll-mt-4 flex-col gap-2.5">
        <h2 id="scoreboard-h" className="m-0 text-lg font-semibold">
          Scoreboard
        </h2>
        <Scoreboard index={index} story={story} targets={targets} />
      </section>
      <section aria-labelledby="chart-h" className="flex flex-col gap-2.5">
        <h2 id="chart-h" className="m-0 text-lg font-semibold">
          How it got here
        </h2>
        <div className="rounded-lg border border-border px-5 py-4">
          <ProgressChart series={series} targets={targets} />
        </div>
      </section>
    </div>
  );
}
