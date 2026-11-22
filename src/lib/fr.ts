import "server-only";
import { frozenWeek } from "./config";
import { withScopedRetry } from "./pipeline/retry";
import type { FrDoc } from "./types";

// Ported from poc:poc/src/lib/fr.ts. The one change: the POC cached HTTP responses as files under data/cache/,
// and Vercel functions can't persist files, so the cache is a Map scoped to this server process. Same keys,
// same useCache rules, and each read hands back a fresh copy, as re-reading the file did.
const API = "https://www.federalregister.gov/api/v1";
const CACHE = new Map<string, string>();

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
  const file = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (useCache) {
    const hit = CACHE.get(file);
    if (hit !== undefined) return JSON.parse(hit) as T;
  }
  const value = await fetcher();
  CACHE.set(file, JSON.stringify(value));
  return value;
}

/**
 * fetch, retried (3 tries, 2 s and 4 s apart, reported to the run in scope) when the request throws or the server
 * answers 5xx or 429. Any other answer, 404 included, is returned as-is on the first try. After the last try the
 * error propagates, and each caller handles it exactly as it handled a failed fetch before retries existed.
 */
const fetchRetrying = (url: string, init: RequestInit) =>
  withScopedRetry(async () => {
    const res = await fetch(url, init);
    if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  });

async function getJson(url: string) {
  const res = await fetchRetrying(url, { headers: { accept: "application/json" } });
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
    const res = await fetchRetrying(url, { headers: { "user-agent": "reg-monitor-poc" } });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.trim() || isBlockPage(html)) return null;
    // Strip only real tags (<pre>, </pre>, <!-- … -->). govinfo leaves a literal "<" unescaped in the text
    // ("<=7.3 percent"), and a bare /<[^>]+>/ deleted everything up to the next ">" (2026-11-22, up to 34 KB).
    return html.replace(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>/g, " ");
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
  // v2: texts cached before the tag-strip fix (2026-11-22) may be cut, so they're never read again. The in-memory
  // cache starts empty on every process, so the prefix only keeps the key names the same as the POC's.
  const file = `text-v2-${doc.document_number}.json`;
  const cachedText = CACHE.get(file);
  if (cachedText !== undefined) {
    const hit = JSON.parse(cachedText) as string;
    if (hit && !isBlockPage(hit)) return { text: hit, source: "cache" };
  }
  let source: "govinfo" | "federalregister" = "govinfo";
  let text = await fetchText(govinfoUrl(doc));
  if (!text && doc.raw_text_url) {
    text = await fetchText(doc.raw_text_url);
    source = "federalregister";
  }
  if (!text) return { text: "", source: "none" };
  CACHE.set(file, JSON.stringify(text));
  return { text, source };
}

export const agencyNames = (d: FrDoc) => d.agencies.map((a) => a.name ?? a.raw_name ?? a.slug ?? "?");
