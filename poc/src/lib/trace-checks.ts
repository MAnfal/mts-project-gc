import { assignTier, type TierRules } from "./tier";
import type { Deadline, DocType } from "./types";
import { DATE_RE } from "./verify";

/**
 * Process checks on one run's execution trace (data/traces/<runId>.jsonl). They need no answer key, so they run on
 * every run — eval and user view alike (the observability half). Each returns pass/fail plus what it saw.
 */
type Ev = Record<string, unknown> & { type: string; seq?: number };
export interface TraceCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

const docs = (e: Ev) => (e.documents as { document_number: string }[] | undefined) ?? [];
const num = (x: unknown) => (typeof x === "number" ? x : 0);

export function checkTrace(events: Ev[]): TraceCheck[] {
  const out: TraceCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => out.push({ id, label, pass, detail });
  const of = (t: string) => pipelineEvents.filter((e) => e.type === t);
  const start = events[0];
  // The judge panel appends its events after run.end, so find run.end rather than taking the last line.
  const endIdx = events.findIndex((e) => e.type === "run.end");
  const end = endIdx >= 0 ? events[endIdx] : undefined;
  const pipelineEvents = endIdx >= 0 ? events.slice(0, endIdx + 1) : events;
  const judgeOnlyAfterEnd = endIdx < 0 || events.slice(endIdx + 1).every((e) => e.type.startsWith("judge."));
  const mode = (start?.config as { mode?: string } | undefined)?.mode ?? "pipeline";
  const finalItems = ((end?.itemsFinal as { document_number: string; deadline?: { date: string; verified: boolean } | null; action?: string }[]) ?? []);

  // 1. The trace is whole: starts, ends, nothing missing in between.
  const seqOk = events.every((e, i) => e.seq === undefined || e.seq === i);
  add(
    "complete",
    "Trace is complete (start → end, no gaps; only judge events after the end)",
    start?.type === "run.start" && !!end && seqOk && judgeOnlyAfterEnd,
    `${events.length} events, first=${start?.type}, run.end at #${endIdx}${events.length - 1 > endIdx ? `, then ${events.length - 1 - endIdx} judge events` : ""}`,
  );

  if (mode === "pipeline") {
    // 2. Every scanned doc got a filter decision (nothing dropped silently).
    const scanned = of("scan.result").flatMap(docs).map((d) => d.document_number);
    const decided = new Set(of("filter.decision").map((e) => e.document_number as string));
    const undecided = scanned.filter((n) => !decided.has(n));
    add("every-doc-decided", "Every scanned document got a filter decision", undecided.length === 0, undecided.length ? `no decision: ${undecided.slice(0, 5).join(", ")}` : `${scanned.length}/${scanned.length}`);

    // 3. Every doc the Jev step passed on got an LLM verdict.
    const passedNoLlm = of("filter.decision").filter((e) => e.passedJev === true && !e.llm).map((e) => e.document_number);
    add("jev-passed-judged", "Every document past the Jev filter got an LLM decision", passedNoLlm.length === 0, passedNoLlm.length ? `missing: ${passedNoLlm.join(", ")}` : "ok");

    // 4. Every kept item went through verify → tier → owner → action.
    const kept = finalItems.map((i) => i.document_number);
    const missingStep = kept.filter((n) => !["verify.doc", "tier.assign", "owner.assign", "action.write"].every((t) => of(t).some((e) => e.document_number === n)));
    add("kept-items-verified", "Every kept item was re-fetched, verified, tiered, routed and written", missingStep.length === 0, missingStep.length ? `skipped a step: ${missingStep.join(", ")}` : `${kept.length} items`);

    // 5. Tier is reproducible from its own recorded inputs (deterministic code, no model).
    const wrongTier = of("tier.assign").filter((e) => {
      const d = e.deadline as Deadline | null;
      const expected = assignTier({ type: e.docType as DocType, deadlines: d ? [{ ...d, verified: true }] : [], asOf: e.asOf as string, rules: e.rules as TierRules }).tier;
      // A recorded deadline in the past only counts if it was the chosen effective date; re-deriving from it must agree.
      return expected !== e.tier;
    });
    add("tier-follows-rules", "Every tier follows the configured rules from its recorded inputs", wrongTier.length === 0, wrongTier.length ? `mismatch: ${wrongTier.map((e) => `${e.document_number}=${e.tier}`).join(", ")}` : `${of("tier.assign").length} tiers`);
  }

  if (mode === "baseline") {
    const claims = of("llm.call").find((e) => e.stage === "baseline:format")?.output as { items?: unknown[] } | undefined;
    const resolved = of("baseline.resolve").length;
    add("claims-resolved", "Every baseline claim was resolved against the Federal Register or dropped with a reason", (claims?.items?.length ?? 0) === resolved, `${resolved}/${claims?.items?.length ?? 0} claims`);
  }

  // 6. Every deadline shown to the user is verified against the source.
  const unverified = finalItems.filter((i) => i.deadline && !i.deadline.verified).map((i) => i.document_number);
  add("shown-dates-verified", "Every deadline shown is verified against the primary source", unverified.length === 0, unverified.length ? `unverified: ${unverified.join(", ")}` : `${finalItems.filter((i) => i.deadline).length} dates`);

  // 7. Action text carries no dates (dates are rendered only from verified data).
  const dated = finalItems.filter((i) => i.action && new RegExp(DATE_RE.source).test(i.action)).map((i) => i.document_number);
  add("no-dates-in-actions", "No action text contains a date (dates come only from verified fields)", dated.length === 0, dated.length ? `dates in: ${dated.join(", ")}` : "ok");

  // 8. Costs add up: every priced pipeline call sums to the run total (judge cost is tracked separately on the run).
  const summed = [...of("llm.call"), ...of("jev.call")].reduce((a, e) => a + num(e.costUsd), 0);
  const total = num(end?.totalCostUsd);
  add("costs-add-up", "Recorded call costs add up to the run total", Math.abs(summed - total) <= Math.max(0.0005, total * 0.01), `calls $${summed.toFixed(4)} vs run $${total.toFixed(4)}`);

  return out;
}
