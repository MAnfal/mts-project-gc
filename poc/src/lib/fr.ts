import fs from "node:fs/promises";
import path from "node:path";
import { frozenWeek } from "./config";
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

/**
 * Every document published in [start, end]. The scan is exhaustive on purpose: recall is measured against the whole week.
 * Eval-set weeks read the frozen input in config/evalsets/weeks/, so every run sees identical documents.
 */
export async function listWindow(start: string, end: string, useCache = true): Promise<FrDoc[]> {
  const frozen = frozenWeek(start, end);
  if (frozen) return frozen;
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
/** federalregister.gov answers automated full-text requests with a "Request Access" captcha page. */
export const isBlockPage = (html: string) => /Request Access|captcha/i.test(html.slice(0, 5000));

/** The same GPO text, served by govinfo.gov without a captcha. */
export const govinfoUrl = (doc: Pick<FrDoc, "document_number" | "publication_date">) =>
  `https://www.govinfo.gov/content/pkg/FR-${doc.publication_date}/html/${doc.document_number}.htm`;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "reg-monitor-poc" } });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.trim() || isBlockPage(html)) return null;
    return html.replace(/<[^>]+>/g, " ");
  } catch {
    return null;
  }
}

/**
 * Full plain text of a document: govinfo first, the Federal Register's raw text as fallback. A block page or a
 * failure returns "" and is NOT cached, so a later run retries instead of reading junk forever.
 */
export async function getRawText(doc: FrDoc): Promise<string> {
  return (await getRawTextWithSource(doc)).text;
}

/** Same as getRawText, plus where the text came from (for the execution trace). */
export async function getRawTextWithSource(doc: FrDoc): Promise<{ text: string; source: "cache" | "govinfo" | "federalregister" | "none" }> {
  const file = path.join(CACHE, `text-${doc.document_number}.json`);
  try {
    const hit = JSON.parse(await fs.readFile(file, "utf8")) as string;
    if (hit && !isBlockPage(hit)) return { text: hit, source: "cache" };
  } catch {}
  let source: "govinfo" | "federalregister" = "govinfo";
  let text = await fetchText(govinfoUrl(doc));
  if (!text && doc.raw_text_url) {
    text = await fetchText(doc.raw_text_url);
    source = "federalregister";
  }
  if (!text) return { text: "", source: "none" };
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, JSON.stringify(text));
  return { text, source };
}

export const agencyNames = (d: FrDoc) => d.agencies.map((a) => a.name ?? a.raw_name ?? a.slug ?? "?");
