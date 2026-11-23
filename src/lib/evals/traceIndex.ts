/**
 * Filtering and search over one run's trace for the trace viewer (chunk 09). Pure; the viewer loads the events
 * with loader.ts → loadTrace. Search matches values only: a key such as `jevProbability` is in every decision,
 * so matching the raw JSON would return them all.
 */
import type { TraceEvent } from "./loader";

/** Every primitive value in `v`, depth first, lowercased and one per line. Keys are left out. */
export function valueText(v: unknown): string {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (x === null || x === undefined) return;
    if (Array.isArray(x)) x.forEach(walk);
    else if (typeof x === "object") Object.values(x as Record<string, unknown>).forEach(walk);
    else out.push(String(x).toLowerCase());
  };
  walk(v);
  return out.join("\n");
}

export type TraceIndex = {
  events: TraceEvent[];
  /** valueText of each event, computed once so typing in the search box doesn't re-walk 2,000 events. */
  haystacks: string[];
  /** Each event type with its count, in the order the type first appears. */
  types: { type: string; count: number }[];
};

export function indexTrace(events: TraceEvent[]): TraceIndex {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return { events, haystacks: events.map(valueText), types: [...counts].map(([type, count]) => ({ type, count })) };
}

/** Positions of the events whose type is not hidden and whose values contain the query (case-insensitive). */
export function filterTrace(index: TraceIndex, { hidden, query }: { hidden: ReadonlySet<string>; query: string }): number[] {
  const q = query.trim().toLowerCase();
  const out: number[] = [];
  index.events.forEach((e, i) => {
    if (!hidden.has(e.type) && (!q || index.haystacks[i].includes(q))) out.push(i);
  });
  return out;
}

const LABEL: Record<string, string> = {
  "run.start": "Run start",
  "run.end": "Run end",
  "stage.start": "Stage",
  "stage.end": "Stage done",
  "scan.result": "Scan",
  "jev.call": "Jev",
  "filter.passages": "Passages",
  "llm.call": "LLM call",
  "filter.decision": "Decision",
  "verify.doc": "Verify",
  "tier.assign": "Tier",
  "owner.assign": "Owner",
  "action.write": "Action",
  "baseline.resolve": "Resolve claim",
  "judge.call": "Judge",
  "judge.verdict": "Verdict",
};

/** A short name for an event type (the POC TraceTimeline's labels); unknown types keep their raw name. */
export const eventLabel = (type: string) => LABEL[type] ?? type;

const usd = (v: unknown) => `$${Number(v).toFixed(4)}`;

/** One line per event, so the list reads without opening the JSON. Ported from the POC's TraceTimeline summary(). */
export function eventSummary(e: TraceEvent): string {
  const x = e as TraceEvent & Record<string, unknown>;
  const d = x.document_number ? `${x.document_number} · ` : "";
  switch (e.type) {
    case "run.start": {
      const c = (x.config ?? {}) as { mode?: string; model?: string };
      return `${c.mode} · ${c.model} · prompt set ${x.promptSet ?? "default"} · config ${x.configHash}`;
    }
    case "run.end":
      return `${x.status} · ${x.items} items · ${usd(x.totalCostUsd)} · ${Math.round(Number(x.totalMs) / 1000)}s`;
    case "stage.start":
      return String(x.stage);
    case "stage.end":
      return `${x.stage} · ${x.inCount ?? "–"} in → ${x.outCount ?? "–"} out · ${usd(x.costUsd)} · ${x.ms}ms${x.note ? ` · ${x.note}` : ""}`;
    case "scan.result":
      return `${x.count} documents`;
    case "jev.call":
      return `${d}p = ${Number(x.probability).toFixed(3)}`;
    case "filter.passages":
      return `${d}${(x.picked as unknown[] | undefined)?.length ?? 0} of ${x.chunks} passages`;
    case "llm.call":
      return `${x.stage} · ${x.model} · ${usd(x.costUsd)} · ${x.ms}ms${x.error ? ` · ERROR ${x.error}` : ""}`;
    case "filter.decision": {
      const jev = x.jevProbability !== null && x.jevProbability !== undefined ? ` · Jev ${Number(x.jevProbability).toFixed(2)}${x.passedJev ? " ✓" : " ✗"}` : "";
      const reason = (x.llm as { reason?: string } | null | undefined)?.reason;
      return `${d}${x.relevant ? "RELEVANT" : "not relevant"}${jev}${reason ? ` · “${reason}”` : ""}`;
    }
    case "verify.doc":
      return `${d}${x.refetched ? "re-fetched" : "NOT FOUND"} · text from ${x.textSource ?? "–"} · citation ${x.citationVerified ? "✓" : "✗"}`;
    case "tier.assign":
      return `${d}${x.tier} · ${x.reason}`;
    case "owner.assign":
      return `${d}${(x.owner as { name?: string } | undefined)?.name} · ${x.rule}`;
    case "action.write":
      return `${d}${x.final}${x.stripped ? " (dates stripped)" : ""}`;
    case "baseline.resolve":
      return `${d}${x.outcome}${x.why ? ` · ${x.why}` : ""}`;
    case "judge.call":
      return `${x.model} · ${(x.votes as unknown[] | undefined)?.length ?? 0} votes · ${usd(x.costUsd)}${x.error ? ` · ERROR ${x.error}` : ""}`;
    case "judge.verdict":
      return `${d}${x.criterion}: ${x.verdict} · ${Object.values((x.votes as Record<string, string>) ?? {}).join(" / ")}`;
    default:
      return "";
  }
}
