import type { EvalIndex, LabelledNumber } from "./index-schema";
import type { EvalStory, Outcome } from "./story-schema";

/**
 * The "How it got here" chart's data: recall and precision per iteration over that iteration's own suite,
 * split into segments wherever the eval set changed size, plus the noise band at the live point. Pure and
 * client-safe.
 */

export type Marker = "filled" | "hollow" | "square";

export type ChartPoint = {
  id: string;
  label: string;
  outcome: Outcome;
  marker: Marker;
  /** The iteration that ran the live setup. */
  live: boolean;
  suite: string;
  evalsets: number;
  segment: number;
  recall: LabelledNumber;
  precision: LabelledNumber;
};

export type ChartSeries = {
  points: ChartPoint[];
  segments: number[];
  /** One row per point; `recall_<segment>` / `precision_<segment>` set only in the point's own segment. */
  rows: ({ id: string } & Record<string, number | string | null>)[];
  breaks: { before: string; from: number; to: number }[];
  band: {
    at: string;
    setup: string;
    suites: [string, string];
    recall: [number, number] | null;
    precision: [number, number] | null;
  } | null;
};

export const markerFor = (o: Outcome): Marker => (o === "reference" ? "square" : o === "kept" || o === "promoted" ? "filled" : "hollow");

const evalsetCount = (index: EvalIndex, suiteId: string) => index.suites.find((s) => s.id === suiteId)?.evalsets.length;

export function chartSeries(index: EvalIndex, story: EvalStory): ChartSeries {
  const points: ChartPoint[] = [];
  for (const it of index.iterations) {
    const s = story.iterations[it.id];
    if (!s) throw new Error(`iteration ${it.id} has no entry in config/eval-story.yaml`);
    if (!it.measured || !it.suite) continue;
    const evalsets = evalsetCount(index, it.suite);
    if (evalsets === undefined) throw new Error(`iteration ${it.id} ran on suite ${it.suite}, which is not in index.json`);
    const prev = points.at(-1);
    const segment = !prev ? 0 : prev.evalsets === evalsets ? prev.segment : prev.segment + 1;
    const c = it.measured.candidate;
    points.push({
      id: it.id,
      label: s.label,
      outcome: s.outcome,
      marker: markerFor(s.outcome),
      live: it.setup === index.live.setup,
      suite: it.suite,
      evalsets,
      segment,
      recall: c.recall.all,
      precision: c.precision.all,
    });
  }

  const rows = points.map((p) => ({ id: p.id, [`recall_${p.segment}`]: p.recall.value, [`precision_${p.segment}`]: p.precision.value }));
  const breaks = points.slice(1).flatMap((p, i) => (p.segment !== points[i].segment ? [{ before: p.id, from: points[i].evalsets, to: p.evalsets }] : []));

  const livePoint = points.findLast((p) => p.live);
  const nb = index.noiseBand;
  const around = (v: number | null, spread: number | null): [number, number] | null =>
    v === null || spread === null ? null : [Math.max(0, v - spread), Math.min(1, v + spread)];
  const band =
    nb && livePoint
      ? {
          at: livePoint.id,
          setup: nb.setup,
          suites: nb.suites,
          recall: around(livePoint.recall.value, nb.measures.recall.value),
          precision: around(livePoint.precision.value, nb.measures.precision.value),
        }
      : null;

  return { points, segments: [...new Set(points.map((p) => p.segment))], rows, breaks, band };
}

/** How a candidate-minus-control gap reads against the band: under it is within noise, at or over it beyond. */
export function noiseVerdict(gap: number, band: number | null | undefined): "no change" | "within noise" | "beyond noise" | null {
  if (gap === 0) return "no change";
  if (band === null || band === undefined) return null;
  return Math.abs(gap) < band ? "within noise" : "beyond noise";
}

/** The band was measured on the live suites; it only describes gaps on suites of the same eval-set size. */
export function bandApplies(index: EvalIndex, suiteId: string): boolean {
  const nb = index.noiseBand;
  if (!nb) return false;
  const size = evalsetCount(index, suiteId);
  return size !== undefined && nb.suites.every((s) => evalsetCount(index, s) === size);
}
