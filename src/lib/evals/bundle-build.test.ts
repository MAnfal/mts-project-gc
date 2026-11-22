import { describe, expect, it } from "vitest";
import { appendSkippedRuns, keepManifest, pickBaselineSetup, poolSetupRuns } from "./bundle-build";

// Synthetic inputs in the shapes scripts/build-eval-index.mts passes: run records from runs.jsonl.gz /
// poc runs/*.json, setups.yaml's setups[], and export.mts's manifest.json text.
const run = (id: string, cell: string, evalset: string, status = "done") => ({ id, status, config: { cell, evalset } });

describe("appendSkippedRuns (a suite's runs.jsonl.gz vs the raw run files on poc)", () => {
  it("appends a raw run export.mts skipped, flagged superseded, after the exported ones", () => {
    const shipped = [run("r1", "a", "e1"), run("r2", "a", "e1")];
    const raw = [run("r1", "a", "e1"), run("r0", "a", "e1", "error"), run("r2", "a", "e1")];
    const out = appendSkippedRuns(shipped, raw);
    expect(out.added).toBe(1);
    expect(out.runs.map((r) => r.id)).toEqual(["r1", "r2", "r0"]);
    expect(out.runs[2]).toEqual({ ...raw[1], superseded: true });
    expect(out.runs[0]).toEqual(shipped[0]);
    expect("superseded" in out.runs[0]).toBe(false);
  });

  it("changes nothing when every raw run was exported", () => {
    const shipped = [run("r1", "a", "e1"), run("r2", "a", "e1")];
    const out = appendSkippedRuns(shipped, [run("r2", "a", "e1"), run("r1", "a", "e1")]);
    expect(out).toEqual({ runs: shipped, added: 0 });
  });

  it("does not mutate its inputs", () => {
    const raw = [run("r9", "a", "e1")];
    appendSkippedRuns([], raw);
    expect(raw[0]).toEqual(run("r9", "a", "e1"));
  });
});

describe("poolSetupRuns (the runs behind index.live / index.baseline)", () => {
  const suites: Record<string, ReturnType<typeof run>[]> = {
    s1: [run("1", "live", "e1"), run("2", "other", "e1")],
    s2: [run("3", "live", "e2"), run("4", "live", "e1")],
  };
  const runsOf = (id: string) => suites[id] ?? [];

  it("pools the setup's runs across the named suites, in suite order", () => {
    expect(poolSetupRuns("live", ["s1", "s2"], runsOf, ["e1", "e2"]).map((r) => r.id)).toEqual(["1", "3", "4"]);
  });

  it("throws when the suites hold no run of the setup", () => {
    expect(() => poolSetupRuns("missing", ["s1", "s2"], runsOf, ["e1"])).toThrow("no runs of setup missing in s1, s2");
  });

  it("throws naming every eval set the pooled runs do not cover", () => {
    expect(() => poolSetupRuns("live", ["s1"], runsOf, ["e1", "e2", "e3"])).toThrow("setup live in s1 misses eval sets: e2, e3");
  });
});

describe("pickBaselineSetup (setups.yaml → the one method: baseline setup)", () => {
  it("returns the single baseline setup's id", () => {
    expect(pickBaselineSetup([{ id: "jev", method: "jev+llm" }, { id: "base", method: "baseline" }])).toBe("base");
  });

  it("throws when there is none", () => {
    expect(() => pickBaselineSetup([{ id: "jev", method: "jev+llm" }])).toThrow("expected one baseline setup in setups.yaml, found 0");
  });

  it("throws when there are several", () => {
    expect(() => pickBaselineSetup([{ id: "b1", method: "baseline" }, { id: "b2", method: "baseline" }])).toThrow("found 2");
  });
});

describe("keepManifest (rebuilds leave manifest.json untouched unless something besides exportedAt changed)", () => {
  const manifest = (exportedAt: string, runs = 72) =>
    JSON.stringify({ schemaVersion: 1, arena: "a", exportedAt, configHash: "9a0f857741", runs }, null, 2);

  it("keeps the committed file when only exportedAt differs", () => {
    const prev = manifest("2026-11-22T18:45:18.576Z");
    expect(keepManifest(prev, manifest("2026-11-23T09:00:00.000Z"))).toBe(prev);
  });

  it("takes the new file when any other field differs", () => {
    const next = manifest("2026-11-23T09:00:00.000Z", 71);
    expect(keepManifest(manifest("2026-11-22T18:45:18.576Z"), next)).toBe(next);
  });

  it("takes the new file when there is no previous one, or it does not parse", () => {
    const next = manifest("2026-11-23T09:00:00.000Z");
    expect(keepManifest(null, next)).toBe(next);
    expect(keepManifest("{not json", next)).toBe(next);
  });
});
