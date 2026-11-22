import { describe, expect, it } from "vitest";
import { shippedJson, shippedKey, shippedRuns } from "./__fixtures__/shipped";
import type { CaseKey, CaseRun } from "./cases";
import { activeFilter, casesPageState, computeCases, filterChoices, selectedRow } from "./casesState";
import type { EvalIndex } from "./index-schema";

// The real shipped index (public/evals/index.json): iterations 00–07, live = 06.
const index = shippedJson<EvalIndex>("index.json");
const L92 = "arena-2026-11-21-22-52-l92";

describe("casesPageState on the shipped index", () => {
  it("with no ?iteration= opens the live iteration (06), compared with the setup it replaced", () => {
    expect(casesPageState(index, null)).toEqual({
      kind: "iteration",
      id: "06-passages",
      no: "06",
      setup: "jev-sonnet-strict-passages",
      comparedTo: "jev-sonnet-strict",
      suite: L92,
      title: "Cases that changed in 06",
    });
  });

  it("shows 00 (the reference point, no comparedTo) on its own", () => {
    expect(casesPageState(index, "00-baseline")).toMatchObject({ kind: "iteration", no: "00", comparedTo: null, title: "Cases in 00" });
  });

  it("gives 07 (evidence only) its empty state", () => {
    expect(casesPageState(index, "07-next")).toEqual({ kind: "evidenceOnly", id: "07-next", no: "07" });
  });

  it("says an unknown iteration is unknown, naming what was asked for", () => {
    expect(casesPageState(index, "99-nope")).toEqual({ kind: "unknown", requested: "99-nope" });
  });
});

describe("casesPageState guards (constructed index)", () => {
  const it0 = { id: "01-x", evidenceOnly: false, setup: "s", comparedTo: null, suite: "su" };
  const idx = (iterations: object[], live = "s", suites = [{ id: "su" }]) => ({ live: { setup: live }, iterations, suites }) as unknown as EvalIndex;

  it("is unknown when no ?iteration= is given and no iteration ran the live setup", () => {
    expect(casesPageState(idx([it0], "other"), null)).toEqual({ kind: "unknown", requested: null });
  });

  it("is an error, not a crash, for a recorded iteration with no setup or suite", () => {
    expect(casesPageState(idx([{ ...it0, suite: null }]), "01-x")).toEqual({ kind: "error", message: "iteration 01-x has no setup or suite" });
  });

  it("is an error for an iteration whose suite the bundle doesn't ship (it would otherwise load forever)", () => {
    expect(casesPageState(idx([it0], "s", []), "01-x")).toEqual({ kind: "error", message: "iteration 01-x names suite su, which is not in the bundle" });
  });

  it("resolves a constructed iteration whose suite ships", () => {
    expect(casesPageState(idx([it0]), "01-x")).toMatchObject({ kind: "iteration", suite: "su", title: "Cases in 01" });
  });
});

describe("computeCases", () => {
  const st = casesPageState(index, "06-passages");
  if (st.kind !== "iteration") throw new Error("expected 06 to resolve");
  const runs = shippedRuns<CaseRun>(L92);
  const evalsets = [...new Set(runs.map((r) => r.config.evalset!))];
  const keys = Object.fromEntries(evalsets.map((e) => [e, shippedKey<CaseKey>(e)]));

  it("is not ready until the suite's data has loaded", () => {
    expect(computeCases(st, null)).toEqual({ rows: null, error: null });
  });

  it("computes the iteration's rows from the shipped suite", () => {
    const { rows, error } = computeCases(st, { runs, keys });
    expect(error).toBeNull();
    expect(rows!.find((r) => r.id === "skyhop_2026-10-26_2026-10-30:2026-21922")).toMatchObject({ expected: "flag", change: "fixed" });
  });

  it("turns a throw (an eval set without an answer key) into an error message instead of crashing the render", () => {
    const { [evalsets[0]]: _dropped, ...fewer } = keys;
    void _dropped;
    expect(computeCases(st, { runs, keys: fewer })).toEqual({ rows: null, error: `no answer key for eval set ${evalsets[0]}` });
  });
});

describe("filterChoices / activeFilter / selectedRow", () => {
  const rows = [{ id: "a", change: "fixed", expected: "flag", after: { hits: 1, finished: 2 } }, { id: "b", change: null, expected: "skip", after: { hits: 1, finished: 1 } }] as never;

  it("offers Changed in NN only when the iteration has a setup to compare with, each choice counted", () => {
    expect(filterChoices(rows, "06", true)).toEqual([
      { id: "changed", label: "Changed in 06", count: 1 },
      { id: "stillMissed", label: "Still missed", count: 1 },
      { id: "trapsFlagged", label: "Traps flagged", count: 1 },
      { id: "all", label: "All", count: 2 },
    ]);
    expect(filterChoices(rows, "00", false).map((c) => c.id)).toEqual(["stillMissed", "trapsFlagged", "all"]);
  });

  it("uses the first choice when none was picked, or the pick isn't offered (Changed on 00)", () => {
    const single = filterChoices(rows, "00", false);
    expect(activeFilter(null, single)).toBe("stillMissed");
    expect(activeFilter("changed", single)).toBe("stillMissed");
    expect(activeFilter("all", single)).toBe("all");
  });

  it("selects the picked row while it is shown, else the first shown row, else nothing", () => {
    const shown = rows as unknown as { id: string }[];
    expect(selectedRow(shown, "b")?.id).toBe("b");
    expect(selectedRow(shown, "gone")?.id).toBe("a");
    expect(selectedRow([], "a")).toBeNull();
  });
});
