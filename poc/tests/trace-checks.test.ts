import { describe, expect, it } from "vitest";
import { checkTrace } from "../src/lib/trace-checks";

const rules = { criticalWindowDays: 90, recentlyEffectiveDays: 30, criticalDocTypes: ["Rule", "Proposed Rule"] };
const ev = (type: string, data: Record<string, unknown> = {}) => ({ type, ...data });

// A minimal well-formed pipeline trace: 2 docs scanned, 1 kept.
const good = () =>
  [
    ev("run.start", { config: { mode: "pipeline", filter: "jev+llm", asOf: "2026-11-13" } }),
    ev("scan.result", { count: 2, documents: [{ document_number: "A" }, { document_number: "B" }] }),
    ev("jev.call", { document_number: "A", costUsd: 0.001 }),
    ev("jev.call", { document_number: "B", costUsd: 0.001 }),
    ev("llm.call", { stage: "filter-llm#0", costUsd: 0.01 }),
    ev("filter.decision", { document_number: "A", passedJev: true, llm: { relevant: true }, relevant: true }),
    ev("filter.decision", { document_number: "B", passedJev: false, llm: null, relevant: false }),
    ev("verify.doc", { document_number: "A", refetched: true, fieldChecks: [{ date: "2026-12-10", verified: true }], extracted: [] }),
    ev("tier.assign", { document_number: "A", docType: "Proposed Rule", tier: "Critical", deadline: { date: "2026-12-10", kind: "comment", verified: true }, rules, asOf: "2026-11-13" }),
    ev("owner.assign", { document_number: "A", areas: ["food"] }),
    ev("llm.call", { stage: "output-actions", costUsd: 0.01 }),
    ev("action.write", { document_number: "A", raw: "Do X by December 10, 2026.", final: "Do X by [date — see deadline].", stripped: true }),
    ev("run.end", { status: "done", totalCostUsd: 0.022, itemsFinal: [{ document_number: "A", deadline: { date: "2026-12-10", verified: true }, action: "Do X by [date — see deadline]." }] }),
  ].map((e, i) => ({ seq: i, ...e }));

const byId = (r: ReturnType<typeof checkTrace>) => Object.fromEntries(r.map((c) => [c.id, c.pass]));

describe("checkTrace (process checks on a run's trace; no answer key needed)", () => {
  it("a well-formed trace passes every check", () => {
    const r = checkTrace(good());
    expect(r.filter((c) => !c.pass)).toEqual([]);
    expect(r.length).toBeGreaterThanOrEqual(7);
  });

  it("judge-panel events appended after run.end don't break completeness or the cost sum", () => {
    const t = [...good(), { seq: 13, type: "judge.call", costUsd: 0.03 }, { seq: 14, type: "judge.verdict" }];
    expect(checkTrace(t).filter((c) => !c.pass)).toEqual([]);
  });

  it("catches a doc that silently got no decision", () => {
    const t = good().filter((e) => !(e.type === "filter.decision" && (e as Record<string, unknown>).document_number === "B"));
    expect(byId(checkTrace(t))["every-doc-decided"]).toBe(false);
  });

  it("catches a kept item that skipped verification", () => {
    const t = good().filter((e) => e.type !== "verify.doc");
    expect(byId(checkTrace(t))["kept-items-verified"]).toBe(false);
  });

  it("catches a date that slipped into the final action text", () => {
    const t = good().map((e) => (e.type === "run.end" ? { ...e, itemsFinal: [{ document_number: "A", deadline: null, action: "Do X by 12/10/2026" }] } : e));
    expect(byId(checkTrace(t))["no-dates-in-actions"]).toBe(false);
  });

  it("catches a tier that doesn't follow the rules from its own recorded inputs", () => {
    const t = good().map((e) => (e.type === "tier.assign" ? { ...e, tier: "Low" } : e));
    expect(byId(checkTrace(t))["tier-follows-rules"]).toBe(false);
  });

  it("catches costs that don't add up", () => {
    const t = good().map((e) => (e.type === "run.end" ? { ...e, totalCostUsd: 0.5 } : e));
    expect(byId(checkTrace(t))["costs-add-up"]).toBe(false);
  });

  it("catches a shown deadline that was never verified", () => {
    const t = good().map((e) => (e.type === "run.end" ? { ...e, itemsFinal: [{ document_number: "A", deadline: { date: "2026-12-10", verified: false }, action: "x" }] } : e));
    expect(byId(checkTrace(t))["shown-dates-verified"]).toBe(false);
  });
});
