import { describe, expect, it } from "vitest";
import { BUNDLE, shippedJson, shippedKey, shippedRuns, shippedSuiteIds } from "./__fixtures__/shipped";
import { caseCounts, casesForIteration, filterCases, formatTally, gradedFlags, liveIterationId, setupTotals, type CaseKey, type CaseRun } from "./cases";
import type { EvalIndex } from "./index-schema";

// Real shipped data: the 06 suite (l92) and every other suite in public/evals.
const L92 = "arena-2026-11-21-22-52-l92";
const POWER_BANK = "2026-21922";
const SKYHOP_OCT26 = "skyhop_2026-10-26_2026-10-30";
const IT06 = { setup: "jev-sonnet-strict-passages", comparedTo: "jev-sonnet-strict" };

type Report = { setups: { key: string; metrics: { recall: number | null; precision: number | null }; counts: { tp: number; fn: number; trapHit: number; tn: number; unlabeled: number } }[] };

const keysOf = (runs: CaseRun[]) => Object.fromEntries([...new Set(runs.map((r) => r.config.evalset!))].map((e) => [e, shippedKey<CaseKey>(e)]));

describe("casesForIteration on the shipped 06 suite", () => {
  const runs = shippedRuns<CaseRun>(L92);
  const rows = casesForIteration(runs, IT06, keysOf(runs));

  it("lists the power-bank case (SkyHop, Oct 26–30) as changed, fixed from 0/3 to 3/3", () => {
    const changed = filterCases(rows, "changed");
    const pb = changed.find((r) => r.evalset === SKYHOP_OCT26 && r.doc === POWER_BANK);
    expect(pb).toMatchObject({ expected: "flag", kind: "direct", change: "fixed" });
    expect(formatTally(pb!.after)).toBe("3/3");
    expect(formatTally(pb!.before!)).toBe("0/3");
  });

  it("has one row per keyed doc of every eval set the suite ran (relevant ∪ traps)", () => {
    const want = Object.values(keysOf(runs)).reduce((n, k) => n + k.relevant.length + Object.keys(k.traps).length, 0);
    expect(rows).toHaveLength(want);
    expect(caseCounts(rows).all).toBe(want);
  });

  it("After and Before equal a direct count over the run records", () => {
    for (const row of rows) {
      for (const [setup, tally] of [
        [IT06.setup, row.after],
        [IT06.comparedTo, row.before!],
      ] as const) {
        let hits = 0;
        let finished = 0;
        for (const r of runs) {
          if (r.config.cell !== setup || r.config.evalset !== row.evalset || r.superseded || r.status !== "done") continue;
          finished++;
          if ((r.items ?? []).some((i) => i.document_number === row.doc)) hits++;
        }
        expect({ row: row.id, setup, hits: tally.hits, finished: tally.finished }).toEqual({ row: row.id, setup, hits, finished });
      }
    }
  });

  it("lists every repeat, the failed one too, but counts only finished ones (cornercare Nov 9–13: 2 of 3 finished)", () => {
    const row = rows.find((r) => r.evalset === "cornercare_2026-11-09_2026-11-13")!;
    expect(row.after.repeats.map((x) => x.repeat)).toEqual([0, 1, 2]);
    expect(row.after.repeats.map((x) => x.status)).toEqual(["done", "done", "error"]);
    expect(row.after.repeats[2].hit).toBeNull();
    expect(row.after.finished).toBe(2);
    expect(row.before!.finished).toBe(3);
  });

  it("does not call a case changed when only the number of finished repeats differs (2/2 vs 3/3)", () => {
    const same = rows.filter((r) => r.after.finished === 2 && r.before!.finished === 3 && r.after.hits === 2 && r.before!.hits === 3);
    expect(same.length).toBeGreaterThan(0);
    for (const r of same) expect(r.change).toBeNull();
  });

  it("counts each filter as its definition says", () => {
    const counts = caseCounts(rows);
    expect(counts.changed).toBe(rows.filter((r) => r.change !== null).length);
    expect(counts.stillMissed).toBe(rows.filter((r) => r.expected === "flag" && r.after.hits < r.after.finished).length);
    expect(counts.trapsFlagged).toBe(rows.filter((r) => r.expected === "skip" && r.after.hits > 0).length);
    expect(counts.changed).toBeGreaterThan(0);
  });
});

