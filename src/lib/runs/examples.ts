// The GC's example runs: recorded runs projected to public events by scripts/build-examples.mts and served as static
// files under /examples. The browser reads only these, never /evals (Decision 9). Client-safe: fetch is injected.
import { formatWindow } from "./report";
import type { ExampleRun, ExampleSummary } from "./types";

const BASE = "/examples";

/** /examples/index.json: the examples the sidebar lists, newest first. */
export async function loadExampleIndex(f: typeof fetch = fetch): Promise<ExampleSummary[]> {
  const url = `${BASE}/index.json`;
  const res = await f(url);
  if (!res.ok) throw new Error(`${url} could not be loaded (${res.status})`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error(`${url} is not a list of examples`);
  return body as ExampleSummary[];
}

/** /examples/<id>.json: one example's public events and profile. */
export async function loadExample(id: string, f: typeof fetch = fetch): Promise<ExampleRun> {
  const res = await f(`${BASE}/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`Example ${id} could not be loaded (${res.status})`);
  const body = (await res.json()) as Partial<ExampleRun>;
  if (!Array.isArray(body.events) || !body.profile) throw new Error(`Example ${id} is not an example run file`);
  return body as ExampleRun;
}

/** Sidebar rows: "Ledgerly · Nov 2–6", numbered "· run 1", "· run 2" (oldest first) where a company-week repeats. */
export function exampleLinks(index: ExampleSummary[]): { id: string; href: string; label: string }[] {
  const base = (r: ExampleSummary) => `${r.company.split(/\s+/)[0]} · ${formatWindow(r.windowStart, r.windowEnd, { year: false })}`;
  const oldestFirst = [...index].sort((a, b) => a.id.localeCompare(b.id));
  const total = new Map<string, number>();
  for (const r of index) total.set(base(r), (total.get(base(r)) ?? 0) + 1);
  const nth = new Map(oldestFirst.map((r) => [r.id, oldestFirst.filter((o) => base(o) === base(r)).indexOf(r) + 1]));
  return index.map((r) => ({
    id: r.id,
    href: `${BASE}/${encodeURIComponent(r.id)}`,
    label: total.get(base(r))! > 1 ? `${base(r)} · run ${nth.get(r.id)}` : base(r),
  }));
}
