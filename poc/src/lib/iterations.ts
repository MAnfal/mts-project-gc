import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { DATA } from "./paths";

/**
 * Improvement iterations (data/iterations/<NN-slug>/): the story (hypothesis → change → result → decision),
 * the measured results, the evidence that motivated the change (error-analysis.json: code graders, trace checks
 * and judge verdicts on dev weeks), and the exact diffs (system.diff, config.diff).
 */
export interface IterationMetrics {
  setup: string;
  label: string;
  runs: number;
  recall: number | null;
  precision: number | null;
  trapAvoidance: number | null;
  datesRight: number | null;
  judgePass: number | null;
  consistency: number | null;
  score: number | null;
  perRun: Record<string, number>;
  devCasesRight: string | null;
  testCasesRight: string | null;
  costPerRunUsd: number;
  secondsPerRun: number | null;
}

export interface Iteration {
  id: string;
  title: string;
  date: string;
  suite: string;
  setup: string;
  comparedTo?: string;
  /** Failure buckets / rootCause:<i> from error-analysis.json this change targets (required from iteration 05 on). */
  targets?: string[];
  hypothesis: string;
  change: string;
  codeChanges?: string;
  evalChanges?: string;
  decision: string;
  notes?: string;
  regraded?: string;
  results: { candidate: IterationMetrics; comparedTo?: IterationMetrics };
  code?: { commit: string; uncommittedSrcChanges: number };
  systemChanges?: string[];
  configChangesSincePrevious?: { previous: string | null; files: string[] };
  systemDiff?: string;
  configDiff?: string;
  evidence?: { runs: number; excludedTestRuns?: number; bySignal: Record<string, number>; buckets: [string, number][]; rootCauses?: { cause: string; whose: string; failures: number; proposedChange: string }[] };
}

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined);

export function listIterations(): Iteration[] {
  const dir = path.join(DATA(), "iterations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "iteration.yaml")))
    .sort()
    .map((d) => {
      const it = YAML.parse(fs.readFileSync(path.join(dir, d, "iteration.yaml"), "utf8")) as Iteration;
      const ea = read(path.join(dir, d, "error-analysis.json"));
      const e = ea ? JSON.parse(ea) : undefined;
      return {
        ...it,
        date: String(it.date),
        systemDiff: read(path.join(dir, d, "system.diff")),
        configDiff: read(path.join(dir, d, "config.diff")),
        evidence: e ? { runs: e.runs, excludedTestRuns: e.excludedTestRuns, bySignal: e.bySignal, buckets: e.buckets, rootCauses: e.llm?.rootCauses } : undefined,
      };
    });
}

/** The slice of error-analysis.json the evidence gate reads. */
export interface ErrorAnalysisSummary {
  suite: string;
  split: string;
  generatedAt: string;
  bySignal: Record<string, number>;
  buckets: [string, number][];
  llm?: { rootCauses?: { cause: string }[] } | null;
}

/**
 * Evidence gate for recording a new iteration. Every change after the first must start from a dev-only error analysis
 * of the PREVIOUS iteration's suite that includes the judge panel's verdicts, written BEFORE the new suite ran, and
 * the spec must name which failures it targets (bucket names, or "rootCause:<i>" from the analysis' LLM grouping).
 * Returns the problems; empty = OK.
 */
export function evidenceProblems(
  spec: { comparedTo?: string; targets?: string[] },
  analysis: ErrorAnalysisSummary | null,
  ctx: { previousSuite: string | null; suiteStartedAt: string },
): string[] {
  if (!spec.comparedTo) return [];
  if (!analysis) return ["no error-analysis.json in the iteration folder: run scripts/error-analysis.mts on the previous suite first"];
  const p: string[] = [];
  if (ctx.previousSuite && analysis.suite !== ctx.previousSuite) p.push(`error analysis is of ${analysis.suite}, not the previous iteration's suite ${ctx.previousSuite}`);
  if (analysis.split !== "dev") p.push(`error analysis split is "${analysis.split}"; only dev weeks may drive changes`);
  if (analysis.bySignal.judge === undefined) p.push("error analysis has no judge signal: judge feedback must be part of the evidence");
  if (analysis.generatedAt >= ctx.suiteStartedAt) p.push(`error analysis (${analysis.generatedAt}) must be written before the iteration's suite started (${ctx.suiteStartedAt})`);
  const targets = spec.targets ?? [];
  if (!targets.length) p.push("spec has no targets: name the failure buckets or rootCause:<i> this change is meant to fix");
  const buckets = new Set(analysis.buckets.map(([b]) => b));
  const causes = analysis.llm?.rootCauses ?? [];
  const unknown = targets.filter((t) => {
    const m = /^rootCause:(\d+)$/.exec(t);
    return m ? !causes[Number(m[1])] : !buckets.has(t);
  });
  if (unknown.length) p.push(`targets not found in the error analysis: ${unknown.join(", ")}`);
  return p;
}
