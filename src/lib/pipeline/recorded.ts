import "server-only";
import { CompanySchema, frozenWeek, presets } from "../config";
import { recordedView } from "../runs/recorded-view";
import type { ExampleRun, ExampleSummary } from "../runs/types";
import type { CompanyProfile, FilterDecision } from "../types";
import { assertPublic, screenedOut, stepOf, type RunEvent } from "./events";
import { NEUTRAL_REASON } from "./stages";

// Projects a recorded example run (public/evals/user-view/runs/<id>.json, a POC RunRecord) into the public events a
// live run streams, so the GC's example pages render it with reduceEvents + ReportView like any run. Server-only: it
// reads the frozen week and the presets from config/, and only it, never the browser, sees the record's internal
// fields. Run by scripts/build-examples.mts, which writes the result to public/examples/.
//
// The items, tiers, owners and dates come through recordedView (src/lib/runs/recorded-view.ts), the same mapping the
// reviewer's report uses. What this adds is the public side: step labels from STEP_LABELS, the closest calls,
// the neutral reason in place of the POC's leaked relevance score, and assertPublic on every event.

/**
 * The POC's fallback reason for an item the LLM filter gave no reason for: the internal component's name and its
 * relevance score, then "(no LLM reason)" (poc:poc/src/lib/pipeline/stages.ts, line 281). Matched by shape: chunk 03's
 * Gate 2 bans that text anywhere in src/.
 */
const LEAKED_REASON = /^\S+ p=\d+(?:\.\d+)? \(no LLM reason\)$/;

type Record_ = { config?: { filter?: string; jevThreshold?: number }; decisions?: FilterDecision[] };

/** The profile the run used: its custom profile, or the preset it names. Throws for anything else. */
function profileOf(id: string, raw: { config?: { profileId?: string; customProfile?: unknown } }): CompanyProfile {
  const c = raw.config ?? {};
  if (c.customProfile) return CompanySchema.parse(c.customProfile);
  const preset = presets().find((p) => p.id === c.profileId);
  if (!preset) throw new Error(`Example ${id}: company "${c.profileId}" is not a preset and the run carries no custom profile`);
  return preset;
}

/** One finished example run as the GC sees it. Throws for a failed run, an unknown company, or any internal name. */
export function projectRecordedRun(raw: unknown): ExampleRun {
  const names = Object.fromEntries(presets().map((p) => [p.id, p.name]));
  const v = recordedView(raw, { companyNames: names });
  if (v.status !== "done") throw new Error(`Example ${v.id} is a failed run; only finished runs become examples`);
  const docs = frozenWeek(v.windowStart, v.windowEnd);
  if (!docs) throw new Error(`Example ${v.id}: no frozen week ${v.windowStart}..${v.windowEnd} to take titles from`);
  const titles = new Map(docs.map((d) => [d.document_number, d.title]));
  const profile = profileOf(v.id, raw as Parameters<typeof profileOf>[1]);

  const rec = raw as Record_;
  const decisions = new Map((rec.decisions ?? []).map((d) => [d.document_number, d]));
  // The documents run.ts sent to the LLM filter: all of them for an LLM-only filter, else those at or above the
  // relevance cut (run.ts: `(probs.get(n) ?? 0) >= cfg.jevThreshold`).
  const threshold = rec.config?.jevThreshold ?? 0;
  const sent = rec.config?.filter === "llm" ? docs.length : docs.filter((d) => (decisions.get(d.document_number)?.jevProbability ?? 0) >= threshold).length;

  const steps = v.stages.map((s) => ({ ...stepOf(s.name, v.company), ms: s.ms, count: s.outCount ?? 0 }));
  const events: RunEvent[] = [
    { type: "run.start", company: v.company, windowStart: v.windowStart, windowEnd: v.windowEnd, asOf: v.asOf, steps: steps.map(({ step, label }) => ({ step, label })) },
    ...steps.flatMap((s): RunEvent[] => [
      { type: "step.start", step: s.step, label: s.label },
      { type: "step.done", step: s.step, count: s.count, ms: s.ms },
    ]),
    {
      type: "run.done",
      items: v.items.map((i) => (LEAKED_REASON.test(i.reason) ? { ...i, reason: NEUTRAL_REASON } : i)),
      // Held-back items record only their number; the title comes from the frozen week the run scanned.
      dropped: v.dropped.map((d) => ({ ...d, title: titles.get(d.document_number) ?? d.title })),
      screenedOut: screenedOut(docs, decisions),
      notReviewedCount: docs.length - sent,
      scanned: v.scanned ?? docs.length,
      markdown: v.markdown,
      ms: v.totalMs,
    },
  ];
  events.forEach(assertPublic);
  return { id: v.id, company: v.company, windowStart: v.windowStart, windowEnd: v.windowEnd, items: v.items.length, profile, events };
}

/** public/examples/index.json: newest first by id (ids start with the run's timestamp), listing fields only. */
export const exampleIndex = (examples: ExampleRun[]): ExampleSummary[] =>
  [...examples].sort((a, b) => b.id.localeCompare(a.id)).map(({ id, company, windowStart, windowEnd, items }) => ({ id, company, windowStart, windowEnd, items }));
