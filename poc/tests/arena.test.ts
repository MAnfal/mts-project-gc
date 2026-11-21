import { describe, expect, it } from "vitest";
import { datesAgainstKey, summarizeCell, arenaTotals } from "../src/lib/score";
import type { ActionItem, LabelSet, RunRecord } from "../src/lib/types";

const key: LabelSet = {
  profileId: "p",
  windowStart: "a",
  windowEnd: "b",
  relevant: ["A", "B", "C"],
  reviewedAgencies: [],
  notes: {},
  updatedAt: "",
  details: {
    A: { relevant: true, area: "x", reason: "", confidence: "high", deadline: { date: "2026-12-10", kind: "comment", quote: "" } },
    B: { relevant: true, area: "x", reason: "", confidence: "high", deadline: { date: "2027-01-11", kind: "effective", quote: "" } },
    C: { relevant: true, area: "x", reason: "", confidence: "low", deadline: null },
  },
};

const item = (n: string, date?: string, tier: ActionItem["tier"] = "High"): ActionItem => ({
  document_number: n,
  title: n,
  type: "Rule",
  agencies: [],
  tier,
  tierReason: "",
  deadline: date ? { date, kind: "comment", source: "fr_field", verified: true } : null,
  deadlines: [],
  owner: { name: "x", email: "x" },
  areas: [],
  reason: "",
  action: "",
  citation: null,
  citationVerified: true,
  url: "",
  sourceTag: "[Federal Register]",
});

const run = (items: ActionItem[], over: Partial<RunRecord> = {}): RunRecord => ({
  id: Math.random().toString(36),
  createdAt: "",
  config: { mode: "pipeline", profileId: "p", windowStart: "a", windowEnd: "b", asOf: "b", model: "m", filter: "llm", jevThreshold: 0.1, webLeads: false, arena: "ar", cell: "c1" },
  status: "done",
  stages: [],
  calls: [],
  items,
  totalCostUsd: 0.1,
  totalMs: 1000,
  ...over,
});

describe("datesAgainstKey", () => {
  it("counts only found docs whose key has a deadline, and matches on the exact date", () => {
    // A right, B wrong date, C has no key deadline, X not in key.
    const d = datesAgainstKey(run([item("A", "2026-12-10"), item("B", "2026-12-12"), item("C", "2026-12-01"), item("X", "2026-12-01")]), key);
    expect(d).toEqual({ checked: 2, correct: 1, wrong: ["B"] });
  });

  it("a found doc with no date shown counts as wrong when the key has one", () => {
    expect(datesAgainstKey(run([item("A")]), key)).toEqual({ checked: 1, correct: 0, wrong: ["A"] });
  });
});

describe("summarizeCell", () => {
  it("averages recall/precision over finished runs and adds up cost (judge included)", () => {
    const r1 = run([item("A", "2026-12-10"), item("B", "2027-01-11")], { judge: { model: "j", clarity: 0.8, perItem: [], costUsd: 0.01 } });
    const r2 = run([item("A", "2026-12-10"), item("X")], { judge: { model: "j", clarity: 0.6, perItem: [], costUsd: 0.01 } });
    const s = summarizeCell([r1, r2], key);
    expect(s.runs).toBe(2);
    expect(s.failed).toBe(0);
    expect(s.recall).toBeCloseTo((2 / 3 + 1 / 3) / 2);
    expect(s.precision).toBeCloseTo((1 + 0.5) / 2);
    expect(s.datesCorrect).toBe(3);
    expect(s.datesChecked).toBe(3);
    expect(s.clarity).toBeCloseTo(0.7);
    expect(s.costUsd).toBeCloseTo(0.22);
    expect(s.consistency?.relevanceAgreement).toBeCloseTo(1 / 3);
  });

  it("errored runs are counted as failed, excluded from scores, but their cost still counts", () => {
    const ok = run([item("A")]);
    const bad = run([], { status: "error", error: "boom", totalCostUsd: 0.05 });
    const s = summarizeCell([ok, bad], key);
    expect(s.failed).toBe(1);
    expect(s.recall).toBeCloseTo(1 / 3);
    expect(s.costUsd).toBeCloseTo(0.15);
    expect(s.consistency).toBeNull();
  });

  it("no finished runs gives null scores, not zeros", () => {
    const s = summarizeCell([run([], { status: "running" })], key);
    expect(s.recall).toBeNull();
    expect(s.precision).toBeNull();
  });
});

describe("arenaTotals", () => {
  it("adds up cost and run counts across every cell", () => {
    const a = summarizeCell([run([item("A")])], key);
    const b = summarizeCell([run([item("B")], { totalCostUsd: 0.4 })], key);
    expect(arenaTotals([a, b])).toMatchObject({ runs: 2, costUsd: 0.5 });
  });
});
