import type { EvalTargets } from "@/lib/config/schemas";
import type { AgreementNumber, EvalIndex, LabelledNumber, Split } from "./index-schema";

/**
 * The eval summary's headline, computed from index.json and config/app.yaml → evalTargets: which targets the
 * live setup meets on all weeks, and whether it beats the single-prompt baseline measure by measure.
 * Pure and client-safe: the summary page runs it in the browser after loading the index.
 */

type SetupResult = EvalIndex["live"];

/** The scoreboard rows, in order. The first five have targets; cost is compared with the baseline only. */
export const SCOREBOARD_MEASURES = ["recall", "precision", "datesRight", "tierAgreement", "relevanceAgreement", "costPerRunUsd"] as const;
export type ScoreMeasure = (typeof SCOREBOARD_MEASURES)[number];
export const TARGET_MEASURES = ["recall", "precision", "datesRight", "tierAgreement", "relevanceAgreement"] as const;
export type TargetMeasure = (typeof TARGET_MEASURES)[number];

/** Measures where a smaller value is the better one. */
const LOWER_IS_BETTER: ReadonlySet<ScoreMeasure> = new Set(["costPerRunUsd"]);
/** Shares in index.json are full-precision ratios; a target hit exactly must count as met. */
const EPS = 1e-9;

/** One measure of one setup in one split, or undefined when the result has no such measure. */
export function measureOf(r: SetupResult, m: ScoreMeasure, split: Split): LabelledNumber | AgreementNumber | undefined {
  return (r as Partial<SetupResult>)[m]?.[split];
}

export type TargetStatus = "met" | "near" | "missed" | "unmeasured";

/** met at or above `min`; near when at most `nearMiss` below; missed further below; unmeasured when null. */
export function targetStatus(value: number | null | undefined, min: number, nearMiss: number): TargetStatus {
  if (value === null || value === undefined) return "unmeasured";
  if (value >= min - EPS) return "met";
  if (value >= min - nearMiss - EPS) return "near";
  return "missed";
}

export type BaselineComparison = {
  measure: ScoreMeasure;
  live: LabelledNumber | AgreementNumber;
  baseline: LabelledNumber | AgreementNumber;
  outcome: "win" | "tie" | "loss";
};

export type Verdict = {
  targets: (
    | { measure: TargetMeasure; min: number; status: TargetStatus; value: LabelledNumber | AgreementNumber | undefined }
    | { measure: "beatsBaseline"; min: null; status: "met" | "missed"; value: undefined }
  )[];
  met: number;
  total: number;
  baseline: {
    comparisons: BaselineComparison[];
    /** Scoreboard measures left out because either side has no value: never counted as a win. */
    excluded: ScoreMeasure[];
    wins: number;
    compared: number;
    /** Live wins every compared measure, and at least one was compared. */
    beatsAll: boolean;
  };
};

export function computeVerdict(index: Pick<EvalIndex, "live" | "baseline">, targets: EvalTargets): Verdict {
  const comparisons: BaselineComparison[] = [];
  const excluded: ScoreMeasure[] = [];
  for (const m of SCOREBOARD_MEASURES) {
    const live = measureOf(index.live, m, "all");
    const baseline = measureOf(index.baseline, m, "all");
    if (live?.value == null || baseline?.value == null) {
      excluded.push(m);
      continue;
    }
    const diff = LOWER_IS_BETTER.has(m) ? baseline.value - live.value : live.value - baseline.value;
    comparisons.push({ measure: m, live, baseline, outcome: diff > EPS ? "win" : diff < -EPS ? "loss" : "tie" });
  }
  const wins = comparisons.filter((c) => c.outcome === "win").length;
  const beatsAll = comparisons.length > 0 && wins === comparisons.length;

  const graded: Verdict["targets"] = TARGET_MEASURES.map((m) => {
    const value = measureOf(index.live, m, "all");
    return { measure: m, min: targets[m], status: targetStatus(value?.value, targets[m], targets.nearMiss), value };
  });
  if (targets.beatsBaseline) graded.push({ measure: "beatsBaseline", min: null, status: beatsAll ? "met" : "missed", value: undefined });

  return {
    targets: graded,
    met: graded.filter((t) => t.status === "met").length,
    total: graded.length,
    baseline: { comparisons, excluded, wins, compared: comparisons.length, beatsAll },
  };
}
