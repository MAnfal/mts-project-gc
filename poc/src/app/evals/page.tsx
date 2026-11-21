import Link from "next/link";
import { connection } from "next/server";
import { listWindow } from "@/lib/fr";
import { consistency, jevSweep, scoreRun } from "@/lib/score";
import { listRuns, loadLabels } from "@/lib/store";

const TARGET = { recall: 0.9, precision: 0.8, relAgree: 0.9 };
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const mark = (ok: boolean) => (ok ? <span className="text-green-700">✓</span> : <span className="text-red-600">✗</span>);

export default async function EvalsPage({ searchParams }: PageProps<"/evals">) {
  await connection();
  const sp = await searchParams;
  const profileId = (sp.profile as string) ?? "ledgerly";
  const start = (sp.start as string) ?? "2026-11-09";
  const end = (sp.end as string) ?? "2026-11-13";

  const [labels, docs, all] = await Promise.all([loadLabels(profileId, start, end), listWindow(start, end), listRuns()]);
  const runs = all.filter((r) => r.status === "done" && r.config.profileId === profileId && r.config.windowStart === start && r.config.windowEnd === end);
  const agencies = new Set(docs.map((d) => d.agencies[0]?.name ?? "Unknown agency"));

  if (!labels || labels.relevant.length === 0) {
    return (
      <div className="box p-4 text-sm">
        No ground truth yet for {profileId} · {start} → {end}. <Link className="underline" href="/label">Label the week first</Link> — every metric here is set math against your labels.
      </div>
    );
  }

  const scored = runs.map((r) => ({ r, s: scoreRun(r, labels) }));
  const groups = new Map<string, typeof runs>();
  for (const r of runs) if (r.config.group) groups.set(r.config.group, [...(groups.get(r.config.group) ?? []), r]);
  const jevRun = runs.find((r) => r.decisions?.some((d) => d.jevProbability !== undefined) && (r.config.filter === "jev" || r.config.jevThreshold <= 0.1)) ?? runs.find((r) => r.decisions?.some((d) => d.jevProbability !== undefined));

  // Average per config: the pipeline-vs-baseline headline.
  const byCfg = new Map<string, typeof scored>();
  for (const x of scored) {
    const c = x.r.config;
    const k = `${c.mode} · ${c.model.split("/")[1]}${c.mode === "pipeline" ? ` · ${c.filter}${c.filter !== "llm" ? `@${c.jevThreshold}` : ""}` : ""}`;
    byCfg.set(k, [...(byCfg.get(k) ?? []), x]);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-lg font-semibold">Evals · {profileId} · {start} → {end}</h1>
        <p className="text-sm text-muted">
          Ground truth: {labels.relevant.length} relevant docs of {docs.length} · {labels.reviewedAgencies.length}/{agencies.size} agencies reviewed
          {labels.reviewedAgencies.length < agencies.size && " (recall is only honest once every agency is reviewed)"}. Graders are code: recall/precision on document numbers, dates checked against the Federal Register record, tier agreement across repeats.
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Headline: harness vs baseline (mean over runs)</h2>
        <div className="box overflow-x-auto">
          <table className="t">
            <thead><tr><th>Config</th><th>Runs</th><th>Recall ≥ .9</th><th>Precision ≥ .8</th><th>Dates verified</th><th>Unresolved claims</th><th>$ / run</th><th>s / run</th></tr></thead>
            <tbody>
              {[...byCfg.entries()].map(([k, xs]) => {
                const rec = avg(xs.map((x) => x.s.recall));
                const pre = avg(xs.map((x) => x.s.precision));
                const shown = xs.reduce((a, x) => a + x.s.datesShown, 0);
                const ver = xs.reduce((a, x) => a + x.s.datesVerified, 0);
                return (
                  <tr key={k}>
                    <td className="font-mono text-xs">{k}</td>
                    <td>{xs.length}</td>
                    <td>{pct(rec)} {mark(rec >= TARGET.recall)}</td>
                    <td>{pct(pre)} {mark(pre >= TARGET.precision)}</td>
                    <td>{shown ? `${ver}/${shown}` : "—"} {shown ? mark(ver === shown) : ""}</td>
                    <td>{avg(xs.map((x) => x.s.unresolved)).toFixed(1)}</td>
                    <td className="font-mono text-xs">${avg(xs.map((x) => x.s.costUsd)).toFixed(3)}</td>
                    <td className="font-mono text-xs">{(avg(xs.map((x) => x.s.ms)) / 1000).toFixed(0)}s {avg(xs.map((x) => x.s.ms)) > 300_000 && <span className="text-red-600">&gt; 300s cap</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Consistency (repeat groups)</h2>
        {groups.size === 0 ? (
          <p className="text-sm text-muted">Run any config with &quot;Repeat: 3 runs&quot; to measure it.</p>
        ) : (
          <div className="box overflow-x-auto">
            <table className="t">
              <thead><tr><th>Group</th><th>Config</th><th>Runs</th><th>Relevance agreement ≥ 90%</th><th>Tier identical</th><th>Disagreed on</th></tr></thead>
              <tbody>
                {[...groups.entries()].map(([g, rs]) => {
                  const c = consistency(rs);
                  return (
                    <tr key={g}>
                      <td className="font-mono text-xs">{g}</td>
                      <td className="font-mono text-xs">{rs[0].config.mode} · {rs[0].config.model.split("/")[1]}</td>
                      <td>{c.runs}</td>
                      <td>{pct(c.relevanceAgreement)} {mark(c.relevanceAgreement >= TARGET.relAgree)}</td>
                      <td>{pct(c.tierAgreement)} {mark(c.tierAgreement === 1)}</td>
                      <td className="font-mono text-xs">{c.disagreements.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {jevRun && (
        <section>
          <h2 className="font-semibold mb-2">Jev prefilter threshold sweep <span className="text-xs text-muted font-normal">(from <Link className="underline" href={`/runs/${jevRun.id}`}>{jevRun.id.slice(0, 19)}</Link>)</span></h2>
          <p className="text-sm text-muted mb-2">Jev answers with a probability only. The question is the lowest-cost cut that keeps recall: everything at or above the threshold goes to the LLM.</p>
          <div className="box overflow-x-auto">
            <table className="t">
              <thead><tr><th>Threshold</th><th>Docs passed to LLM</th><th>Prefilter recall</th><th>Prefilter precision</th></tr></thead>
              <tbody>
                {jevSweep(jevRun, labels).map((row) => (
                  <tr key={row.threshold}><td>{row.threshold}</td><td>{row.passed}</td><td>{pct(row.recall)} {mark(row.recall >= TARGET.recall)}</td><td>{pct(row.precision)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Every run</h2>
        <div className="box overflow-x-auto">
          <table className="t">
            <thead><tr><th>Run</th><th>Mode</th><th>TP</th><th>FP</th><th>FN</th><th>Recall</th><th>Precision</th><th>Missed</th><th>Extra</th></tr></thead>
            <tbody>
              {scored.map(({ r, s }) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs"><Link className="underline" href={`/runs/${r.id}`}>{r.id.slice(0, 19)}</Link></td>
                  <td>{r.config.mode}</td>
                  <td>{s.tp}</td><td>{s.fp}</td><td>{s.fn}</td>
                  <td>{pct(s.recall)}</td><td>{pct(s.precision)}</td>
                  <td className="font-mono text-xs">{s.missed.join(", ")}</td>
                  <td className="font-mono text-xs">{s.extra.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
