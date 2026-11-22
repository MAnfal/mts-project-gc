import "server-only";
import { CompanySchema, frozenWeek, presets } from "../config";
import { recordedView } from "../runs/recorded-view";
import type { ExampleRun, ExampleSummary } from "../runs/types";
import type { CompanyProfile } from "../types";
import { assertPublic, assertPublicText, stepOf } from "./events";
import { recordedEvents } from "./recorded-events";
import { NEUTRAL_REASON } from "./stages";

// Projects a recorded example run (public/evals/user-view/runs/<id>.json, a POC RunRecord) into the public events a
// live run streams, so the GC's example pages render it with reduceEvents + ReportView like any run. Server-only: it
// reads the frozen week and the presets from config/, and only it, never the browser, sees the record's internal
// fields. Run by scripts/build-examples.mts, which writes the result to public/examples/.
//
// The record is mapped by recordedView (src/lib/runs/recorded-view.ts) and turned into events by recordedEvents
// (./recorded-events.ts), the same two steps the reviewer's run report takes. What this adds is the public side:
// strict step labels from STEP_LABELS, the neutral reason in place of a leaked or empty one, assertPublic on every
// event and on the profile, and the guards below.

/**
 * The POC's fallback reason for an item the LLM filter gave no reason for: the internal component's name and its
 * relevance score, then "(no LLM reason)" (poc:poc/src/lib/pipeline/stages.ts, line 281). Matched by shape: chunk 03's
 * Gate 2 bans that text anywhere in src/.
 */
const LEAKED_REASON = /^\S+ p=\d+(?:\.\d+)? \(no LLM reason\)$/;

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
  const profile = profileOf(v.id, raw as Parameters<typeof profileOf>[1]);

  // A reason the GC must not see: the POC's internal score, or none at all (the POC writes "" when there was
  // neither an LLM verdict nor a score). Either becomes the neutral reason; every other value is copied.
  const items = v.items.map((i) => (!i.reason.trim() || LEAKED_REASON.test(i.reason) ? { ...i, reason: NEUTRAL_REASON } : i));
  const events = recordedEvents(raw, { ...v, items }, docs, (stage) => stepOf(stage, v.company));
  events.forEach(assertPublic);
  // The profile ships in the same public file: a custom one comes straight from the POC record.
  assertPublicText(JSON.stringify(profile), `example ${v.id}`);
  return { id: v.id, company: v.company, windowStart: v.windowStart, windowEnd: v.windowEnd, items: v.items.length, profile, events };
}

/**
 * Every finished run of a listing (user-view/runs-index.json rows), projected; failed runs are not examples. Throws
 * when none finished, rather than leaving the GC an empty Examples list. `read` returns one run record by id.
 */
export function projectExamples(listing: { runId: string; status: string }[], read: (runId: string) => unknown): ExampleRun[] {
  const done = listing.filter((r) => r.status === "done");
  if (!done.length) throw new Error("No finished example run in the listing");
  return done.map((r) => projectRecordedRun(read(r.runId)));
}

/** public/examples/index.json: newest first by id (ids start with the run's timestamp), listing fields only. */
export const exampleIndex = (examples: ExampleRun[]): ExampleSummary[] =>
  [...examples].sort((a, b) => b.id.localeCompare(a.id)).map(({ id, company, windowStart, windowEnd, items }) => ({ id, company, windowStart, windowEnd, items }));
