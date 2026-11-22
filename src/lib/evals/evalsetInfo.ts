import "server-only";
import { format, parseISO } from "date-fns";
import { companies, evalsets } from "@/lib/config";

/**
 * How the eval pages name an eval set (company · week · split) and a company, read from config/ on the server
 * (manifest.yaml and companies/*.yaml) and passed to the client pages as plain data.
 */
export type EvalsetInfo = { company: string; companyName: string; weekId: string; week: string; split: "dev" | "test" };
export type EvalDirectory = { evalsets: Record<string, EvalsetInfo>; companyNames: Record<string, string> };

/** "Oct 26–30", or "Oct 30–Nov 3" across a month boundary. */
export function weekLabel(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  return a.getMonth() === b.getMonth() ? `${format(a, "MMM d")}–${format(b, "d")}` : `${format(a, "MMM d")}–${format(b, "MMM d")}`;
}

/** Every eval set in the manifest with its company's name, week label and split. Throws for a company with no profile. */
export function evalDirectory(): EvalDirectory {
  const companyNames = Object.fromEntries(companies().map((c) => [c.id, c.name]));
  const sets = evalsets().map((e) => {
    const companyName = companyNames[e.company];
    if (!companyName) throw new Error(`eval set ${e.id} names company ${e.company}, which has no profile in config/companies`);
    return [e.id, { company: e.company, companyName, weekId: e.weekId, week: weekLabel(e.windowStart, e.windowEnd), split: e.split }] as const;
  });
  return { evalsets: Object.fromEntries(sets), companyNames };
}
