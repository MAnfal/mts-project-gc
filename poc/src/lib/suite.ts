import { allCells, cellByKey, suiteCells } from "./arena";
import { evalsets, experiment, getCompany, loadKey, pipelineCfg } from "./config";
import { aggregate, gradeRun, passK, type Ratio, type RunGrade } from "./grade";
import { modelLabel } from "./models";
import { panelSummary } from "./panel";
import { checkTrace } from "./trace-checks";
import { readTrace } from "./trace";
import type { RunRecord } from "./types";
import fs from "node:fs";
import { traceFile } from "./trace";

// Trace checks are pure functions of a finished trace file: cache them per file + mtime so the dashboard
// doesn't gunzip and re-check every trace on each render.
const checkCache = new Map<string, { mtimeMs: number; checks: ReturnType<typeof checkTrace> }>();
function cachedChecks(runId: string) {
  const f = traceFile(runId);
  if (!f) return null;
  const { mtimeMs } = fs.statSync(f);
  const hit = checkCache.get(f);
  if (hit && hit.mtimeMs === mtimeMs) return hit.checks;
  const events = readTrace(runId);
  if (!events.length) return null;
  const checks = checkTrace(events as never);
  checkCache.set(f, { mtimeMs, checks });
  return checks;
}

/** Weighted mean of the metrics that exist (null metrics are skipped, not counted as 0). */
export function overallScore(metrics: Record<string, number | null | undefined>, weights: Record<string, number>): number | null {
  let num = 0;
  let den = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = metrics[k];
    if (v === null || v === undefined || Number.isNaN(v) || !w) continue;
    num += v * w;
    den += w;
  }
  return den ? num / den : null;
}

const r = (x: Ratio) => (x.total ? x.correct / x.total : null);

type Counts = { tp: number; fn: number; trapHit: number; tn: number; unlabeled: number };
/** Outcome counts per run (totals ÷ graded runs), so setups with different run counts compare fairly. */
export function perRun(c: Counts, runs: number): Counts {
  const d = (x: number) => (runs ? x / runs : 0);
  return { tp: d(c.tp), fn: d(c.fn), trapHit: d(c.trapHit), tn: d(c.tn), unlabeled: d(c.unlabeled) };
}

/** Average in → out count, time and cost per pipeline stage across runs (the funnel on the "How it works" tab). */
export function stageFunnel(runs: Pick<RunRecord, "stages">[]) {
  const by = new Map<string, { ins: number[]; outs: number[]; ms: number[]; cost: number[] }>();
  for (const run of runs)
    for (const s of run.stages) {
      const b = by.get(s.name) ?? { ins: [], outs: [], ms: [], cost: [] };
      if (typeof s.inCount === "number") b.ins.push(s.inCount);
      if (typeof s.outCount === "number") b.outs.push(s.outCount);
      b.ms.push(s.ms);
      b.cost.push(s.costUsd);
      by.set(s.name, b);
    }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return [...by.entries()].map(([name, b]) => ({ name, inAvg: avg(b.ins), outAvg: avg(b.outs), msAvg: avg(b.ms), costAvg: avg(b.cost) }));
}

