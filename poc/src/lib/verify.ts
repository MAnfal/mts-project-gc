import { format, parseISO } from "date-fns";

const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** All textual renderings of an ISO date we accept inside a quote. */
function renderings(iso: string): string[] {
  const d = parseISO(iso);
  return [
    format(d, "MMMM d, yyyy"), // January 12, 2027
    format(d, "MMMM d,yyyy"),
    format(d, "MMM. d, yyyy"), // Jan. 12, 2027
    format(d, "MM/dd/yyyy"),
    format(d, "M/d/yyyy"),
    iso,
  ].map(norm);
}

/**
 * A model-extracted date is only trusted if (1) its quote appears verbatim in the
 * primary-source text and (2) the claimed date is literally inside that quote.
 * Both checks are string checks — no model in the loop.
 */
export function verifyQuotedDate(source: string, quote: string, isoDate: string): { ok: boolean; why?: string } {
  const q = norm(quote ?? "");
  if (q.length < 8) return { ok: false, why: "quote empty or too short" };
  if (!norm(source).includes(q)) return { ok: false, why: "quote not found in primary source" };
  if (!renderings(isoDate).some((r) => q.includes(r))) return { ok: false, why: "claimed date not present in quote" };
  return { ok: true };
}

/** Federal Register document numbers: 2026-22809, and corrections like C1-2026-22802. */
const DOC_NUM = /(?:^|\/)((?:[A-Z]\d-)?\d{4}-\d{4,6})(?:\.[a-z]+|\/|$|\?)/;

export function parseDocNumberFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("federalregister.gov")) return null;
    const m = u.pathname.match(DOC_NUM);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** The dates a card shows: every verified date, de-duplicated by date + kind, in date order. */
export function verifiedDatesShown<T extends { date: string; kind: string; verified: boolean }>(ds: T[]): T[] {
  const seen = new Set<string>();
  return ds
    .filter((d) => d.verified)
    .filter((d) => (seen.has(`${d.date}|${d.kind}`) ? false : (seen.add(`${d.date}|${d.kind}`), true)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Dates in prose ("December 10, 2026", "Dec. 10, 2026", "12/10/2026", "2026-12-10"). Action text must not contain any. */
export const DATE_RE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
