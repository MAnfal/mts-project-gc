import fs from "node:fs/promises";
import path from "node:path";
import type { FrDoc } from "./types";

const API = "https://www.federalregister.gov/api/v1";
const CACHE = path.resolve(process.cwd(), "data/cache");

const FIELDS = [
  "document_number",
  "type",
  "title",
  "abstract",
  "agencies",
  "publication_date",
  "effective_on",
  "comments_close_on",
  "dates",
  "citation",
  "cfr_references",
  "html_url",
  "raw_text_url",
  "action",
];

const qs = (params: [string, string][]) => params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

async function cached<T>(key: string, fetcher: () => Promise<T>, useCache: boolean): Promise<T> {
  const file = path.join(CACHE, key.replace(/[^a-zA-Z0-9._-]/g, "_"));
  if (useCache) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch {}
  }
  const value = await fetcher();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
  return value;
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Federal Register ${res.status} for ${url}`);
  return res.json();
}

/** Every document published in [start, end]. The scan is exhaustive on purpose: recall is measured against the whole week. */
export async function listWindow(start: string, end: string, useCache = true): Promise<FrDoc[]> {
  return cached(`window-${start}-${end}.json`, async () => {
    const out: FrDoc[] = [];
    for (let page = 1; page < 50; page++) {
      const params: [string, string][] = [
        ["per_page", "1000"],
        ["page", String(page)],
        ["order", "oldest"],
        ["conditions[publication_date][gte]", start],
        ["conditions[publication_date][lte]", end],
        ...FIELDS.map((f) => ["fields[]", f] as [string, string]),
      ];
      const data = await getJson(`${API}/documents.json?${qs(params)}`);
      out.push(...(data.results ?? []));
      if (!data.total_pages || page >= data.total_pages) break;
    }
    return out;
  }, useCache);
}

/** Re-fetch one document from the primary source. Not cached by default: this is the verification read. */
export async function getDoc(documentNumber: string, useCache = false): Promise<FrDoc | null> {
  return cached(`doc-${documentNumber}.json`, async () => {
    const params = FIELDS.map((f) => ["fields[]", f] as [string, string]);
    try {
      return (await getJson(`${API}/documents/${encodeURIComponent(documentNumber)}.json?${qs(params)}`)) as FrDoc;
    } catch {
      return null;
    }
  }, useCache);
}

/** Full plain text of the document (immutable once published, so cached). Truncated for prompt use by callers. */
export async function getRawText(doc: FrDoc): Promise<string> {
  if (!doc.raw_text_url) return "";
  return cached(`text-${doc.document_number}.json`, async () => {
    const res = await fetch(doc.raw_text_url!);
    if (!res.ok) return "";
    return (await res.text()).replace(/<[^>]+>/g, " ");
  }, true);
}

export const agencyNames = (d: FrDoc) => d.agencies.map((a) => a.name ?? a.raw_name ?? a.slug ?? "?");
