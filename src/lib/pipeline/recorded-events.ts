// The one mapping from a recorded run (a POC RunRecord, through recordedView) to the RunEvents a live run streams, so
// a recorded run renders with reduceEvents + ReportView like any run. Pure and browser-safe (events.ts only, no config
// or fs): src/lib/pipeline/recorded.ts uses it in Node for the GC's examples (strict public labels, the neutral reason,
// assertPublic), and the reviewer's run report (src/components/evals/RecordedReport.tsx) uses it in the browser with
// reviewerLabel, which may show internal stage ids.
import type { FilterDecision, FrDoc } from "../types";
import type { RecordedView } from "../runs/recorded-view";
import { screenedOut, STEP_LABELS, stepOf, type RunEvent, type StepKey } from "./events";

type Doc = Pick<FrDoc, "document_number" | "title">;
type Label = (stage: string) => { step: StepKey; label: string };
type Raw = { config?: { filter?: string; jevThreshold?: number }; decisions?: FilterDecision[] };

/** The reviewer's step label: the public label with the internal stage id beside it; a stage with none keeps its id. */
export function reviewerLabel(stage: string, company: string): { step: StepKey; label: string } {
  if (!(stage in STEP_LABELS)) return { step: stage as StepKey, label: stage };
  const s = stepOf(stage, company);
  return { step: s.step, label: `${s.label} (${stage})` };
}

/**
 * The run's events: run.start, each recorded stage started and done, then run.done (items as recorded, held back and
 * closest calls titled from `docs`, the frozen week) or, for a failed run, run.failed with the recorded error.
 */
export function recordedEvents(raw: unknown, v: RecordedView, docs: Doc[], label: Label): RunEvent[] {
  const rec = (raw ?? {}) as Raw;
  const steps = v.stages.map((s) => ({ ...label(s.name), ms: s.ms, count: s.outCount ?? 0 }));
  const events: RunEvent[] = [
    { type: "run.start", company: v.company, windowStart: v.windowStart, windowEnd: v.windowEnd, asOf: v.asOf, steps: steps.map(({ step, label }) => ({ step, label })) },
    ...steps.flatMap((s): RunEvent[] => [
      { type: "step.start", step: s.step, label: s.label },
      { type: "step.done", step: s.step, count: s.count, ms: s.ms },
    ]),
  ];
  if (v.status === "error") return [...events, { type: "run.failed", step: null, message: v.error ?? "The run failed." }];

  const titles = new Map(docs.map((d) => [d.document_number, d.title]));
  const decisions = new Map((rec.decisions ?? []).map((d) => [d.document_number, d]));
  // The documents run.ts sent to the LLM filter: all of them for an LLM-only filter, else those at or above the
  // relevance cut (run.ts: `(probs.get(n) ?? 0) >= cfg.jevThreshold`).
  const threshold = rec.config?.jevThreshold ?? 0;
  const sent = rec.config?.filter === "llm" ? docs.length : docs.filter((d) => (decisions.get(d.document_number)?.jevProbability ?? 0) >= threshold).length;
  return [
    ...events,
    {
      type: "run.done",
      items: v.items,
      // Held-back items record only their number; the title comes from the frozen week the run scanned.
      dropped: v.dropped.map((d) => ({ ...d, title: titles.get(d.document_number) ?? d.title })),
      screenedOut: screenedOut(docs, decisions),
      notReviewedCount: docs.length - sent,
      scanned: v.scanned ?? docs.length,
      markdown: v.markdown,
      ms: v.totalMs,
    },
  ];
}
