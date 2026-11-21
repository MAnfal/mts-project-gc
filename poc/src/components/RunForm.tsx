"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RunConfig } from "@/lib/types";

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export default function RunForm({ profiles, models, week }: { profiles: { id: string; name: string }[]; models: string[]; week: { profileId: string; windowStart: string; windowEnd: string; asOf: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(1);
  const [cfg, setCfg] = useState<RunConfig>({
    mode: "pipeline",
    profileId: week.profileId,
    windowStart: week.windowStart,
    windowEnd: week.windowEnd,
    asOf: week.asOf,
    model: models[0],
    filter: "jev+llm",
    jevThreshold: 0.1,
    webLeads: false,
  });
  const set = <K extends keyof RunConfig>(k: K, v: RunConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/run", { method: "POST", body: JSON.stringify({ config: cfg, repeat }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error);
    router.push(`/runs/${j.ids[0]}`);
  }

  return (
    <div className="box p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
      <L label="Mode">
        <select className="inp" value={cfg.mode} onChange={(e) => set("mode", e.target.value as RunConfig["mode"])}>
          <option value="pipeline">pipeline (harness)</option>
          <option value="baseline">baseline (1 prompt + native search)</option>
        </select>
      </L>
      <L label="Company profile">
        <select className="inp" value={cfg.profileId} onChange={(e) => set("profileId", e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </L>
      <L label="Window start">
        <input className="inp" type="date" value={cfg.windowStart} onChange={(e) => set("windowStart", e.target.value)} />
      </L>
      <L label="Window end / as-of">
        <input className="inp" type="date" value={cfg.windowEnd} onChange={(e) => setCfg((c) => ({ ...c, windowEnd: e.target.value, asOf: e.target.value }))} />
      </L>
      <L label="Model (all LLM stages)">
        <select className="inp" value={cfg.model} onChange={(e) => set("model", e.target.value)}>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </L>
      <L label="Filter">
        <select className="inp" disabled={cfg.mode === "baseline"} value={cfg.filter} onChange={(e) => set("filter", e.target.value as RunConfig["filter"])}>
          <option value="jev+llm">Jev prefilter → LLM</option>
          <option value="llm">LLM on every doc</option>
          <option value="jev">Jev only (no reasons)</option>
        </select>
      </L>
      <L label={`Jev threshold (${cfg.jevThreshold})`}>
        <input type="range" min={0.05} max={0.9} step={0.05} disabled={cfg.mode === "baseline" || cfg.filter === "llm"} value={cfg.jevThreshold} onChange={(e) => set("jevThreshold", Number(e.target.value))} />
      </L>
      <L label="Repeat (consistency)">
        <select className="inp" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
          <option value={1}>1 run</option>
          <option value={3}>3 runs</option>
        </select>
      </L>
      <label className="flex items-center gap-2 text-sm col-span-2">
        <input type="checkbox" disabled={cfg.mode === "baseline"} checked={cfg.webLeads} onChange={(e) => set("webLeads", e.target.checked)} />
        Web leads via Exa (only FR-resolvable URLs survive)
      </label>
      <div className="col-span-2 flex items-center gap-3 justify-end">
        {err && <span className="text-red-600 text-sm">{err}</span>}
        <button className="btn" disabled={busy} onClick={go}>{busy ? "Starting…" : "Run"}</button>
      </div>
    </div>
  );
}
