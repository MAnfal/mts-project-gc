import Link from "next/link";
import { connection } from "next/server";
import ArenaForm from "@/components/ArenaForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listArenas, suiteCells } from "@/lib/arena";
import { evalsets, experiment, frozenWeek, getCompany, loadKey } from "@/lib/config";
import { budgetUsd, spentUsd } from "@/lib/store";

/** Interviewer landing page: the pre-computed eval suite first; launching a new (paid) one is secondary. */
export default async function Home() {
  await connection();
  const [arenas, spent] = await Promise.all([listArenas(), spentUsd()]);
  const latest = arenas.find((a) => !a.running) ?? arenas[0];
  const sets = evalsets().map((e) => ({
    id: e.id,
    label: `${getCompany(e.company).name} · ${e.windowStart.slice(5)}–${e.windowEnd.slice(5)}`,
    split: e.split,
    docs: frozenWeek(e.windowStart, e.windowEnd)?.length ?? 0,
    keyed: loadKey(e.company, e.windowStart, e.windowEnd)?.relevant.length ?? null,
  }));
  return (
    <div className="flex flex-col gap-6">
      {latest ? (
        <Card>
          <CardHeader>
            <CardTitle>Eval results</CardTitle>
            <CardDescription>Pre-computed: opens instantly, nothing re-runs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Link href={`/arena/${latest.id}`} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              Open the scoreboard →
            </Link>
            <span className="text-sm text-muted-foreground">
              {latest.runs} runs · ${latest.costUsd.toFixed(2)} · {new Date(latest.createdAt).toLocaleString()}
            </span>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No eval suite yet.</p>
      )}
      <ArenaForm
        evalsets={sets}
        setups={suiteCells().map((c) => ({ id: c.key, label: c.label, model: c.model, estUsd: c.estUsd }))}
        repeatOptions={experiment().arena.repeatOptions}
        spent={spent}
        budget={budgetUsd()}
      />
    </div>
  );
}