describe("per-case sums reproduce each suite's report.json (subset grading)", () => {
  for (const suite of shippedSuiteIds()) {
    it(`${suite}: every setup's tp / fn / trapHit / tn, unlabeled, recall and precision`, () => {
      const runs = shippedRuns<CaseRun>(suite);
      const keys = keysOf(runs);
      const report = shippedJson<Report>(`suites/${suite}/report.json`);
      expect(report.setups.length).toBeGreaterThan(0);
      for (const s of report.setups) {
        const rows = casesForIteration(runs, { setup: s.key, comparedTo: null }, keys);
        const sum = (expected: "flag" | "skip", f: (t: { hits: number; finished: number }) => number) =>
          rows.filter((r) => r.expected === expected).reduce((n, r) => n + f(r.after), 0);
        const fromCases = {
          tp: sum("flag", (t) => t.hits),
          fn: sum("flag", (t) => t.finished - t.hits),
          trapHit: sum("skip", (t) => t.hits),
          tn: sum("skip", (t) => t.finished - t.hits),
        };
        const { counts } = s;
        expect({ setup: s.key, ...fromCases }).toEqual({ setup: s.key, tp: counts.tp, fn: counts.fn, trapHit: counts.trapHit, tn: counts.tn });

        const totals = setupTotals(runs, s.key, keys);
        expect({ setup: s.key, tp: totals.tp, fn: totals.fn, trapHit: totals.trapHit, unlabeled: totals.unlabeled }).toEqual({
          setup: s.key,
          tp: counts.tp,
          fn: counts.fn,
          trapHit: counts.trapHit,
          unlabeled: counts.unlabeled,
        });
        expect(totals.recall).toBeCloseTo(s.metrics.recall!, 10);
        expect(totals.precision).toBeCloseTo(s.metrics.precision!, 10);
      }
    });
  }

  it("covers all 9 shipped suites (so a missing suite can't pass by being skipped)", () => {
    expect(shippedSuiteIds()).toHaveLength(9);
    expect(BUNDLE).toMatch(/public\/evals$/);
  });
});

// ── Constructed inputs: each guard driven off the shipped data ──

const KEY: CaseKey = {
  relevant: ["R1"],
  details: { R1: { kind: "indirect", reason: "changes what customers buy" } },
  traps: { T1: { reason: "binds someone else" } },
};
const run = (id: string, setup: string, repeat: number, items: string[] | null, extra: Partial<CaseRun> = {}): CaseRun => ({
  id,
  status: items === null ? "error" : "done",
  config: { cell: setup, evalset: "e1", repeatIndex: repeat },
  items: items?.map((document_number) => ({ document_number })),
  ...extra,
});
const it2 = { setup: "new", comparedTo: "old" };

describe("casesForIteration guards", () => {
  it("shows — for a setup with no repeats on that eval set, not 0/3, and never calls it changed", () => {
    const rows = casesForIteration([run("a", "new", 0, ["R1"]), run("b", "new", 1, ["R1"]), run("c", "new", 2, [])], it2, { e1: KEY });
    const r1 = rows.find((r) => r.doc === "R1")!;
    expect(formatTally(r1.after)).toBe("2/3");
    expect(r1.before).toEqual({ hits: 0, finished: 0, repeats: [] });
    expect(formatTally(r1.before!)).toBe("—");
    expect(r1.change).toBeNull();
  });

  it("shows — for a setup whose every repeat failed", () => {
    const rows = casesForIteration([run("a", "new", 0, null)], { setup: "new", comparedTo: null }, { e1: KEY });
    expect(formatTally(rows[0].after)).toBe("—");
    expect(rows[0].before).toBeNull();
  });

  it("compares hit rates, not hit counts, across unequal denominators", () => {
    const runs = [
      run("n0", "new", 0, ["R1"]),
      run("n1", "new", 1, []),
      run("n2", "new", 2, null),
      run("o0", "old", 0, ["R1"]),
      run("o1", "old", 1, ["R1"]),
      run("o2", "old", 2, []),
    ];
    const r1 = casesForIteration(runs, it2, { e1: KEY }).find((r) => r.doc === "R1")!;
    expect([formatTally(r1.after), formatTally(r1.before!)]).toEqual(["1/2", "2/3"]);
    expect(r1.change).toBe("regressed");
  });

  it("2/2 vs 3/3 is not a change", () => {
    const runs = [run("n0", "new", 0, ["R1"]), run("n1", "new", 1, ["R1"]), run("n2", "new", 2, null), ...[0, 1, 2].map((i) => run(`o${i}`, "old", i, ["R1"]))];
    expect(casesForIteration(runs, it2, { e1: KEY }).find((r) => r.doc === "R1")!.change).toBeNull();
  });

  it("for a Skip (trap) row a hit means flagged: flagged less often is Fixed, more often is Regressed", () => {
    const fewer = casesForIteration([run("n", "new", 0, []), run("o", "old", 0, ["T1"])], it2, { e1: KEY }).find((r) => r.doc === "T1")!;
    expect(fewer).toMatchObject({ expected: "skip", kind: "trap", change: "fixed", reason: "binds someone else" });
    const more = casesForIteration([run("n", "new", 0, ["T1"]), run("o", "old", 0, [])], it2, { e1: KEY }).find((r) => r.doc === "T1")!;
    expect(more.change).toBe("regressed");
    expect(more.after.hits).toBe(1);
  });

  it("carries the key's kind and short reason for a Flag row", () => {
    const r1 = casesForIteration([run("n", "new", 0, ["R1"])], it2, { e1: KEY }).find((r) => r.doc === "R1")!;
    expect(r1).toMatchObject({ expected: "flag", kind: "indirect", reason: "changes what customers buy", change: null });
  });

  it("leaves superseded runs out of every tally", () => {
    const runs = [run("n", "new", 0, []), run("n-old", "new", 0, ["R1"], { superseded: true })];
    const r1 = casesForIteration(runs, { setup: "new", comparedTo: null }, { e1: KEY }).find((r) => r.doc === "R1")!;
    expect(r1.after).toEqual({ hits: 0, finished: 1, repeats: [{ id: "n", repeat: 0, status: "done", hit: false }] });
  });

  it("orders repeats by repeat index, whatever the record order", () => {
    const runs = [run("b", "new", 2, []), run("a", "new", 0, []), run("c", "new", 1, [])];
    const r1 = casesForIteration(runs, { setup: "new", comparedTo: null }, { e1: KEY })[0];
    expect(r1.after.repeats.map((x) => x.id)).toEqual(["a", "c", "b"]);
  });

  it("reads a v1 key whose traps are a list", () => {
    const rows = casesForIteration([run("n", "new", 0, ["T9"])], { setup: "new", comparedTo: null }, { e1: { relevant: [], traps: ["T9"] } });
    expect(rows).toEqual([expect.objectContaining({ doc: "T9", expected: "skip", reason: null })]);
    expect(rows[0].after.hits).toBe(1);
  });

  it("throws naming the eval set when it has no answer key", () => {
    expect(() => casesForIteration([run("n", "new", 0, [])], it2, {})).toThrow("no answer key for eval set e1");
  });

  it("throws naming the run when it records no eval set", () => {
    const bad = { ...run("x", "new", 0, []), config: { cell: "new", repeatIndex: 0 } };
    expect(() => casesForIteration([bad], it2, { e1: KEY })).toThrow("run x has no eval set");
  });
});

