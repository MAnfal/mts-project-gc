import Link from "next/link";
import { connection } from "next/server";
import TraceTimeline from "@/components/TraceTimeline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRun } from "@/lib/store";
import { checkTrace } from "@/lib/trace-checks";
import { readTrace } from "@/lib/trace";

/** Full execution trace of one run: process checks on top, then every step as a timeline with its raw JSON. */
export default async function TracePage({ params }: PageProps<"/runs/[id]/trace">) {
  await connection();
  const { id } = await params;
  const [run, events] = [await loadRun(id), readTrace(id)];
  if (!events.length)
    return (
      <p className="text-sm">
        No trace for this run (runs before 2026-11-21 evening were not traced). <Link className="underline" href={`/runs/${id}`}>Run summary</Link>
      </p>
    );
  const checks = checkTrace(events as never);
  const failed = checks.filter((c) => !c.pass).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Execution trace</h1>
          <p className="text-sm text-muted-foreground font-mono">{id}</p>
          {run && (
            <p className="text-sm text-muted-foreground">
              {run.config.profileId} · {run.config.windowStart} → {run.config.windowEnd} · {run.config.cell ?? run.config.mode} · {events.length} events
            </p>
          )}
        </div>
        <div className="ml-auto flex gap-3 text-sm">
          <Link className="underline" href={`/runs/${id}`}>Run summary</Link>
          <a className="underline" href={`/api/trace/${id}`}>⬇ trace.jsonl</a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{failed ? `${failed} of ${checks.length} trace checks failed` : `All ${checks.length} trace checks passed`}</CardTitle>
          <CardDescription>Deterministic checks on the trace itself, no answer key needed, so they run on every run, including the user view.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={c.pass ? "text-[var(--status-good)]" : "text-destructive"}>{c.pass ? "✓" : "✗"}</span>
                <span>
                  {c.label} <span className="text-muted-foreground">· {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <TraceTimeline events={events as never} />
    </div>
  );
}
