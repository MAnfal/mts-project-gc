// The one place a run's events become screen state. Live rendering folds each streamed event in; reopening a saved
// run folds its stored events, so both always agree. Pure: no React, no I/O.
import type { DocNote, RunEvent, StepKey } from "../pipeline/events";
import type { ActionItem } from "../types";

export type StepState = "waiting" | "running" | "done" | "failed";

export interface StepView {
  step: StepKey;
  label: string;
  state: StepState;
  /** step.done's count (documents kept, items written…); null until the step finishes. */
  count: number | null;
  ms: number | null;
  /** Sub-items of a running step, oldest first (the passages step reports one per document read). */
  progress: { count: number; title: string }[];
  /** The latest retry of the running step; cleared when the step ends. */
  retry: { attempt: number; delayMs: number } | null;
  /** The failure message shown under a failed step. */
  message: string | null;
}

export interface RunViewState {
  status: "running" | "done" | "failed";
  company: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  asOf: string | null;
  steps: StepView[];
  /** Items as verification confirms them, before actions are written. */
  confirmed: ActionItem[];
  // Everything run.done carries.
  items: ActionItem[];
  dropped: DocNote[];
  screenedOut: DocNote[];
  notReviewedCount: number;
  scanned: number;
  markdown: string;
  ms: number | null;
  failure: { step: StepKey | null; message: string } | null;
  failedStep: StepKey | null;
}

export const initialView = (): RunViewState => ({
  status: "running",
  company: null,
  windowStart: null,
  windowEnd: null,
  asOf: null,
  steps: [],
  confirmed: [],
  items: [],
  dropped: [],
  screenedOut: [],
  notReviewedCount: 0,
  scanned: 0,
  markdown: "",
  ms: null,
  failure: null,
  failedStep: null,
});

const waiting = (step: StepKey, label: string): StepView => ({ step, label, state: "waiting", count: null, ms: null, progress: [], retry: null, message: null });

/** `s` with `step` changed by `f`; a step run.start didn't list is added at the end rather than lost. */
function withStep(s: RunViewState, step: StepKey, label: string | null, f: (v: StepView) => StepView): RunViewState {
  const known = s.steps.some((v) => v.step === step);
  const steps = known ? s.steps : [...s.steps, waiting(step, label ?? step)];
  return { ...s, steps: steps.map((v) => (v.step === step ? f(v) : v)) };
}

export function applyEvent(s: RunViewState, e: RunEvent): RunViewState {
  switch (e.type) {
    case "run.start":
      return { ...s, company: e.company, windowStart: e.windowStart, windowEnd: e.windowEnd, asOf: e.asOf, steps: e.steps.map((x) => waiting(x.step, x.label)) };
    case "step.start":
      return withStep(s, e.step, e.label, (v) => ({ ...v, label: e.label, state: "running" }));
    case "step.progress":
      return withStep(s, e.step, null, (v) => ({ ...v, progress: [...v.progress, { count: e.count, title: e.title }] }));
    case "step.retry":
      return withStep(s, e.step, null, (v) => ({ ...v, retry: { attempt: e.attempt, delayMs: e.delayMs } }));
    case "step.done":
      return withStep(s, e.step, null, (v) => ({ ...v, state: "done", count: e.count, ms: e.ms, retry: null }));
    case "step.failed":
      return withStep(s, e.step, e.label, (v) => ({ ...v, state: "failed", retry: null, message: e.message }));
    case "item.confirmed":
      return { ...s, confirmed: [...s.confirmed, e.item] };
    case "run.done":
      return { ...s, status: "done", items: e.items, dropped: e.dropped, screenedOut: e.screenedOut, notReviewedCount: e.notReviewedCount, scanned: e.scanned, markdown: e.markdown, ms: e.ms };
    case "run.failed": {
      const failed = { ...s, status: "failed" as const, failure: { step: e.step, message: e.message }, failedStep: e.step };
      // The named step failed with this message (if step.failed didn't already say so); a step still running when
      // a run-level failure (step null) arrived stopped there, but the message belongs to the run, not to it.
      const steps = failed.steps.map((v): StepView => {
        if (e.step !== null && v.step === e.step) return { ...v, state: "failed", retry: null, message: v.message ?? e.message };
        if (v.state === "running") return { ...v, state: "failed", retry: null };
        return v;
      });
      return { ...failed, steps };
    }
  }
}

export const reduceEvents = (events: RunEvent[]): RunViewState => events.reduce(applyEvent, initialView());