/** Everything the interviewer dashboard shows, computed from the runs of one arena. */
export function suiteReport(runs: RunRecord[]) {
  const rules = pipelineCfg().tiering;
  const weights = experiment().evals.scoreWeights;
  const sets = new Map(evalsets().map((e) => [e.id, e]));
  // An eval set for a run: recorded id, else matched by company + window (older arenas).
  const setOf = (run: RunRecord) =>
    run.config.evalset ?? [...sets.values()].find((e) => e.company === run.config.profileId && e.windowStart === run.config.windowStart)?.id ?? `${run.config.profileId}_${run.config.windowStart}`;
  const live = runs.filter((x) => !x.error?.startsWith("Superseded"));

  const graded: { run: RunRecord; set: string; g: RunGrade }[] = [];
  for (const run of live.filter((x) => x.status === "done")) {
    const key = loadKey(run.config.profileId, run.config.windowStart, run.config.windowEnd);
    if (!key) continue;
    graded.push({ run, set: setOf(run), g: gradeRun(run, key, getCompany(run.config.profileId), rules) });
  }

  const order = [...suiteCells(), ...allCells()].map((c) => c.key);
  const idx = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  const cellKeys = [...new Set(live.map((x) => x.config.cell!).filter(Boolean))].sort((a, b) => idx(a) - idx(b));
  const setups = cellKeys.map((key) => {
    const cell = cellByKey(key);
    const mine = graded.filter((x) => x.run.config.cell === key);
    const all = live.filter((x) => x.config.cell === key);
    const agg = aggregate(mine.map((x) => x.g));
    // pass^k: per eval set, line up the repeats' case results; cases from every set pooled together.
    const bySet = new Map<string, Record<string, boolean>[]>();
    for (const x of mine) bySet.set(x.set, [...(bySet.get(x.set) ?? []), x.g.caseCorrect]);
    const maxK = bySet.size ? Math.min(...[...bySet.values()].map((v) => v.length), 5) : 0;
    const pass = Array.from({ length: maxK }, (_, i) => {
      const k = i + 1;
      let num = 0;
      let den = 0;
      for (const perRun of bySet.values()) {
        const n = Object.keys(perRun[0] ?? {}).length;
        const p = passK(perRun, k);
        if (!Number.isNaN(p)) {
          num += p * n;
          den += n;
        }
      }
      return { k, value: den ? num / den : null };
    });
    // The panel doesn't need the key's flags (clarity/grounding), so it uses every finished run.
    const panel = panelSummary(all.filter((x) => x.status === "done"));
    const doneMs = all.filter((x) => x.status === "done").map((x) => x.totalMs);
    // Process checks on each finished run's trace (runs before tracing existed have no trace and are skipped).
    const tc = all
      .filter((x) => x.status === "done")
      .map((x) => cachedChecks(x.id))
      .filter((c): c is NonNullable<typeof c> => !!c);
    const traceChecks = tc.length ? tc.reduce((a, c) => a + c.filter((x) => x.pass).length, 0) / tc.reduce((a, c) => a + c.length, 0) : null;
    const traceFailures = [...new Set(tc.flatMap((c) => c.filter((x) => !x.pass).map((x) => x.label)))];
    const metrics = {
      recall: agg.recall,
      precision: agg.precision,
      trapAvoidance: agg.trapAvoidance,
      datesRight: r(agg.checks.date),
      tierRight: r(agg.checks.tier),
      ownerRight: r(agg.checks.owner),
      judgePass: panel.passRate,
      consistency: pass.length > 1 ? pass[pass.length - 1].value : null,
      traceChecks,
    };
    // Per company and per split slices, for the "where does it break" heatmap.
    const extra: Record<string, Ratio> = {};
    for (const x of mine) {
      const e = sets.get(x.set);
      for (const tag of [`company:${x.run.config.profileId}`, e ? `split:${(e as { split?: string }).split ?? "dev"}` : null].filter(Boolean) as string[]) {
        const c = extra[tag] ?? { correct: 0, total: 0 };
        const ok = Object.values(x.g.caseCorrect).filter(Boolean).length;
        extra[tag] = { correct: c.correct + ok, total: c.total + Object.keys(x.g.caseCorrect).length };
      }
    }
    const costUsd = all.reduce((a, x) => a + x.totalCostUsd + (x.judge?.costUsd ?? 0) + (x.panel?.costUsd ?? 0), 0);
    return {
      key,
      /** Fixed by config order, so a setup keeps its color however the ranking changes. */
      colorIndex: cellKeys.indexOf(key),
      label: cell?.label ?? key,
      model: cell?.model ?? all[0]?.config.model ?? "",
      modelLabel: modelLabel(cell?.model ?? all[0]?.config.model ?? ""),
      method: cell?.method ?? all[0]?.config.mode ?? "",
      runs: all.length,
      finished: all.filter((x) => x.status === "done").length,
      failed: all.filter((x) => x.status === "error").length,
      running: all.filter((x) => x.status === "running").length,
      graded: mine.length,
      score: overallScore(metrics, weights),
      metrics,
      counts: agg.counts,
      countsPerRun: perRun(agg.counts, mine.length),
      funnel: stageFunnel(all.filter((x) => x.status === "done")),
      config: cell ? { model: cell.model, method: cell.method, promptSet: cell.promptSet ?? "default" } : null,
      slices: { ...agg.slices, ...extra },
      pass,
      panel,
      madeUp: agg.madeUp,
      costUsd,
      costPerRun: all.length ? costUsd / all.length : 0,
      msMean: doneMs.length ? doneMs.reduce((a, b) => a + b, 0) / doneMs.length : null,
      errors: all.filter((x) => x.error).map((x) => x.error!),
      traceFailures,
      runIds: all.map((x) => x.id),
    };
  });
  setups.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return {
    setups,
    evalsets: [...new Set(graded.map((x) => x.set))],
    totals: { runs: live.length, costUsd: runs.reduce((a, x) => a + x.totalCostUsd + (x.judge?.costUsd ?? 0) + (x.panel?.costUsd ?? 0), 0), running: live.filter((x) => x.status === "running").length },
    weights,
  };
}

export type SuiteReport = ReturnType<typeof suiteReport>;
