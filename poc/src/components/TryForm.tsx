"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Demo {
  id: string;
  name: string;
  summary: string;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function TryForm({ demos, defaultWeek, maxDays }: { demos: Demo[]; defaultWeek: { start: string; end: string }; maxDays: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"demo" | "custom">("demo");
  const [profileId, setProfileId] = useState(demos[0]?.id);
  const [custom, setCustom] = useState({ name: "", summary: "", applies: "", doesNotApply: "" });
  const [start, setStart] = useState(defaultWeek.start);
  const [end, setEnd] = useState(defaultWeek.end);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const body =
      mode === "demo"
        ? { profileId, windowStart: start, windowEnd: end }
        : { custom: { name: custom.name, summary: custom.summary, applies: lines(custom.applies), doesNotApply: lines(custom.doesNotApply) }, windowStart: start, windowEnd: end };
    const res = await fetch("/api/try", { method: "POST", body: JSON.stringify(body) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error);
    router.push(`/try/${j.id}`);
  }

  const field = "rounded-md border bg-background px-3 py-2 text-sm w-full";
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>What changed in federal rules for your company?</CardTitle>
        <CardDescription>Pick a company and a week. You get back only the rules that matter, each with a tier, a checked deadline, an owner and the source.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex gap-2">
          <Button variant={mode === "demo" ? "default" : "outline"} size="sm" onClick={() => setMode("demo")}>Use a sample company</Button>
          <Button variant={mode === "custom" ? "default" : "outline"} size="sm" onClick={() => setMode("custom")}>✎ Describe my company</Button>
        </div>

        {mode === "demo" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {demos.map((d) => (
              <button
                key={d.id}
                onClick={() => setProfileId(d.id)}
                className={`text-left rounded-lg border p-3 transition-colors ${profileId === d.id ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted"}`}
              >
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{d.summary}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            <input className={field} placeholder="Company name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <textarea className={field} rows={3} placeholder="What does it do? e.g. 'We run 40 dental clinics in Texas and sell whitening kits online.'" value={custom.summary} onChange={(e) => setCustom({ ...custom, summary: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea className={field} rows={4} placeholder={"Rules that apply (one per line)\ne.g. dental devices, patient privacy"} value={custom.applies} onChange={(e) => setCustom({ ...custom, applies: e.target.value })} />
              <textarea className={field} rows={4} placeholder={"Rules that don't (one per line)\ne.g. hospitals, banking"} value={custom.doesNotApply} onChange={(e) => setCustom({ ...custom, doesNotApply: e.target.value })} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <input type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">To (up to {maxDays} days)</span>
            <input type="date" className={field} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <Button className="ml-auto" disabled={busy} onClick={go}>{busy ? "Starting…" : "Run the monitor"}</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </CardContent>
    </Card>
  );
}
