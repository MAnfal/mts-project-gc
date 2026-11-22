import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLE, shippedJson, shippedRuns, shippedSuiteIds } from "./__fixtures__/shipped";
import { runsIndex } from "./bundle-build";
import type { RunsIndex } from "./index-schema";
import type { TraceCheck } from "./loader";
import { checkSummary, evalsetOfRun, runRows } from "./runList";

type Checks = Record<string, TraceCheck[]>;

describe("the shipped run listings (runs-index.json) the Runs page reads", () => {
  for (const suite of shippedSuiteIds()) {
    it(`${suite}: lists exactly the runs in runs.jsonl.gz and trace-checks.json, as runsIndex() shapes them`, () => {
      const listing = shippedJson<RunsIndex>(`suites/${suite}/runs-index.json`);
      const runs = shippedRuns<Parameters<typeof runsIndex>[0][number]>(suite);
      expect(listing).toEqual(runsIndex(runs));
      expect(listing.map((r) => r.runId).sort()).toEqual(Object.keys(shippedJson<Checks>(`suites/${suite}/trace-checks.json`)).sort());
    });
  }

  it("user-view: lists every example run file", () => {
    const listing = shippedJson<RunsIndex>("user-view/runs-index.json");
    const files = fs.readdirSync(path.join(BUNDLE, "user-view/runs")).map((f) => f.replace(/\.json$/, ""));
    expect(listing.map((r) => r.runId).sort()).toEqual(files.sort());
  });

  it("each listing is a few KB, not the megabytes of runs.jsonl.gz", () => {
    for (const suite of shippedSuiteIds()) expect(fs.statSync(path.join(BUNDLE, "suites", suite, "runs-index.json")).size).toBeLessThan(30_000);
  });
});

const row = (runId: string, extra: Partial<RunsIndex[number]> = {}): RunsIndex[number] => ({
  runId,
  setup: "s1",
  profileId: "skyhop",
  window: { start: "2026-10-26", end: "2026-10-30" },
  repeat: 0,
  status: "done",
  superseded: false,
  ...extra,
});

describe("runRows", () => {
  const pass = (id: string): TraceCheck => ({ id, label: id, pass: true, detail: "ok" });
  const fail = (id: string): TraceCheck => ({ id, label: id, pass: false, detail: "no" });

  it("keeps listing order and attaches each run's trace-check summary", () => {
    const rows = runRows([row("b"), row("a")], { a: [fail("x")], b: [pass("x")] });
    expect(rows.map((r) => [r.run.runId, r.checks])).toEqual([
      ["b", { passed: 1, total: 1, failing: [] }],
      ["a", { passed: 0, total: 1, failing: [fail("x")] }],
    ]);
  });

  it("has no check summary where none were recorded (example runs, or a run missing from trace-checks)", () => {
    expect(runRows([row("u")], null)[0].checks).toBeNull();
    expect(runRows([row("u")], {})[0].checks).toBeNull();
  });
});

describe("evalsetOfRun", () => {
  const evalsets = { "skyhop_2026-10-26_2026-10-30": { company: "skyhop", weekId: "2026-10-26_2026-10-30" } };
  it("finds the eval set a run's company and window belong to", () => {
    expect(evalsetOfRun(row("r"), evalsets)).toBe("skyhop_2026-10-26_2026-10-30");
  });

  it("is null for a company-week outside the eval set (an example run)", () => {
    expect(evalsetOfRun(row("r", { profileId: "hearth" }), evalsets)).toBeNull();
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
