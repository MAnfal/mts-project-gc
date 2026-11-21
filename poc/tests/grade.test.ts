import { describe, expect, it } from "vitest";
import { gradeRun, passK, majority, aggregate } from "../src/lib/grade";
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
    expect(a.precision).toBeCloseTo(3 / 4); // tp / (tp + trapHit + unlabeled)
    expect(a.trapAvoidance).toBeCloseTo(3 / 4);
  });
});
