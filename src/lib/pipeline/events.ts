// The public contract of a run: what the server streams to the GC's browser. Everything a GC reads about a run
// comes from these events. Step names come only from STEP_LABELS; documents and items carry only their own
// fields. assertPublic guards every event on its way out. This module has no server imports, so the browser
// can import its types.
import type { ActionItem, FilterDecision, FrDoc } from "../types";

export type StepKey = "scan" | "rank" | "read" | "screen" | "verify" | "write";

/** A document the run looked at but didn't report, with a one-line reason for the GC. */
export interface DocNote {
  document_number: string;
  title: string;
  reason: string;
}

export type RunEvent =
  | { type: "run.start"; company: string; windowStart: string; windowEnd: string; asOf: string; steps: { step: StepKey; label: string }[] }
  | { type: "step.start"; step: StepKey; label: string }
  | { type: "step.progress"; step: StepKey; count: number; title: string }
  | { type: "step.retry"; step: StepKey; attempt: number; delayMs: number }
  | { type: "step.done"; step: StepKey; count: number; ms: number }
  | { type: "step.failed"; step: StepKey; label: string; message: string }
  /** An item passed verification and tiering. Its `action` is still empty: actions are written last. */
  | { type: "item.confirmed"; item: ActionItem }
  | {
      type: "run.done";
      items: ActionItem[];
      /** Relevant, but failed verification: shown to the GC as held back. */
      dropped: DocNote[];
      /** Every document the LLM filter rejected, most relevant first. */
      screenedOut: DocNote[];
      /** Documents below the relevance cut, never sent to the LLM filter. */
      notReviewedCount: number;
      scanned: number;
      markdown: string;
      ms: number;
    }
  | { type: "run.failed"; step: StepKey | null; message: string };

/** Internal stage id (the POC's trace names) → the step key and label a GC sees. `{company}` is the profile's name. */
export const STEP_LABELS: Record<string, { step: StepKey; label: string }> = {
  "scan:federal-register": { step: "scan", label: "Scanned the Federal Register" },
  "filter:jev": { step: "rank", label: "Ranked them by relevance to {company}" },
  "filter:passages": { step: "read", label: "Read the key passages of the top matches" },
  "filter:llm": { step: "screen", label: "Screened them against {company}'s profile" },
  "verify+tier": { step: "verify", label: "Checked dates and citations against the Federal Register" },
  "output:actions": { step: "write", label: "Wrote an action for each item" },
};

export function stepOf(stage: string, company: string): { step: StepKey; label: string } {
  const s = STEP_LABELS[stage];
  if (!s) throw new Error(`Stage "${stage}" has no public label in STEP_LABELS`);
  return { step: s.step, label: s.label.replaceAll("{company}", company) };
}

export const TIMEOUT_MESSAGE = "No response after 3 tries. Retry runs this step again with the same settings.";
export const UNEXPECTED_MESSAGE = "Something went wrong in this step. Retry runs it again with the same settings.";

// Whole words or id prefixes, so a document about Sarajevo or the Jevons paradox still gets through.
const INTERNAL = [/\bjev\b/i, /typesafe-ai/i, /\bclaude-/i, /\banthropic\//i, /\bopenai\//i, /\bgoogle\//i, /\bmoonshotai\//i];

/** Throws if the serialized event names an internal component, its model, or a model vendor. */
export function assertPublic(event: RunEvent): void {
  const s = JSON.stringify(event);
  for (const re of INTERNAL) {
    const m = s.match(re);
    if (m) throw new Error(`Internal name "${m[0]}" in public event ${event.type}`);
  }
}

/** Documents the LLM filter rejected, most relevant first (by the relevance score, which is not passed on). */
export function screenedOut(docs: FrDoc[], decisions: Map<string, FilterDecision>): DocNote[] {
  return docs
    .map((d, i) => ({ d, i, dec: decisions.get(d.document_number) }))
    .filter((x) => x.dec?.llm && !x.dec.llm.relevant)
    .sort((a, b) => (b.dec!.jevProbability ?? 0) - (a.dec!.jevProbability ?? 0) || a.i - b.i)
    .map(({ d, dec }) => ({ document_number: d.document_number, title: d.title, reason: dec!.llm!.reason }));
}

/** Relevant documents that failed verification, with the reason in the GC's words. */
export const heldBack = (docs: FrDoc[], dropped: { document_number: string; why: string }[]): DocNote[] =>
  dropped.map((x) => ({ document_number: x.document_number, title: docs.find((d) => d.document_number === x.document_number)?.title ?? x.document_number, reason: x.why }));
