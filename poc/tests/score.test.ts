import { describe, expect, it } from "vitest";
import { scoreRun, consistency, jevSweep } from "../src/lib/score";
import type { ActionItem, LabelSet, RunRecord } from "../src/lib/types";

const labels: LabelSet = {
  profileId: "p",
  windowStart: "a",
  windowEnd: "b",
  relevant: ["A", "B", "C", "D"],
  reviewedAgencies: [],
  notes: {},
  updatedAt: "",
};

const item = (n: string, over: Partial<ActionItem> = {}): ActionItem => ({
  document_number: n,
  title: n,
  type: "Rule",
  agencies: [],
  tier: "High",
  tierReason: "",
  deadline: null,
  deadlines: [],
  owner: { name: "x", email: "x" },
  areas: [],
  reason: "",
  action: "",
  citation: null,
  citationVerified: true,
  url: "",
  sourceTag: "[Federal Register]",
  ...over,
});

const run = (items: ActionItem[], extra: Partial<RunRecord> = {}): RunRecord => ({
  id: Math.random().toString(),
  createdAt: "",
  config: { mode: "pipeline", profileId: "p", windowStart: "a", windowEnd: "b", asOf: "b", model: "m", filter: "llm", jevThreshold: 0.3, webLeads: false },
  status: "done",
  stages: [],
  calls: [],
  items,
  totalCostUsd: 0,
  totalMs: 0,
  ...extra,
});

describe("scoreRun", () => {
  it("computes recall, precision and raw counts", () => {
    const s = scoreRun(run([item("A"), item("B"), item("C"), item("X")]), labels);
    expect(s.tp).toBe(3);
    expect(s.fp).toBe(1);
    expect(s.fn).toBe(1);
    expect(s.recall).toBeCloseTo(0.75);
    expect(s.precision).toBeCloseTo(0.75);
    expect(s.missed).toEqual(["D"]);
    expect(s.extra).toEqual(["X"]);
  });

  it("counts dropped (unresolvable) claims separately from false positives", () => {
    const s = scoreRun(run([item("A")], { dropped: [{ document_number: "ZZ", why: "no FR number" }] }), labels);
    expect(s.fp).toBe(0);
    expect(s.unresolved).toBe(1);
  });

  it("date verification rate counts only items that show a deadline", () => {
    const v = { date: "2027-01-01", kind: "comment" as const, source: "fr_field" as const, verified: true };
    const s = scoreRun(run([item("A", { deadline: v }), item("B", { deadline: { ...v, verified: false } }), item("C")]), labels);
    expect(s.datesShown).toBe(2);
    expect(s.datesVerified).toBe(1);
  });

  it("empty prediction gives recall 0 and precision undefined-safe 0", () => {
    const s = scoreRun(run([]), labels);
    expect(s.recall).toBe(0);
    expect(s.precision).toBe(0);
  });
});

describe("consistency", () => {
  it("relevance agreement = share of docs (flagged by any run) that every run agrees on", () => {
    const c = consistency([run([item("A"), item("B")]), run([item("A"), item("C")]), run([item("A"), item("B")])]);
    expect(c.unionSize).toBe(3);
    expect(c.relevanceAgreement).toBeCloseTo(1 / 3);
  });

  it("tier agreement looks only at docs every run flagged", () => {
    const c = consistency([run([item("A", { tier: "Critical" }), item("B")]), run([item("A", { tier: "Critical" }), item("B", { tier: "Low" })])]);
    expect(c.tierAgreement).toBeCloseTo(0.5);
  });
});

describe("jevSweep", () => {
  it("reports prefilter recall and pass-through count per threshold", () => {
    const r = run([], {
      decisions: [
        { document_number: "A", jevProbability: 0.9, relevant: true },
        { document_number: "B", jevProbability: 0.4, relevant: true },
        { document_number: "X", jevProbability: 0.5, relevant: false },
        { document_number: "C", jevProbability: 0.05, relevant: false },
      ],
    });
    const rows = jevSweep(r, { ...labels, relevant: ["A", "B", "C"] }, [0.3, 0.6]);
    expect(rows[0]).toMatchObject({ threshold: 0.3, passed: 3, recall: 2 / 3 });
    expect(rows[1]).toMatchObject({ threshold: 0.6, passed: 1, recall: 1 / 3 });
  });
});
