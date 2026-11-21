"use client";
import { useEffect, useMemo, useState } from "react";
import type { FrDoc, LabelSet } from "@/lib/types";

const groupKey = (d: FrDoc) => d.agencies[0]?.name ?? d.agencies[0]?.raw_name ?? "Unknown agency";

/**
 * Ground truth is the user's call — this page never shows model output (no Jev scores, no LLM verdicts),
 * so labels can't be anchored on the system being graded.
 */
export default function LabelBoard({ profileId, start, end }: { profileId: string; start: string; end: string }) {
  const [docs, setDocs] = useState<FrDoc[]>([]);
  const [rel, setRel] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [hideReviewed, setHideReviewed] = useState(false);
  const [saved, setSaved] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/labels?profile=${profileId}&start=${start}&end=${end}`)
      .then((r) => r.json())
      .then(({ docs, labels }: { docs: FrDoc[]; labels: LabelSet | null }) => {
        setDocs(docs);
        if (labels) {
          setRel(new Set(labels.relevant));
          setReviewed(new Set(labels.reviewedAgencies));
          setNotes(labels.notes ?? {});
        }
      });
  }, [profileId, start, end]);

  const groups = useMemo(() => {
    const m = new Map<string, FrDoc[]>();
    for (const d of docs) {
      const s = `${d.title} ${d.abstract ?? ""} ${d.document_number} ${groupKey(d)}`.toLowerCase();
      if (q && !s.includes(q.toLowerCase())) continue;
      const k = groupKey(d);
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [docs, q]);

  const allGroups = useMemo(() => new Set(docs.map(groupKey)), [docs]);

  async function save() {
    const body: LabelSet = { profileId, windowStart: start, windowEnd: end, relevant: [...rel], reviewedAgencies: [...reviewed], notes, updatedAt: "" };
    await fetch("/api/labels", { method: "POST", body: JSON.stringify(body) });
    setSaved(new Date().toLocaleTimeString());
  }

  const toggle = <T,>(s: Set<T>, v: T) => {
    const n = new Set(s);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="box p-3 flex flex-wrap items-center gap-3 text-sm sticky top-0 z-10">
        <b>{rel.size}</b> relevant · <b>{reviewed.size}</b>/{allGroups.size} agencies reviewed · {docs.length} docs
        <input className="inp" placeholder="search title/abstract/agency" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={hideReviewed} onChange={(e) => setHideReviewed(e.target.checked)} /> hide reviewed</label>
        <span className="ml-auto text-muted-foreground text-xs">{saved && `saved ${saved}`}</span>
        <button className="btn" onClick={save}>Save labels</button>
      </div>
      {groups
        .filter(([g]) => !(hideReviewed && reviewed.has(g)))
        .map(([g, ds]) => (
          <div key={g} className="box">
            <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-sm">
              <b>{g}</b> <span className="text-muted-foreground">{ds.length} docs · {ds.filter((d) => rel.has(d.document_number)).length} relevant</span>
              <label className="ml-auto flex items-center gap-1 text-xs"><input type="checkbox" checked={reviewed.has(g)} onChange={() => setReviewed((s) => toggle(s, g))} /> reviewed every doc in this agency</label>
            </div>
            <table className="t">
              <tbody>
                {ds.map((d) => (
                  <tr key={d.document_number} className={rel.has(d.document_number) ? "bg-green-500/10" : ""}>
                    <td className="w-8"><input type="checkbox" checked={rel.has(d.document_number)} onChange={() => setRel((s) => toggle(s, d.document_number))} /></td>
                    <td className="font-mono text-xs w-28">{d.document_number}</td>
                    <td className="text-xs w-24">{d.type}</td>
                    <td className="text-xs">
                      <button className="text-left hover:underline" onClick={() => setOpen(open === d.document_number ? null : d.document_number)}>{d.title}</button>
                      {open === d.document_number && (
                        <div className="mt-1 text-muted-foreground flex flex-col gap-1">
                          <div>{d.abstract ?? "(no abstract)"}</div>
                          <div>Dates: {d.dates ?? "—"} · effective {d.effective_on ?? "—"} · comments close {d.comments_close_on ?? "—"}</div>
                          <a className="underline" href={d.html_url} target="_blank">open on federalregister.gov</a>
                          <input className="inp" placeholder="note (why relevant / not)" value={notes[d.document_number] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [d.document_number]: e.target.value }))} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