describe("gradedFlags (subset grading)", () => {
  it("keeps only the run's flags that the key labels; unlabeled flags are not graded", () => {
    expect([...gradedFlags(run("n", "new", 0, ["R1", "T1", "X9"]), KEY)].sort()).toEqual(["R1", "T1"]);
  });

  it("is empty for a failed run with no items", () => {
    expect(gradedFlags(run("n", "new", 0, null), KEY).size).toBe(0);
  });
});

describe("setupTotals", () => {
  it("counts unlabeled flags without penalising precision", () => {
    const t = setupTotals([run("n", "new", 0, ["R1", "X9", "X8"])], "new", { e1: KEY });
    expect(t).toEqual({ runs: 1, tp: 1, fn: 0, trapHit: 0, tn: 1, unlabeled: 2, recall: 1, precision: 1 });
  });

  it("leaves superseded runs out", () => {
    const t = setupTotals([run("n", "new", 0, []), run("n-old", "new", 0, ["R1"], { superseded: true })], "new", { e1: KEY });
    expect(t).toMatchObject({ runs: 1, tp: 0, fn: 1 });
  });

  it("throws naming the eval set when it has no answer key", () => {
    expect(() => setupTotals([run("n", "new", 0, [])], "new", {})).toThrow("no answer key for eval set e1");
  });

  it("returns null ratios when nothing was graded", () => {
    expect(setupTotals([run("n", "new", 0, null)], "new", { e1: KEY })).toMatchObject({ runs: 0, recall: null, precision: null });
  });
});

describe("filterCases", () => {
  const runs = [run("n", "new", 0, ["T1"]), run("o", "old", 0, ["R1"])];
  const rows = casesForIteration(runs, it2, { e1: KEY });
  it("all returns every row; the rest follow caseCounts", () => {
    expect(filterCases(rows, "all")).toHaveLength(2);
    expect(filterCases(rows, "stillMissed").map((r) => r.doc)).toEqual(["R1"]);
    expect(filterCases(rows, "trapsFlagged").map((r) => r.doc)).toEqual(["T1"]);
    expect(filterCases(rows, "changed").map((r) => r.doc).sort()).toEqual(["R1", "T1"]);
    expect(caseCounts(rows)).toEqual({ changed: 2, stillMissed: 1, trapsFlagged: 1, all: 2 });
  });
});

describe("liveIterationId", () => {
  it("is the last iteration that ran the live setup (06 in the shipped index)", () => {
    expect(liveIterationId(shippedJson<EvalIndex>("index.json"))).toBe("06-passages");
  });

  it("is null when no iteration ran the live setup", () => {
    const index = { live: { setup: "x" }, iterations: [{ id: "00", setup: "y" }] } as unknown as EvalIndex;
    expect(liveIterationId(index)).toBeNull();
  });
});
