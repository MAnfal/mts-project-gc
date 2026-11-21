"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  profiles: { id: string; name: string; summary: string; hasKey: boolean }[];
  models: { id: string; label: string; vendor: string }[];
  methods: { id: string; label: string; estUsd: number }[];
  spent: number;
  budget: number;
}

const WEEK = { start: "2026-11-09", end: "2026-11-13" };

export default function ArenaForm({ profiles, models, methods, spent, budget }: Props) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(profiles.find((p) => p.id === "brightside")?.id ?? profiles[0].id);
  const [picked, setPicked] = useState<Set<string>>(new Set(methods.flatMap((m) => models.map((x) => `${m.id}:${x.id}`))));
  const [repeat, setRepeat] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const est = useMemo(() => methods.reduce((a, m) => a + models.filter((x) => picked.has(`${m.id}:${x.id}`)).length * m.estUsd, 0) * repeat, [picked, repeat, methods, models]);
  const left = budget - spent;
  const profile = profiles.find((p) => p.id === profileId)!;

  const toggle = (k: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ profileId, windowStart: WEEK.start, windowEnd: WEEK.end, cellKeys: [...picked], repeat }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error);
    router.push(`/arena/${j.arena}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start an arena</CardTitle>
        <CardDescription>Every ticked box is one setup. They all read the same week of federal rules and get graded against the same answer key.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Company</span>
            <select className="h-9 rounded-md border bg-background px-2" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.hasKey ? "" : " (no answer key yet)"}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{profile.summary}</span>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Week</span>
            <div className="h-9 rounded-md border px-2 flex items-center">Nov 9 – 13, 2026 · 448 rules published</div>
            <span className="text-xs text-muted-foreground">Fixed for now: one week, so every setup sees exactly the same input.</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-normal py-2">How it works ↓ · Model →</th>
                {models.map((m) => (
                  <th key={m.id} className="font-normal px-2 py-2">{m.label}<div className="text-xs">{m.vendor}</div></th>
                ))}
                <th className="font-normal px-2 text-right">≈ $/run</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((me) => (
                <tr key={me.id} className="border-t">
                  <td className="py-2">{me.label}</td>
                  {models.map((m) => {
                    const k = `${me.id}:${m.id}`;
                    return (
                      <td key={k} className="text-center px-2">
                        <Checkbox checked={picked.has(k)} onCheckedChange={() => toggle(k)} aria-label={`${me.label} with ${m.label}`} className="mx-auto" />
                      </td>
                    );
                  })}
                  <td className="text-right font-mono text-xs text-muted-foreground">${me.estUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Repeat each
            <select className="h-8 rounded-md border bg-background px-2" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
              {[1, 3, 5].map((n) => (
                <option key={n} value={n}>{n}×</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">(3× shows whether answers stay the same)</span>
          </label>
          <span className="ml-auto font-mono text-xs">
            ≈ ${est.toFixed(2)} for {picked.size * repeat} runs · ${left.toFixed(2)} of ${budget} left
          </span>
          <Button disabled={busy || !picked.size || est > left} onClick={go}>{busy ? "Starting…" : "Run arena"}</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}
