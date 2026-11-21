import { assignTier, type TierRules } from "./tier";
import type { CompanyProfile, LabelSet, RunRecord } from "./types";

/**
 * Eval v2 grading (code only — no model). Every key case is either a FLAG (should be found) or a TRAP
 * (looks relevant, should be left out). Documents in neither list that a run flags are "unlabeled" extras.
 * Exact facts (date, tier, owner) are checked by code against the key; judgment calls go to the judge panel.
 */

export interface Ratio {
  correct: number;
  total: number;
}
const ratio = (correct = 0, total = 0): Ratio => ({ correct, total });
const add = (a: Ratio, b: Ratio): Ratio => ({ correct: a.correct + b.correct, total: a.total + b.total });

export interface RunGrade {
  runId: string;
  counts: { tp: number; fn: number; trapHit: number; tn: number; unlabeled: number };
  /** kind:direct, kind:indirect, trap:<type>, docType:<type> → correct / total */
  slices: Record<string, Ratio>;
  checks: { date: Ratio; tier: Ratio; owner: Ratio };
  /** Per key case: did this run get it right (flag found / trap left out)? Feeds pass^k. */
  caseCorrect: Record<string, boolean>;
  missed: string[];
  trapHits: string[];
  unlabeled: string[];
  /** Baseline claims that pointed at no real Federal Register document. */
  madeUp: number;
  costUsd: number;
  ms: number;
}

export function trapsOf(key: LabelSet) {
  // v1 keys called traps "borderlineRejected".
  if (key.traps) return key.traps;
  return Object.fromEntries(Object.entries(key.borderlineRejected ?? {}).map(([n, t]) => [n, { trapType: "other" as const, reason: t.reason, confidence: t.confidence }]));
}

export function gradeRun(run: RunRecord, key: LabelSet, profile: CompanyProfile, rules: TierRules): RunGrade {
  const flagged = new Map((run.items ?? []).map((i) => [i.document_number, i]));
  const traps = trapsOf(key);
  const slices: Record<string, Ratio> = {};
  const bump = (k: string, ok: boolean) => (slices[k] = add(slices[k] ?? ratio(), ratio(ok ? 1 : 0, 1)));
  const checks = { date: ratio(), tier: ratio(), owner: ratio() };
  const caseCorrect: Record<string, boolean> = {};

  for (const n of key.relevant) {
    const d = key.details?.[n];
    const it = flagged.get(n);
    caseCorrect[n] = !!it;
    bump(`kind:${d?.kind ?? "direct"}`, !!it);
    if (d?.docType) bump(`docType:${d.docType}`, !!it);
    if (!it || !d) continue;
    if (d.deadline) {
      const ok = !!it.deadline && [d.deadline.date, ...(d.acceptDates ?? [])].includes(it.deadline.date);
      checks.date = add(checks.date, ratio(ok ? 1 : 0, 1));
    }
    if (d.docType) {
      const expected = assignTier({
        type: d.docType,
        deadlines: d.deadline ? [{ date: d.deadline.date, kind: d.deadline.kind, source: "fr_field", verified: true }] : [],
        asOf: run.config.asOf,
        rules,
      }).tier;
      checks.tier = add(checks.tier, ratio(it.tier === expected ? 1 : 0, 1));
    }
    const want = profile.areas[d.area]?.owner.email;
    if (want) checks.owner = add(checks.owner, ratio(it.owner.email === want ? 1 : 0, 1));
  }
  for (const [n, t] of Object.entries(traps)) {
    const ok = !flagged.has(n);
    caseCorrect[n] = ok;
    bump(`trap:${t.trapType}`, ok);
  }

  const keyed = new Set([...key.relevant, ...Object.keys(traps)]);
  const missed = key.relevant.filter((n) => !flagged.has(n));
  const trapHits = Object.keys(traps).filter((n) => flagged.has(n));
  const unlabeled = [...flagged.keys()].filter((n) => !keyed.has(n));
  return {
    runId: run.id,
    counts: { tp: key.relevant.length - missed.length, fn: missed.length, trapHit: trapHits.length, tn: Object.keys(traps).length - trapHits.length, unlabeled: unlabeled.length },
    slices,
    checks,
    caseCorrect,
    missed,
    trapHits,
    unlabeled,
    madeUp: (run.dropped ?? []).filter((d) => /does not exist|no Federal Register/i.test(d.why)).length,
    costUsd: run.totalCostUsd + (run.judge?.costUsd ?? 0) + (run.panel?.costUsd ?? 0),
    ms: run.totalMs,
  };
}

const choose = (n: number, k: number) => {
  if (k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

/**
 * pass^k (τ-bench): chance a case is right in ALL of k runs, estimated from n ≥ k runs per case as
 * mean over cases of C(successes, k) / C(n, k). pass^1 = plain success rate; pass^n = right every time.
 */
export function passK(perRun: Record<string, boolean>[], k: number): number {
  const n = perRun.length;
  if (!n || k > n) return NaN;
  const cases = Object.keys(perRun[0]);
  if (!cases.length) return NaN;
  return cases.reduce((a, c) => a + choose(perRun.filter((r) => r[c]).length, k) / choose(n, k), 0) / cases.length;
}

export type Verdict = "PASS" | "FAIL" | "UNKNOWN";
/** Judge-panel vote: a verdict needs `minAgree` matching votes; UNKNOWN is an abstention. */
export function majority(votes: Verdict[], minAgree: number): "PASS" | "FAIL" | "CONTESTED" {
  const pass = votes.filter((v) => v === "PASS").length;
  const fail = votes.filter((v) => v === "FAIL").length;
  if (pass >= minAgree && pass > fail) return "PASS";
  if (fail >= minAgree && fail > pass) return "FAIL";
  return "CONTESTED";
}

/** Sum many run grades (e.g. one setup across every eval set) into headline numbers. */
export function aggregate(grades: RunGrade[]) {
  const counts = { tp: 0, fn: 0, trapHit: 0, tn: 0, unlabeled: 0 };
  const slices: Record<string, Ratio> = {};
  const checks = { date: ratio(), tier: ratio(), owner: ratio() };
  for (const g of grades) {
    for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] += g.counts[k];
    for (const [k, v] of Object.entries(g.slices)) slices[k] = add(slices[k] ?? ratio(), v);
    for (const k of ["date", "tier", "owner"] as const) checks[k] = add(checks[k], g.checks[k]);
  }
  const div = (a: number, b: number) => (b ? a / b : null);
  return {
    runs: grades.length,
    counts,
    slices,
    checks,
    recall: div(counts.tp, counts.tp + counts.fn),
    precision: div(counts.tp, counts.tp + counts.trapHit + counts.unlabeled),
    trapAvoidance: div(counts.tn, counts.tn + counts.trapHit),
    madeUp: grades.reduce((a, g) => a + g.madeUp, 0),
    costUsd: grades.reduce((a, g) => a + g.costUsd, 0),
    msMean: div(grades.reduce((a, g) => a + g.ms, 0), grades.length),
  };
}
