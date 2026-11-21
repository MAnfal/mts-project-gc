import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Deadline, DocType, Tier } from "./types";

export const CRITICAL_WINDOW_DAYS = 90;
/** A final rule that took effect this recently is still an active fire drill. Older = catch-up publication. */
export const RECENTLY_EFFECTIVE_DAYS = 30;

/**
 * Deterministic tiering. No model involved: same inputs → same tier, every run.
 *
 * Rules (RFC: "deadline < 90 days = Critical", sharpened by claude-for-legal's doc-type tiers):
 *  - Only verified deadlines count.
 *  - Rule / Proposed Rule with an upcoming deadline 0..89 days from `asOf` → Critical.
 *  - Final Rule that took effect within the last 30 days → Critical ("already in effect").
 *    Older effective dates (e.g. OFAC licenses published months after issuance) → High.
 *  - Notice with an upcoming deadline → Medium (PRA comment requests etc. are not emergencies).
 *  - Otherwise by type: Rule → High, Proposed Rule → Medium, Notice/Presidential → Low.
 */
export function assignTier(input: {
  type: DocType;
  deadlines: Deadline[];
  asOf: string;
}): { tier: Tier; deadline: Deadline | null; reason: string } {
  const asOf = parseISO(input.asOf);
  const verified = input.deadlines.filter((d) => d.verified);
  const days = (d: Deadline) => differenceInCalendarDays(parseISO(d.date), asOf);

  const upcoming = verified
    .filter((d) => days(d) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0] ?? null;
  const isRulemaking = input.type === "Rule" || input.type === "Proposed Rule";

  if (next && isRulemaking && days(next) < CRITICAL_WINDOW_DAYS) {
    return { tier: "Critical", deadline: next, reason: `${next.kind} deadline in ${days(next)} days (< ${CRITICAL_WINDOW_DAYS})` };
  }

  const pastEffective = verified
    .filter((d) => d.kind === "effective" && days(d) < 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (input.type === "Rule" && pastEffective && !next) {
    const recent = days(pastEffective) >= -RECENTLY_EFFECTIVE_DAYS;
    return {
      tier: recent ? "Critical" : "High",
      deadline: pastEffective,
      reason: recent ? `already in effect since ${pastEffective.date}` : `final rule, in effect since ${pastEffective.date} (older than ${RECENTLY_EFFECTIVE_DAYS} days)`,
    };
  }

  if (input.type === "Rule") {
    return { tier: "High", deadline: next, reason: next ? `final rule, ${next.kind} deadline in ${days(next)} days` : "final rule, no dated obligation found" };
  }
  if (input.type === "Proposed Rule") {
    return { tier: "Medium", deadline: next, reason: next ? `proposed rule, ${next.kind} deadline in ${days(next)} days` : "proposed rule, no open deadline" };
  }
  if (next) {
    return { tier: "Medium", deadline: next, reason: `notice with ${next.kind} deadline in ${days(next)} days` };
  }
  return { tier: "Low", deadline: null, reason: "notice, no deadline" };
}
