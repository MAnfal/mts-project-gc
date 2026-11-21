import { assignTier, type TierRules } from "./tier";
import type { CompanyProfile, LabelSet, RunRecord } from "./types";

/**
 * Eval v2 grading (code only — no model). Every key case is either a FLAG (should be found) or a TRAP
 * (looks relevant, should be left out). Documents in neither list that a run flags are "unlabeled" extras.
 * Subset grading (2026-11-22): precision = found / (found + traps flagged). Unlabeled extras are reported
 * (unlabeledPerRun) but never count against precision: flagging a doc nobody judged irrelevant isn't a known
 * mistake (it includes docs the key reviewers dropped as 50/50). Traps are known noise, so they still count.
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
      // Graded on what the card showed: every verified date for new runs, the single headline date for older runs.
      const shown = it.datesShown ?? (it.deadline ? [it.deadline] : []);
      const ok = shown.some((x) => [d.deadline!.date, ...(d.acceptDates ?? [])].includes(x.date));
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
    precision: div(counts.tp, counts.tp + counts.trapHit),
    unlabeledPerRun: div(counts.unlabeled, grades.length),
    trapAvoidance: div(counts.tn, counts.tn + counts.trapHit),
    madeUp: grades.reduce((a, g) => a + g.madeUp, 0),
    costUsd: grades.reduce((a, g) => a + g.costUsd, 0),
    msMean: div(grades.reduce((a, g) => a + g.ms, 0), grades.length),
  };
}

/**
 * Per-step scores against the key, computed from what a run already saved (filter decisions, items, dates) — so a
 * drop in end-to-end recall or precision can be traced to the step that caused it. No model calls.
 *  - jev:    key flags kept at the cut-off; traps let through; each flag's rank by Jev score; flag recall in the top N.
 *  - llm:    judged only on what Jev handed it: key flags it kept, traps it rejected.
 *  - verify: kept key flags that became items; the key's date (or an accepted one) extracted at all / verified.
 * jev and llm are null when the run didn't use that step (e.g. baseline).
 */
export const TOP_N = [10, 20, 30, 50] as const;
export interface StepGrade {
  jev: { flagsKept: Ratio; trapsPassed: Ratio; flagRanks: number[]; recallAtN: Record<number, Ratio>; passed: number; scored: number } | null;
  llm: { flagsKept: Ratio; trapsRejected: Ratio } | null;
  verify: { flagsSurvived: Ratio; dateFound: Ratio; dateVerified: Ratio };
}

export function stepGrade(run: RunRecord, key: LabelSet): StepGrade {
  const traps = new Set(Object.keys(trapsOf(key)));
  const flags = key.relevant;
  const decs = run.decisions ?? [];
  const byDoc = new Map(decs.map((d) => [d.document_number, d]));
  const items = new Map((run.items ?? []).map((i) => [i.document_number, i]));
  const one = (ok: boolean) => ratio(ok ? 1 : 0, 1);
  const sum = (xs: boolean[]) => xs.reduce((a, ok) => add(a, one(ok)), ratio());

  let jev: StepGrade["jev"] = null;
  const scored = decs.filter((d) => typeof d.jevProbability === "number");
  if (scored.length) {
    const thr = run.config.jevThreshold;
    const order = [...scored].sort((a, b) => b.jevProbability! - a.jevProbability!).map((d) => d.document_number);
    const rank = (n: string) => order.indexOf(n) + 1;
    const ranks = flags.filter((n) => order.includes(n)).map(rank).sort((a, b) => a - b);
    jev = {
      flagsKept: sum(flags.filter((n) => byDoc.has(n)).map((n) => (byDoc.get(n)!.jevProbability ?? 0) >= thr)),
      trapsPassed: sum([...traps].filter((n) => byDoc.has(n)).map((n) => (byDoc.get(n)!.jevProbability ?? 0) >= thr)),
      flagRanks: ranks,
      recallAtN: Object.fromEntries(TOP_N.map((N) => [N, sum(flags.filter((n) => order.includes(n)).map((n) => rank(n) <= N))])),
      passed: scored.filter((d) => d.jevProbability! >= thr).length,
      scored: scored.length,
    };
  }

  const judged = decs.filter((d) => d.llm);
  const llm: StepGrade["llm"] = judged.length
    ? {
        flagsKept: sum(judged.filter((d) => flags.includes(d.document_number)).map((d) => d.llm!.relevant)),
        trapsRejected: sum(judged.filter((d) => traps.has(d.document_number)).map((d) => !d.llm!.relevant)),
      }
    : null;

  // Verify: pipeline runs start from flags the filter kept; baseline runs from flags it returned.
  const kept = decs.length ? flags.filter((n) => byDoc.get(n)?.relevant) : flags.filter((n) => items.has(n));
  const dated = kept.filter((n) => items.has(n) && key.details?.[n]?.deadline);
  const accepted = (n: string) => [key.details![n].deadline!.date, ...(key.details![n].acceptDates ?? [])];
  return {
    jev,
    llm,
    verify: {
      flagsSurvived: sum(kept.map((n) => items.has(n))),
      dateFound: sum(dated.map((n) => items.get(n)!.deadlines.some((d) => accepted(n).includes(d.date)))),
      dateVerified: sum(dated.map((n) => items.get(n)!.deadlines.some((d) => d.verified && accepted(n).includes(d.date)))),
    },
  };
}

