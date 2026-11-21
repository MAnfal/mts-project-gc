import Link from "next/link";
import { connection } from "next/server";
import TryForm from "@/components/TryForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { companies, defaultEvalset, experiment, getCompany } from "@/lib/config";
import { listRuns } from "@/lib/store";

export default async function TryPage() {
  await connection();
  const demos = companies()
    .filter((c) => c.use === "demo")
    .map((c) => ({ id: c.id, name: c.name, summary: c.summary }));
  const d = defaultEvalset();
  const ready = (await listRuns()).filter((r) => r.config.group === "user-view" && r.status === "done");
  const name = (id: string, custom?: { name: string }) => custom?.name ?? (() => { try { return getCompany(id).name; } catch { return id; } })();
  return (
    <div className="flex flex-col gap-6 items-center">
      {ready.length > 0 && (
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Ready-made results</CardTitle>
            <CardDescription>Already run, so they open instantly. Each shows the action items and every step it took.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ready.map((r) => (
              <Link key={r.id} href={`/try/${r.id}`} className="rounded-lg border p-3 hover:bg-muted">
                <div className="font-medium">{name(r.config.profileId, r.config.customProfile)}</div>
                <div className="text-xs text-muted-foreground">
                  {r.config.windowStart} → {r.config.windowEnd} · {r.items?.length ?? 0} rules matter · {Math.round(r.totalMs / 1000)}s · ${r.totalCostUsd.toFixed(2)}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      <TryForm demos={demos} defaultWeek={{ start: d.windowStart, end: d.windowEnd }} maxDays={experiment().userView.maxWindowDays} />
      <p className="text-xs text-muted-foreground max-w-3xl">Sample companies are held out of every evaluation, so nothing here was tuned on them.</p>
    </div>
  );
}
