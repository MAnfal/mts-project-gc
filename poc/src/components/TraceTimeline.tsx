"use client";
import { useMemo, useState } from "react";
import { allExpanded, collapseAllNested, darkStyles, defaultStyles, JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { Badge } from "@/components/ui/badge";

type Ev = Record<string, unknown> & { seq: number; ts: string; type: string };

const KIND: Record<string, { label: string; tone: string }> = {
  "run.start": { label: "Run start", tone: "bg-primary text-primary-foreground" },
  "run.end": { label: "Run end", tone: "bg-primary text-primary-foreground" },
  "stage.start": { label: "Stage", tone: "bg-muted" },
  "stage.end": { label: "Stage done", tone: "bg-muted" },
  "scan.result": { label: "Scan", tone: "bg-muted" },
  "jev.call": { label: "Jev", tone: "bg-sky-500/15" },
  "llm.call": { label: "LLM call", tone: "bg-violet-500/15" },
  "filter.decision": { label: "Decision", tone: "bg-amber-500/15" },
  "verify.doc": { label: "Verify", tone: "bg-emerald-500/15" },
  "tier.assign": { label: "Tier", tone: "bg-emerald-500/15" },
  "owner.assign": { label: "Owner", tone: "bg-emerald-500/15" },
  "action.write": { label: "Action", tone: "bg-emerald-500/15" },
  "baseline.resolve": { label: "Resolve claim", tone: "bg-amber-500/15" },
  "judge.call": { label: "Judge", tone: "bg-rose-500/15" },
  "judge.verdict": { label: "Verdict", tone: "bg-rose-500/15" },
};

/** One-line human summary per event, so the timeline reads without opening the JSON. */
function summary(e: Ev): string {
  const d = e.document_number ? `${e.document_number} · ` : "";
  switch (e.type) {
    case "run.start":
      return `${(e.config as { mode?: string; model?: string })?.mode} · ${(e.config as { model?: string })?.model} · prompt set ${e.promptSet ?? "default"} · config ${e.configHash}`;
    case "run.end":
      return `${e.status} · ${e.items} items · $${Number(e.totalCostUsd).toFixed(4)} · ${Math.round(Number(e.totalMs) / 1000)}s`;
    case "stage.start":
      return String(e.stage);
    case "stage.end":
      return `${e.stage} · ${e.inCount ?? "–"} in → ${e.outCount ?? "–"} out · $${Number(e.costUsd).toFixed(4)} · ${e.ms}ms${e.note ? ` · ${e.note}` : ""}`;
    case "scan.result":
      return `${e.count} documents`;
    case "jev.call":
      return `${d}p = ${Number(e.probability).toFixed(3)}`;
    case "llm.call":
      return `${e.stage} · ${e.model} · $${Number(e.costUsd).toFixed(4)} · ${e.ms}ms${e.error ? ` · ERROR ${e.error}` : ""}`;
    case "filter.decision":
      return `${d}${e.relevant ? "RELEVANT" : "not relevant"}${e.jevProbability !== null && e.jevProbability !== undefined ? ` · Jev ${Number(e.jevProbability).toFixed(2)}${e.passedJev ? " ✓" : " ✗"}` : ""}${(e.llm as { reason?: string } | null)?.reason ? ` · “${(e.llm as { reason: string }).reason}”` : ""}`;
    case "verify.doc":
      return `${d}${e.refetched ? "re-fetched" : "NOT FOUND"} · text from ${e.textSource ?? "–"} · citation ${e.citationVerified ? "✓" : "✗"}`;
    case "tier.assign":
      return `${d}${e.tier} · ${e.reason}`;
    case "owner.assign":
      return `${d}${(e.owner as { name?: string })?.name} · ${e.rule}`;
    case "action.write":
      return `${d}${e.final}${e.stripped ? " (dates stripped)" : ""}`;
    case "baseline.resolve":
      return `${d}${e.outcome}${e.why ? ` · ${e.why}` : ""}`;
    case "judge.call":
      return `${e.model} · ${(e.votes as unknown[])?.length ?? 0} votes · $${Number(e.costUsd).toFixed(4)}${e.error ? ` · ERROR ${e.error}` : ""}`;
    case "judge.verdict":
      return `${d}${e.criterion}: ${e.verdict} · ${Object.values((e.votes as Record<string, string>) ?? {}).join(" / ")}`;
    default:
      return "";
  }
}

export default function TraceTimeline({ events }: { events: Ev[] }) {
  const types = useMemo(() => [...new Set(events.map((e) => e.type))], [events]);
  const [hidden, setHidden] = useState<Set<string>>(new Set(["stage.start", "jev.call"]));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const dark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const shown = events.filter((e) => !hidden.has(e.type) && (!query || JSON.stringify(e).toLowerCase().includes(query.toLowerCase())));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setHidden((h) => {
              const n = new Set(h);
              if (n.has(t)) n.delete(t);
              else n.add(t);
              return n;
            })}
            className={`rounded-full border px-2 py-0.5 ${hidden.has(t) ? "opacity-40 line-through" : ""}`}
          >
            {KIND[t]?.label ?? t} · {events.filter((e) => e.type === t).length}
          </button>
        ))}
        <input className="ml-auto h-8 rounded-md border bg-background px-2 text-sm w-56" placeholder="Search (doc number, word…)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ol className="flex flex-col gap-1">
        {shown.map((e) => (
          <li key={e.seq} className="rounded-md border">
            <button className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-muted/50" onClick={() => setOpen(open === e.seq ? null : e.seq)}>
              <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">#{e.seq}</span>
              <Badge variant="secondary" className={`${KIND[e.type]?.tone ?? ""} shrink-0`}>{KIND[e.type]?.label ?? e.type}</Badge>
              <span className="truncate">{summary(e)}</span>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">{e.ts.slice(11, 19)}</span>
            </button>
            {open === e.seq && (
              <div className="border-t px-3 py-2 text-xs overflow-x-auto max-h-[60vh]">
                <JsonView data={e} shouldExpandNode={e.type === "llm.call" || e.type === "judge.call" ? collapseAllNested : allExpanded} style={dark ? darkStyles : defaultStyles} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {!shown.length && <p className="text-sm text-muted-foreground">No events match.</p>}
    </div>
  );
}