/** Sum step grades across runs (ratios add up; flag ranks are pooled). */
export function aggregateSteps(gs: StepGrade[]): StepGrade {
  const jevs = gs.map((g) => g.jev).filter((x): x is NonNullable<StepGrade["jev"]> => !!x);
  const llms = gs.map((g) => g.llm).filter((x): x is NonNullable<StepGrade["llm"]> => !!x);
  const r = <T>(xs: T[], f: (x: T) => Ratio) => xs.reduce((a, x) => add(a, f(x)), ratio());
  return {
    jev: jevs.length
      ? {
          flagsKept: r(jevs, (x) => x.flagsKept),
          trapsPassed: r(jevs, (x) => x.trapsPassed),
          flagRanks: jevs.flatMap((x) => x.flagRanks).sort((a, b) => a - b),
          recallAtN: Object.fromEntries(TOP_N.map((N) => [N, r(jevs, (x) => x.recallAtN[N] ?? ratio())])),
          passed: jevs.reduce((a, x) => a + x.passed, 0),
          scored: jevs.reduce((a, x) => a + x.scored, 0),
        }
      : null,
    llm: llms.length ? { flagsKept: r(llms, (x) => x.flagsKept), trapsRejected: r(llms, (x) => x.trapsRejected) } : null,
    verify: { flagsSurvived: r(gs, (g) => g.verify.flagsSurvived), dateFound: r(gs, (g) => g.verify.dateFound), dateVerified: r(gs, (g) => g.verify.dateVerified) },
  };
}

/** Human-readable lines for a step grade (used by step-report and error-analysis). */
export function formatSteps(s: StepGrade): string[] {
  const p = (r: { correct: number; total: number }) => (r.total ? `${((r.correct / r.total) * 100).toFixed(0)}% (${r.correct}/${r.total})` : "—");
  const out: string[] = [];
  if (s.jev) {
    const rk = s.jev.flagRanks;
    out.push(`  jev     flags kept ${p(s.jev.flagsKept)} · traps let through ${p(s.jev.trapsPassed)} · passes ${Math.round(s.jev.passed / Math.max(1, s.jev.scored) * 100)}% of docs`);
    out.push(`          flag rank median ${rk.length ? rk[Math.floor(rk.length / 2)] : "—"} max ${rk.at(-1) ?? "—"} · ${TOP_N.map((n) => `top${n} ${p(s.jev!.recallAtN[n])}`).join(" · ")}`);
  }
  if (s.llm) out.push(`  llm     flags kept ${p(s.llm.flagsKept)} · traps rejected ${p(s.llm.trapsRejected)}`);
  out.push(`  verify  flags → items ${p(s.verify.flagsSurvived)} · key date extracted ${p(s.verify.dateFound)} · verified ${p(s.verify.dateVerified)}`);
  return out;
}
