/**
 * What one repeat did on one case, for the Cases page's run panel (chunk 09). Pure; reads a run record
 * (runs.jsonl.gz) and, for passages and the event count, the run's trace.
 *
 * The filter's reason comes from the run record (`decisions[].llm.reason`), not the trace. Only the first repeat
 * of each setup is judged, so later repeats carry no `panel`; the judges' reasoning is in `panel.judges[].votes`
 * (the trace's judge.verdict events have votes but no reasons).
 */
import type { TraceEvent } from "./loader";

type Verdict = string;
/** The run-record fields read here (POC SCHEMA.md `RunRecord`). */
export type FactRun = {
  id: string;
  status: string;
  error?: string;
  config: { mode?: string; jevThreshold?: number };
  decisions?: { document_number: string; relevant: boolean; jevProbability?: number | null; llm?: { relevant: boolean; reason?: string } }[];
  panel?: {
    judges: { model: string; votes: { document_number: string; criterion: string; verdict: Verdict; why?: string }[] }[];
    verdicts: { document_number: string; criterion: string; verdict: Verdict; votes: Verdict[] }[];
  };
};

export type FilterWhy =
  | { kind: "failed"; error: string }
  /** A single-prompt baseline: no filter step, so no decision to explain. */
  | { kind: "baseline" }
  /** The run finished but recorded no decision for this doc. */
  | { kind: "none" }
  /** Screened out by the Jev pre-filter: its score fell below the run's threshold, so no LLM saw it. */
  | { kind: "jev"; probability: number | null; threshold: number | null }
  | { kind: "llm"; relevant: boolean; reason: string | null };

export function filterWhy(run: FactRun, doc: string): FilterWhy {
  if (run.status !== "done") return { kind: "failed", error: run.error ?? `run ${run.status}` };
  if (run.config.mode === "baseline") return { kind: "baseline" };
  const d = run.decisions?.find((x) => x.document_number === doc);
  if (!d) return { kind: "none" };
  if (d.llm) return { kind: "llm", relevant: d.llm.relevant, reason: d.llm.reason ?? null };
  return { kind: "jev", probability: d.jevProbability ?? null, threshold: run.config.jevThreshold ?? null };
}

export type JudgeView =
  /** No panel on this run: only the first repeat is judged. */
  | { kind: "notJudged" }
  /** The run was judged, but the panel judges only flagged items and this doc was not one. */
  | { kind: "nothingToJudge" }
  | {
      kind: "judged";
      judges: string[];
      verdicts: { criterion: string; verdict: Verdict; votes: Verdict[] }[];
      reasoning: { model: string; criterion: string; verdict: Verdict; why: string }[];
    };

export function judgeView(run: FactRun, doc: string): JudgeView {
  if (!run.panel) return { kind: "notJudged" };
  const verdicts = run.panel.verdicts.filter((v) => v.document_number === doc).map(({ criterion, verdict, votes }) => ({ criterion, verdict, votes }));
  if (!verdicts.length) return { kind: "nothingToJudge" };
  const reasoning = run.panel.judges.flatMap((j) =>
    j.votes.filter((v) => v.document_number === doc).map((v) => ({ model: j.model, criterion: v.criterion, verdict: v.verdict, why: v.why ?? "" })),
  );
  return { kind: "judged", judges: run.panel.judges.map((j) => j.model), verdicts, reasoning };
}

export type Passages = { chunks: number; picked: { index: number; p: number; text: string }[] };
export type TraceFacts = { events: number; passages: Map<string, Passages> };

/** A trace's event count and the passages the filter read for each doc (`filter.passages`; passage setups only). */
export function traceFacts(events: Iterable<TraceEvent>): TraceFacts {
  let n = 0;
  const passages = new Map<string, Passages>();
  for (const e of events) {
    n++;
    if (e.type !== "filter.passages") continue;
    const x = e as TraceEvent & { document_number: string } & Passages;
    passages.set(x.document_number, { chunks: x.chunks, picked: x.picked });
  }
  return { events: n, passages };
}
