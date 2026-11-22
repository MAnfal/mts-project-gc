import { describe, expect, it } from "vitest";
import { shippedJson, shippedRuns, shippedSuiteIds } from "./__fixtures__/shipped";
import type { TraceCheck } from "./loader";
import { checkSummary, runLabel, suiteRunRows, type LabelledRun } from "./runList";

type Checks = Record<string, TraceCheck[]>;

describe("the Runs page listing on shipped data", () => {
  for (const suite of shippedSuiteIds()) {
    it(`${suite}: trace-checks.json lists exactly the runs in runs.jsonl.gz, so every run gets a trace link`, () => {
      const checks = shippedJson<Checks>(`suites/${suite}/trace-checks.json`);
      const runs = shippedRuns<LabelledRun>(suite);
      const rows = suiteRunRows(checks, null);
      expect(rows.map((r) => r.id).sort()).toEqual(runs.map((r) => r.id).sort());
      const labelled = suiteRunRows(checks, new Map(runs.map((r) => [r.id, runLabel(r)])));
      expect(labelled.every((r) => r.label !== null)).toBe(true);
    });
  }
});

describe("runLabel", () => {
  it("reads setup, eval set, repeat and status from the run record", () => {
    const r = { id: "r", status: "error", config: { cell: "s", evalset: "e", repeatIndex: 2 } };
    expect(runLabel(r)).toEqual({ setup: "s", evalset: "e", repeat: 2, status: "error", superseded: false });
  });

  it("flags a superseded run", () => {
    expect(runLabel({ id: "r", status: "done", superseded: true, config: { cell: "s", evalset: "e", repeatIndex: 0 } }).superseded).toBe(true);
  });

  it("throws naming the run when it records no setup or eval set", () => {
    expect(() => runLabel({ id: "r9", status: "done", config: { repeatIndex: 0 } })).toThrow("run r9 records no setup or eval set");
  });

  it("treats a missing repeat index as repeat 0", () => {
    expect(runLabel({ id: "r", status: "done", config: { cell: "s", evalset: "e" } }).repeat).toBe(0);
  });
});

describe("suiteRunRows", () => {
  const pass = (id: string): TraceCheck => ({ id, label: id, pass: true, detail: "ok" });
  const fail = (id: string): TraceCheck => ({ id, label: id, pass: false, detail: "no" });

  it("keeps trace-checks order and leaves the label empty until the runs are loaded", () => {
    const rows = suiteRunRows({ b: [pass("x")], a: [fail("x")] }, null);
    expect(rows).toEqual([
      { id: "b", checks: { passed: 1, total: 1, failing: [] }, label: null },
      { id: "a", checks: { passed: 0, total: 1, failing: [fail("x")] }, label: null },
    ]);
  });

  it("leaves a run's label empty when the loaded runs don't include it", () => {
    expect(suiteRunRows({ a: [] }, new Map())[0].label).toBeNull();
  });
});

describe("checkSummary", () => {
  it("counts passes and names the failing checks", () => {
    const failing = { id: "costs-add-up", label: "Recorded call costs add up", pass: false, detail: "off" };
    expect(checkSummary([{ id: "complete", label: "c", pass: true, detail: "" }, failing])).toEqual({ passed: 1, total: 2, failing: [failing] });
  });

  it("is null when no checks were recorded", () => {
    expect(checkSummary(null)).toBeNull();
    expect(checkSummary(undefined)).toBeNull();
  });
});
