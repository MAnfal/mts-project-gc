import { describe, expect, it } from "vitest";
import { gradeRun, passK, majority, aggregate, stepGrade, aggregateSteps } from "../src/lib/grade";
import type { ActionItem, CompanyProfile, LabelSet, RunRecord } from "../src/lib/types";

const owner = (n: string) => ({ name: n, email: `${n}@x` });
const profile = {
  id: "p",
  name: "P",
  summary: "",
  businessLines: [],
  applies: [],
  doesNotApply: [],
  areas: { food: { description: "", owner: owner("maria") }, sales: { description: "", owner: owner("aisha") } },
  generalCounsel: owner("gc"),
} as CompanyProfile;

// Key: A (direct, rule, deadline in 27 days), B (indirect, proposed, 400 days out), traps T1, T2.
const key: LabelSet = {
  profileId: "p",
  windowStart: "2026-11-09",
  windowEnd: "2026-11-13",
  relevant: ["A", "B"],
  reviewedAgencies: [],
  notes: {},
  updatedAt: "",
  details: {
    A: { relevant: true, kind: "direct", docType: "Rule", area: "food", reason: "", confidence: "high", deadline: { date: "2026-12-10", kind: "comment", quote: "" }, acceptDates: ["2027-01-11"] },
    B: { relevant: true, kind: "indirect", docType: "Proposed Rule", area: "sales", reason: "", confidence: "high", deadline: { date: "2027-12-20", kind: "comment", quote: "" } },
  },
  traps: { T1: { trapType: "other-product", docType: "Rule", reason: "", confidence: "high" }, T2: { trapType: "closed-or-expired", docType: "Notice", reason: "", confidence: "high" } },
};
const rules = { criticalWindowDays: 90, recentlyEffectiveDays: 30, criticalDocTypes: ["Rule", "Proposed Rule"] as const };

