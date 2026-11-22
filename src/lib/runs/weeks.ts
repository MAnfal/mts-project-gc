// The week a run scans, for the new-run screen and the run route alike. Pure and client-safe (date-fns only), so the
// browser's window check and the server's (src/app/api/run/request.ts) count days with the same function.
import { addDays, differenceInCalendarDays, format, getDay, isValid, parseISO } from "date-fns";
import { formatWindow } from "./report";

export interface Window {
  /** YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const FRIDAY = 5;

/** Days in a window, counting both ends: Mon 2 → Fri 6 is 5. Below 1 when the window is reversed. */
export const windowDays = (start: string, end: string) => differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;

/**
 * The `n` most recent full Mon–Fri weeks before `today` (YYYY-MM-DD), newest first. A week is full once its Friday is
 * before today: on a Friday that week is still being published, so the newest full week is the one before.
 */
export function lastFullWeeks(today: string, n: number): Window[] {
  let friday = addDays(parseISO(today), -1);
  while (getDay(friday) !== FRIDAY) friday = addDays(friday, -1);
  return Array.from({ length: n }, (_, i) => {
    const end = addDays(friday, -7 * i);
    return { start: iso(addDays(end, -4)), end: iso(end) };
  });
}

/** A real calendar date written YYYY-MM-DD (so 2026-02-30 fails), as the run route requires. */
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s)) && iso(parseISO(s)) === s;

/** Why a window can't run, as a sentence for the GC; null when it can. The route sends the same sentences. */
export function validateWindow(start: string, end: string, maxWindowDays: number): string | null {
  if (!isDate(start) || !isDate(end)) return "Pick a start and an end date.";
  const days = windowDays(start, end);
  if (days < 1) return "The window ends before it starts.";
  if (days > maxWindowDays) return `Pick a window of at most ${maxWindowDays} days.`;
  return null;
}

/**
 * Today's date in New York, where the Federal Register publishes. The server computes it and hands it to the page,
 * so the browser renders the same week buttons the server did, whatever timezone either is in.
 */
export function todayInNewYork(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "Last full week · Nov 16–20" for the newest week, "Nov 9–13" for the others. */
export const weekLabel = (w: Window, index: number) => `${index === 0 ? "Last full week · " : ""}${formatWindow(w.start, w.end, { year: false })}`;

/** "Scans every federal document published Mon Nov 2 – Fri Nov 6." The year appears only when the window spans two. */
export function scanNote(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  const pattern = format(a, "yyyy") === format(b, "yyyy") ? "EEE MMM d" : "EEE MMM d, yyyy";
  const days = start === end ? format(a, pattern) : `${format(a, pattern)} – ${format(b, pattern)}`;
  return `Scans every federal document published ${days}.`;
}
