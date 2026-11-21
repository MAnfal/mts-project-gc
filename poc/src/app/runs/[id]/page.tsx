import { notFound } from "next/navigation";
import { connection } from "next/server";
import AutoRefresh from "@/components/AutoRefresh";
import { listWindow } from "@/lib/fr";
import { loadLabels, loadRun } from "@/lib/store";
import type { ActionItem, Tier } from "@/lib/types";

const TIER_STYLE: Record<Tier, string> = {
  Critical: "border-red-500 text-red-600",
  High: "border-orange-400 text-orange-600",
  Medium: "border-yellow-500 text-yellow-700",
  Low: "border-border text-muted-foreground",
};

function Item({ i, label }: { i: ActionItem; label?: boolean }) {
  return (
    <div className="box p-3 flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <span className={`tag ${TIER_STYLE[i.tier]}`}>{i.tier}</span>
        <a className="font-medium underline-offset-2 hover:underline" href={i.url} target="_blank">{i.title}</a>
        <span className="tag ml-auto">{i.sourceTag}</span>
        {label !== undefined && <span className={`tag ${label ? "border-green-600 text-green-700" : "border-red-500 text-red-600"}`}>{label ? "TP" : "FP"}</span>}
      </div>
      <div className="text-sm">{i.action}</div>
      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
        <span>Deadline: {i.deadline ? `${i.deadline.date} · ${i.deadline.kind} · ${i.deadline.verified ? "✓ verified" : "✗ unverified"}` : "none"}</span>
        <span>Owner: {i.owner.name}</span>
        <span>Areas: {i.areas.join(", ") || "—"}</span>
        <span>{i.type} · {i.agencies.join("; ")}</span>
        <span>{i.citation ?? i.document_number} {i.citationVerified ? "✓" : "✗"}</span>
      </div>
      <div className="text-xs text-muted-foreground">Why: {i.reason} · Tier rule: {i.tierReason}</div>
      {i.deadlines.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>dates checked ({i.deadlines.length})</summary>
          <ul className="pl-4 list-disc">
            {i.deadlines.map((d, k) => (
              <li key={k}>{d.date} {d.kind} [{d.source}] {d.verified ? "✓" : "✗"} — {d.verifyNote}{d.quote ? ` — “${d.quote}”` : ""}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  await connection();
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) notFound();
  const c = run.config;
  const labels = await loadLabels(c.profileId, c.windowStart, c.windowEnd);
  const truth = labels ? new Set(labels.relevant) : null;
  const docs = new Map((await listWindow(c.windowStart, c.windowEnd)).map((d) => [d.document_number, d]));
  const decisions = [...(run.decisions ?? [])].sort((a, b) => (b.jevProbability ?? (b.llm?.relevant ? 1 : 0)) - (a.jevProbability ?? (a.llm?.relevant ? 1 : 0)));

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={run.status === "running"} />
      <section className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{c.mode === "pipeline" ? "Pipeline" : "Baseline"} run · <span className="font-mono text-sm">{run.id}</span></h1>
        <div className="text-sm text-muted-foreground">
          {c.profileId} · {c.windowStart} → {c.windowEnd} · as-of {c.asOf} · {c.model}
          {c.mode === "pipeline" && ` · filter ${c.filter}${c.filter !== "llm" ? ` @ ${c.jevThreshold}` : ""} · web leads ${c.webLeads ? "on" : "off"}`}
          {c.group && ` · group ${c.group}`}
        </div>
        <div className="text-sm">
          Status <b>{run.status}</b>{run.error && <span className="text-red-600"> — {run.error}</span>} · ${run.totalCostUsd.toFixed(4)} · {(run.totalMs / 1000).toFixed(1)}s
          {!truth && <span className="text-muted-foreground"> · no labels yet for this window (TP/FP hidden)</span>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Stages</h2>
        <div className="box overflow-x-auto">
          <table className="t">
            <thead><tr><th>Stage</th><th>Time</th><th>Cost</th><th>In</th><th>Out</th><th>Note</th></tr></thead>
            <tbody>
              {run.stages.map((s, k) => (
                <tr key={k}><td className="font-mono text-xs">{s.name}</td><td>{(s.ms / 1000).toFixed(1)}s</td><td className="font-mono text-xs">${s.costUsd.toFixed(4)}</td><td>{s.inCount ?? ""}</td><td>{s.outCount ?? ""}</td><td className="text-muted-foreground">{s.note ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Action items ({run.items?.length ?? 0})</h2>
        <div className="flex flex-col gap-2">
          {(run.items ?? []).map((i) => <Item key={i.document_number} i={i} label={truth ? truth.has(i.document_number) : undefined} />)}
          {truth && run.status === "done" && [...truth].filter((n) => !run.items?.some((i) => i.document_number === n)).map((n) => (
            <div key={n} className="box p-2 text-sm border-dashed"><span className="tag border-red-500 text-red-600">MISSED</span> {n} — {docs.get(n)?.title}</div>
          ))}
        </div>
      </section>

      {!!run.dropped?.length && (
        <section>
          <h2 className="font-semibold mb-2">Dropped by verification ({run.dropped.length})</h2>
          <ul className="text-sm list-disc pl-5">{run.dropped.map((d, k) => <li key={k}><span className="font-mono">{d.document_number}</span> — {d.why}</li>)}</ul>
        </section>
      )}

      {!!run.webLeads?.length && (
        <section>
          <details>
            <summary className="font-semibold">Web leads ({run.webLeads.length}, {run.webLeads.filter((w) => w.document_number).length} resolved to FR)</summary>
            <ul className="text-xs list-disc pl-5 mt-2">{run.webLeads.map((w, k) => <li key={k}>{w.document_number ? `✓ ${w.document_number}` : "✗"} <a className="underline" href={w.url} target="_blank">{w.url}</a></li>)}</ul>
          </details>
        </section>
      )}

      {decisions.length > 0 && (
        <section>
          <details>
            <summary className="font-semibold">Filter decisions ({decisions.length} docs; sorted by Jev p)</summary>
            <div className="box overflow-x-auto mt-2 max-h-[520px] overflow-y-auto">
              <table className="t">
                <thead><tr><th>Doc</th><th>Title</th><th>Jev p</th><th>LLM</th><th>Final</th>{truth && <th>Label</th>}</tr></thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.document_number}>
                      <td className="font-mono text-xs">{d.document_number}</td>
                      <td className="text-xs">{docs.get(d.document_number)?.title.slice(0, 110)}{d.llm?.reason && <div className="text-muted-foreground">{d.llm.reason}</div>}</td>
                      <td className="font-mono text-xs">{d.jevProbability?.toFixed(2) ?? "—"}</td>
                      <td>{d.llm ? (d.llm.relevant ? "yes" : "no") : "—"}</td>
                      <td>{d.relevant ? "✓" : ""}</td>
                      {truth && <td>{truth.has(d.document_number) ? "relevant" : ""}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <section>
        <details>
          <summary className="font-semibold">Transcript ({run.calls.length} model calls)</summary>
          <div className="flex flex-col gap-2 mt-2">
            {run.calls.map((call, k) => (
              <details key={k} className="box p-2 text-xs">
                <summary className="font-mono">{call.stage} · {call.model} · {(call.ms / 1000).toFixed(1)}s · ${call.costUsd.toFixed(4)} · in {call.inputTokens ?? "?"} / out {call.outputTokens ?? "?"}{call.toolCalls ? ` · ${call.toolCalls.length} tool calls` : ""}{call.error ? " · ERROR" : ""}</summary>
                {call.error && <pre className="whitespace-pre-wrap text-red-600">{call.error}</pre>}
                {call.prompt && <><div className="text-muted-foreground mt-2">prompt</div><pre className="whitespace-pre-wrap max-h-64 overflow-auto">{call.prompt}</pre></>}
                {call.toolCalls && <><div className="text-muted-foreground mt-2">tool calls</div><pre className="whitespace-pre-wrap max-h-64 overflow-auto">{JSON.stringify(call.toolCalls.map((t) => ({ name: t.name, input: t.input })), null, 2)}</pre></>}
                <div className="text-muted-foreground mt-2">output</div>
                <pre className="whitespace-pre-wrap max-h-64 overflow-auto">{typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}</pre>
              </details>
            ))}
          </div>
        </details>
      </section>

      {run.markdown && (
        <section>
          <details>
            <summary className="font-semibold">report.md</summary>
            <pre className="box p-3 text-xs whitespace-pre-wrap mt-2">{run.markdown}</pre>
          </details>
        </section>
      )}
    </div>
  );
}
