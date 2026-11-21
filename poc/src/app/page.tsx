import Link from "next/link";
import { connection } from "next/server";
import ArenaForm from "@/components/ArenaForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METHODS, listArenas } from "@/lib/arena";
import { ARENA_MODELS } from "@/lib/models";
import { PROFILES } from "@/lib/profiles";
import { BUDGET_USD, loadLabels, spentUsd } from "@/lib/store";

export default async function Home() {
  await connection();
  const [arenas, spent] = await Promise.all([listArenas(), spentUsd()]);
  const profiles = await Promise.all(
    PROFILES.map(async (p) => ({ id: p.id, name: p.name, summary: p.summary, hasKey: !!(await loadLabels(p.id, "2026-11-09", "2026-11-13")) })),
  );
  return (
    <div className="flex flex-col gap-6">
      <ArenaForm profiles={profiles} models={ARENA_MODELS.map((m) => ({ ...m }))} methods={METHODS} spent={spent} budget={BUDGET_USD} />
      <Card>
        <CardHeader>
          <CardTitle>Past arenas</CardTitle>
        </CardHeader>
        <CardContent>
          {!arenas.length && <p className="text-sm text-muted-foreground">None yet.</p>}
          <ul className="divide-y text-sm">
            {arenas.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <Link className="underline" href={`/arena/${a.id}`}>{PROFILES.find((p) => p.id === a.profileId)?.name ?? a.profileId}</Link>
                <span className="text-muted-foreground">{a.windowStart} → {a.windowEnd}</span>
                <span className="text-muted-foreground">{a.runs} runs{a.running ? ` · ${a.running} running` : ""}</span>
                <span className="ml-auto font-mono text-xs">${a.costUsd.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
