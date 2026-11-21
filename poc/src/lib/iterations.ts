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
