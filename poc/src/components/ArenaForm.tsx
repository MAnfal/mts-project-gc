"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  evalsets: { id: string; label: string; split: string; docs: number; keyed: number | null }[];
  setups: { id: string; label: string; model: string; estUsd: number }[];
  repeatOptions: number[];
  spent: number;
  budget: number;
}

/** Start a new eval suite: pick eval sets × setups (both from config/), repeat N. */
export default function ArenaForm({ evalsets, setups, repeatOptions, spent, budget }: Props) {
  const router = useRouter();
  const [sets, setSets] = useState<Set<string>>(new Set(evalsets.map((e) => e.id)));
  const [picked, setPicked] = useState<Set<string>>(new Set(setups.map((s) => s.id)));
  const [repeat, setRepeat] = useState(repeatOptions.includes(3) ? 3 : repeatOptions[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const est = useMemo(() => setups.filter((s) => picked.has(s.id)).reduce((a, s) => a + s.estUsd, 0) * sets.size * repeat, [setups, picked, sets, repeat]);
  const left = budget - spent;
  const toggle = (set: Set<string>, fn: (s: Set<string>) => void, k: string) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    fn(n);
  };

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ evalsetIds: [...sets], cellKeys: [...picked], repeat }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error);
    router.push(`/arena/${j.arena}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run a new eval suite</CardTitle>
        <CardDescription>
          Costs real money (est. below). Setups and eval sets come from <code>config/setups.yaml</code> and <code>config/evalsets/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Setups</span>
          {setups.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(picked, setPicked, s.id)} />
              {s.label} <span className="ml-auto font-mono text-xs text-muted-foreground">≈${s.estUsd.toFixed(2)}/run</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground">Eval sets (company · week)</span>
          {evalsets.map((e) => (
            <label key={e.id} className="flex items-center gap-2">
              <Checkbox checked={sets.has(e.id)} onCheckedChange={() => toggle(sets, setSets, e.id)} />
              {e.label} <span className="text-xs text-muted-foreground">({e.split})</span>
              <span className="ml-auto text-xs text-muted-foreground">{e.keyed ?? "no"} flags · {e.docs} docs</span>
            </label>
          ))}
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Repeat each
            <select className="h-8 rounded-md border bg-background px-2" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
              {repeatOptions.map((n) => (
                <option key={n} value={n}>{n}×</option>
              ))}
            </select>
          </label>
          <span className="ml-auto font-mono text-xs">
            ≈ ${est.toFixed(2)} for {picked.size * sets.size * repeat} runs · ${left.toFixed(2)} of ${budget} left
          </span>
          <Button variant="outline" disabled={busy || !picked.size || !sets.size || est > left} onClick={go}>{busy ? "Starting…" : "Run suite"}</Button>
        </div>
        {err && <p className="text-sm text-destructive md:col-span-2">{err}</p>}
      </CardContent>
    </Card>
  );
}
