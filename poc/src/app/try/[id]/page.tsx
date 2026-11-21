import Link from "next/link";
import { connection } from "next/server";
import AutoRefresh from "@/components/AutoRefresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCompany } from "@/lib/config";
import { loadRun } from "@/lib/store";
import type { ActionItem, RunRecord, Tier } from "@/lib/types";

const STEPS = [
  { key: "scan", label: "Read the week's rules", match: (s: string) => s.startsWith("scan:federal") },
  { key: "filter", label: "Pick what matters to you", match: (s: string) => s.startsWith("filter:llm") || s === "filter:jev" },
  { key: "verify", label: "Check every date at the source", match: (s: string) => s.startsWith("verify") },
  { key: "report", label: "Write the actions", match: (s: string) => s.startsWith("output") },
];

const TIER_STYLE: Record<Tier, { bg: string; label: string }> = {
  Critical: { bg: "var(--status-critical)", label: "Critical · under 90 days or already in force" },
  High: { bg: "var(--status-serious)", label: "High" },
  Medium: { bg: "var(--status-warning)", label: "Medium" },
  Low: { bg: "var(--muted-foreground)", label: "Low" },
};

function Stepper({ run }: { run: RunRecord }) {
  const done = (i: number) => run.stages.some((s) => STEPS[i].match(s.name));
  const current = STEPS.findIndex((_, i) => !done(i));
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const state = done(i) ? "done" : run.status === "running" && i === current ? "active" : run.status === "error" && i === current ? "error" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full border text-xs ${state === "done" ? "bg-primary text-primary-foreground border-primary" : state === "active" ? "border-primary animate-pulse" : state === "error" ? "border-destructive text-destructive" : "text-muted-foreground"}`}
            >
              {state === "done" ? "✓" : state === "error" ? "!" : i + 1}
            </span>
            <span className={state === "todo" ? "text-muted-foreground" : ""}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ItemCard({ it, today }: { it: ActionItem; today: string }) {
  const t = TIER_STYLE[it.tier];
  return (
    <Card className="py-4 gap-0" style={{ borderLeft: `4px solid ${t.bg}` }}>
      <CardContent className="px-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge style={{ background: t.bg, color: "white" }}>{it.tier}</Badge>
          {(it.datesShown ?? (it.deadline ? [it.deadline] : [])).length ? (
            <span className="text-sm flex flex-wrap gap-x-3">
              {(it.datesShown ?? [it.deadline!]).map((d) => (
                <span key={`${d.kind}${d.date}`} title={d.verifyNote}>
                  {d.kind === "comment" ? "Comments due" : d.kind === "effective" ? (d.date <= today ? "In force since" : "In force") : d.kind === "compliance" ? "Comply by" : "Date"} <b>{d.date}</b>{" "}
                  {d.verified ? "✓" : <span className="text-destructive">unverified</span>}
                </span>
              ))}
              <span className="text-xs text-muted-foreground">✓ = checked at source</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No dated deadline</span>
          )}
          <span className="ml-auto text-sm text-muted-foreground">→ {it.owner.name}</span>
        </div>
        <div className="font-medium">{it.action}</div>
        <div className="text-sm text-muted-foreground">{it.reason}</div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
          <a className="underline" href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
          <span>{it.citation ?? it.document_number}</span>
          <span>{it.sourceTag}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function TryResult({ params }: PageProps<"/try/[id]">) {
  await connection();
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) return <p>Run not found.</p>;
  const company = run.config.customProfile ?? getCompany(run.config.profileId);
  const items = run.items ?? [];
  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <AutoRefresh active={run.status === "running"} ms={2500} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">
            Federal rules published {run.config.windowStart} → {run.config.windowEnd}
            {run.scanned ? ` · ${run.scanned} read` : ""}
            {run.status === "done" ? ` · ${items.length} matter · ${Math.round(run.totalMs / 1000)}s · $${run.totalCostUsd.toFixed(2)}` : ""}
          </p>
        </div>
        <Link href="/try" className="ml-auto text-sm underline">Run another</Link>
      </div>
      <Stepper run={run} />
      {run.status === "error" && <p className="text-sm text-destructive">Something went wrong: {run.error}</p>}
      {run.status === "done" && !items.length && <p className="text-sm">Nothing this week needs your attention.</p>}
      {(["Critical", "High", "Medium", "Low"] as Tier[]).map((tier) => {
        const group = items.filter((i) => i.tier === tier);
        if (!group.length) return null;
        return (
          <section key={tier} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{TIER_STYLE[tier].label} · {group.length}</h2>
            {group.map((it) => (
              <ItemCard key={it.document_number} it={it} today={run.config.asOf} />
            ))}
          </section>
        );
      })}
      {run.status === "done" && (
        <div className="flex gap-3 text-sm">
          <a className="underline" href={`/api/report/${run.id}?format=json`}>⬇ report.json</a>
          <a className="underline" href={`/api/report/${run.id}?format=md`}>⬇ report.md</a>
          <Link className="underline text-muted-foreground" href={`/runs/${run.id}/trace`}>see every step (trace)</Link>
        </div>
      )}
    </div>
  );
}
