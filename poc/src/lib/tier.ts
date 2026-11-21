import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Deadline, DocType, Tier } from "./types";

/** From config/pipeline.yaml → tiering. Passed in so tests pin the numbers explicitly. */
export interface TierRules {
  /** Deadlines strictly under this many days are Critical (RFC: 90). */
  criticalWindowDays: number;
  /** A final rule that took effect this recently is still an active fire drill. Older = catch-up publication. */
  recentlyEffectiveDays: number;
}

/**
 * Deterministic tiering. No model involved: same inputs → same tier, every run.
 *
 * Rules (RFC: "deadline < 90 days = Critical", sharpened by claude-for-legal's doc-type tiers):
 *  - Only verified deadlines count.
 *  - Rule / Proposed Rule with an upcoming deadline under `criticalWindowDays` from `asOf` → Critical.
 *  - Final Rule that took effect within the last `recentlyEffectiveDays` → Critical ("already in effect").
 *    Older effective dates (e.g. OFAC licenses published months after issuance) → High.
 *  - Notice with an upcoming deadline → Medium (PRA comment requests etc. are not emergencies).
 *  - Otherwise by type: Rule → High, Proposed Rule → Medium, Notice/Presidential → Low.
 */
export function assignTier(input: {
  type: DocType;
  deadlines: Deadline[];
  asOf: string;
  rules: TierRules;
}): { tier: Tier; deadline: Deadline | null; reason: string } {
  const { criticalWindowDays: CRITICAL_WINDOW_DAYS, recentlyEffectiveDays: RECENTLY_EFFECTIVE_DAYS } = input.rules;
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