const item = (n: string, over: Partial<ActionItem> = {}): ActionItem => ({
  document_number: n,
  title: n,
  type: "Rule",
  agencies: [],
  tier: "High",
  tierReason: "",
  deadline: null,
  deadlines: [],
  owner: owner("gc"),
  areas: [],
  reason: "",
  action: "",
  citation: null,
  citationVerified: true,
  url: "",
  sourceTag: "[Federal Register]",
  ...over,
});
const run = (items: ActionItem[], over: Partial<RunRecord> = {}): RunRecord => ({
  id: Math.random().toString(36),
  createdAt: "",
  config: { mode: "pipeline", profileId: "p", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13", model: "m", filter: "jev+llm", jevThreshold: 0.1, webLeads: false },
  status: "done",
  stages: [],
  calls: [],
  items,
  totalCostUsd: 0.1,
  totalMs: 1000,
  ...over,
});

describe("gradeRun", () => {
  const r = run([
    item("A", { deadline: { date: "2027-01-11", kind: "effective", source: "fr_field", verified: true }, tier: "Critical", owner: owner("maria") }),
    item("T1"),
    item("X"),
  ]);
  const g = gradeRun(r, key, profile, rules);

  it("splits outcomes: found / missed / trap hit / correctly ignored / unlabeled extra", () => {
    expect(g.counts).toEqual({ tp: 1, fn: 1, trapHit: 1, tn: 1, unlabeled: 1 });
  });

  it("slices recall by kind and trap avoidance by trap type", () => {
    expect(g.slices["kind:direct"]).toEqual({ correct: 1, total: 1 });
    expect(g.slices["kind:indirect"]).toEqual({ correct: 0, total: 1 });
    expect(g.slices["trap:other-product"]).toEqual({ correct: 0, total: 1 });
    expect(g.slices["trap:closed-or-expired"]).toEqual({ correct: 1, total: 1 });
  });

  it("date right accepts the key's alternatives; tier is checked against the key's facts + config rules; owner by area", () => {
    expect(g.checks.date).toEqual({ correct: 1, total: 1 });
    // Key deadline 2026-12-10 is 27 days from asOf, Rule → Critical.
    expect(g.checks.tier).toEqual({ correct: 1, total: 1 });
    expect(g.checks.owner).toEqual({ correct: 1, total: 1 });
  });

  it("per-case correctness feeds pass^k: flags must be found, traps must be left out", () => {
    expect(g.caseCorrect).toEqual({ A: true, B: false, T1: false, T2: true });
  });
});

describe("date check uses the dates the card actually showed", () => {
  const fx = (n: string, date: string) => ({ date, kind: "effective" as const, source: "fr_field" as const, verified: true });
  it("new runs: right if the key date is among datesShown, even when the headline is another date", () => {
    const r = run([item("A", { deadline: fx("A", "2027-01-11"), datesShown: [fx("A", "2026-12-10"), fx("A", "2027-01-11")], tier: "Critical", owner: owner("maria") })]);
    expect(gradeRun(r, { ...key, details: { ...key.details, A: { ...key.details!.A, acceptDates: [] } } }, profile, rules).checks.date).toEqual({ correct: 1, total: 1 });
  });
  it("old runs without datesShown are graded on the headline date only (what they displayed)", () => {
    const r = run([item("A", { deadline: fx("A", "2027-01-11"), tier: "Critical", owner: owner("maria") })]);
    expect(gradeRun(r, { ...key, details: { ...key.details, A: { ...key.details!.A, acceptDates: [] } } }, profile, rules).checks.date).toEqual({ correct: 0, total: 1 });
  });
});

describe("passK", () => {
  it("share of cases right in every one of k runs", () => {
    const runs = [
      { A: true, B: true, T1: true },
      { A: true, B: false, T1: true },
      { A: true, B: true, T1: true },
    ];
    expect(passK(runs, 1)).toBeCloseTo(8 / 9);
    expect(passK(runs, 3)).toBeCloseTo(2 / 3);
  });
});

describe("majority (judge panel)", () => {
  it("needs minAgree matching verdicts; UNKNOWN is no vote; otherwise contested", () => {
    expect(majority(["PASS", "PASS", "FAIL"], 2)).toBe("PASS");
    expect(majority(["FAIL", "UNKNOWN", "FAIL"], 2)).toBe("FAIL");
    expect(majority(["PASS", "FAIL", "UNKNOWN"], 2)).toBe("CONTESTED");
    expect(majority(["PASS", "UNKNOWN", "UNKNOWN"], 2)).toBe("CONTESTED");
  });
});

describe("aggregate", () => {
  it("sums counts and checks across eval sets; recall/precision from the totals", () => {
    const g1 = gradeRun(run([item("A"), item("T1")]), key, profile, rules);
    const g2 = gradeRun(run([item("A"), item("B")]), key, profile, rules);
    const a = aggregate([g1, g2]);
    expect(a.counts).toEqual({ tp: 3, fn: 1, trapHit: 1, tn: 3, unlabeled: 0 });
    expect(a.recall).toBeCloseTo(3 / 4);
    expect(a.precision).toBeCloseTo(3 / 4); // tp / (tp + trapHit)
    expect(a.trapAvoidance).toBeCloseTo(3 / 4);
  });

  it("subset grading: flags outside the key (unlabeled) are reported but never count against precision; traps do", () => {
    const a = aggregate([gradeRun(run([item("A"), item("T1"), item("X")]), key, profile, rules)]);
    expect(a.counts).toMatchObject({ tp: 1, trapHit: 1, unlabeled: 1 });
    expect(a.precision).toBeCloseTo(1 / 2); // not 1/3: X is outside the key, so it is neither right nor wrong
    expect(a.unlabeledPerRun).toBeCloseTo(1);
  });
});

describe("stepGrade (score each pipeline step against the key, from what the run saved)", () => {
  // Scored docs: A (flag), B (flag), T1 (trap), T2 (trap), plus 3 other docs. Jev threshold 0.1.
  // Jev ranks: A 0.9 (1st), T1 0.8 (2nd), X 0.5, Y 0.3, B 0.2 (5th), Z 0.15, T2 0.05 (below threshold).
  // LLM filter gets everything ≥ 0.1: keeps A, T1; rejects B, X, Y, Z. Verify turns A and T1 into items.
  const dec = (n: string, p: number, llm?: boolean) => ({ document_number: n, jevProbability: p, relevant: !!llm, ...(llm === undefined ? {} : { llm: { relevant: llm, reason: "", areas: [] } }) });
  const decisions = [dec("A", 0.9, true), dec("T1", 0.8, true), dec("X", 0.5, false), dec("Y", 0.3, false), dec("B", 0.2, false), dec("Z", 0.15, false), dec("T2", 0.05)];
  const items = [
    item("A", { deadlines: [{ date: "2027-01-11", kind: "effective", source: "extracted", verified: true }, { date: "2026-12-10", kind: "comment", source: "extracted", verified: false }] }),
    item("T1"),
  ];
  const s = stepGrade(run(items, { decisions }), key);

  it("Jev: flags kept at the cut-off, traps let through, each flag's rank and recall in the top N", () => {
    expect(s.jev).toMatchObject({ flagsKept: { correct: 2, total: 2 }, trapsPassed: { correct: 1, total: 2 }, passed: 6, scored: 7 });
    expect(s.jev!.flagRanks).toEqual([1, 5]);
    expect(s.jev!.recallAtN[10]).toEqual({ correct: 2, total: 2 }); // both flags within Jev's top 10
  });

  it("LLM filter: judged only on what Jev handed it", () => {
    expect(s.llm).toEqual({ flagsKept: { correct: 1, total: 2 }, trapsRejected: { correct: 0, total: 1 } });
  });

  it("verify: kept flags that became items; the key's date extracted at all, and verified", () => {
    expect(s.verify.flagsSurvived).toEqual({ correct: 1, total: 1 });
    expect(s.verify.dateFound).toEqual({ correct: 1, total: 1 }); // 2026-12-10 or accepted 2027-01-11 extracted
    expect(s.verify.dateVerified).toEqual({ correct: 1, total: 1 }); // 2027-01-11 (an accepted date) is verified
  });

  it("a baseline run (no filter decisions) has no Jev or LLM step", () => {
    const b = stepGrade(run([item("A")], { config: { ...run([]).config, mode: "baseline" }, decisions: undefined }), key);
    expect(b.jev).toBeNull();
    expect(b.llm).toBeNull();
  });

  it("aggregateSteps sums ratios and pools ranks across runs", () => {
    const a = aggregateSteps([s, s]);
    expect(a.jev!.flagsKept).toEqual({ correct: 4, total: 4 });
    expect(a.jev!.flagRanks).toEqual([1, 1, 5, 5]);
    expect(a.llm!.trapsRejected).toEqual({ correct: 0, total: 2 });
    expect(a.verify.dateVerified).toEqual({ correct: 2, total: 2 });
  });
});
