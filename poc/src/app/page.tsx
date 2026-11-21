import Link from "next/link";
import { connection } from "next/server";
import ArenaForm from "@/components/ArenaForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listArenas, methods } from "@/lib/arena";
import { companies, evalsets, experiment, frozenWeek, getCompany, loadKey } from "@/lib/config";
import { arenaModels } from "@/lib/models";
import { budgetUsd, spentUsd } from "@/lib/store";

export default async function Home() {
  await connection();
  const [arenas, spent] = await Promise.all([listArenas(), spentUsd()]);
  const sets = evalsets().map((e) => {
    const c = getCompany(e.company);
    return {
      id: e.id,
      label: `${c.name} · ${e.windowStart} → ${e.windowEnd}`,
      companyId: c.id,
      summary: c.summary,
      windowStart: e.windowStart,
      windowEnd: e.windowEnd,
      docs: frozenWeek(e.windowStart, e.windowEnd)?.length ?? 0,
      keyed: loadKey(e.company, e.windowStart, e.windowEnd)?.relevant.length ?? null,
    };
  });
  const names = Object.fromEntries(companies().map((c) => [c.id, c.name]));
  return (
    <div className="flex flex-col gap-6">
      <ArenaForm
        evalsets={sets}
        defaultEvalset={experiment().arena.defaultEvalset}
        repeatOptions={experiment().arena.repeatOptions}
        models={arenaModels().map((m) => ({ id: m.id, label: m.label, vendor: m.vendor }))}
        methods={methods().map((m) => ({ id: m.id, label: m.label, estUsd: m.estUsd }))}
        spent={spent}
        budget={budgetUsd()}
      />
      <Card>
        <CardHeader>
          <CardTitle>Past arenas</CardTitle>
        </CardHeader>
        <CardContent>
          {!arenas.length && <p className="text-sm text-muted-foreground">None yet.</p>}
          <ul className="divide-y text-sm">
            {arenas.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <Link className="underline" href={`/arena/${a.id}`}>{names[a.profileId] ?? a.profileId}</Link>
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
