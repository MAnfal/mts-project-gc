/**
 * Experiment 2 — what our evals look like. Everything it grades comes from poc/config/:
 * eval sets (frozen week + answer key) × setups (models × methods), gates from experiment.yaml.
 *
 * Following Anthropic's "Demystifying evals for AI agents":
 *  - grade the OUTCOME with code where possible (recall/precision on FR document numbers, dates vs the key),
 *  - grade the TRANSCRIPT as a secondary signal (did it ground on federalregister.gov?),
 *  - use an LLM judge only where code can't (is the action item clear?) — persisted on the run, not re-asked.
 *
 * EVAL_MODE=replay → grade the latest finished run per (eval set, setup) (free). Default.
 * EVAL_MODE=live   → execute fresh runs (spends money).
 */
import { expect } from "vitest";
import { createHarness, createJudge, describeEval } from "vitest-evals";
import { allCells, cellConfig, type Cell } from "../src/lib/arena";
import { evalsets, experiment, loadKey } from "../src/lib/config";
import { judgeClarity } from "../src/lib/judge";
import { execute, newRun } from "../src/lib/pipeline/run";
import { datesAgainstKey, scoreRun } from "../src/lib/score";
import { listRuns } from "../src/lib/store";
import type { LabelSet, RunRecord } from "../src/lib/types";

const LIVE = process.env.EVAL_MODE === "live";
const GATES = experiment().evals.gates;

type EvalSet = ReturnType<typeof evalsets>[number];
type CaseInput = { name: string; set: EvalSet; cell: Cell; key: LabelSet };
type CaseOutput = {
  runId: string;
  recall: number;
  precision: number;
  tp: number;
  fp: number;
  missed: string[];
  extra: string[];
  datesChecked: number;
  datesCorrect: number;
  datesShown: number;
  datesVerified: number;
  clarity: number | null;
  costUsd: number;
  seconds: number;
  groundedOnFR: boolean;
};

/** Same company, same week, same setup — never grade one company's run against another's key. */
const matches = (r: RunRecord, c: CaseInput) =>
  r.status === "done" &&
  r.config.profileId === c.set.company &&
  r.config.windowStart === c.set.windowStart &&
  r.config.windowEnd === c.set.windowEnd &&
  (r.config.cell ? r.config.cell === c.cell.key : r.config.model === c.cell.model && (c.cell.method === "baseline" ? r.config.mode === "baseline" : r.config.mode === "pipeline" && r.config.filter === c.cell.method));

async function getRun(c: CaseInput): Promise<RunRecord | null> {
  if (LIVE) {
    const r = await execute(newRun(cellConfig(c.cell, { profileId: c.set.company, windowStart: c.set.windowStart, windowEnd: c.set.windowEnd, asOf: c.set.asOf }, `eval-${Date.now().toString(36)}`)));
    if (r.status === "done") r.judge = await judgeClarity(r);
    return r;
  }
  return (await listRuns()).find((r) => matches(r, c)) ?? null;
}

const CASES: CaseInput[] = evalsets().flatMap((set) => {
  const key = loadKey(set.company, set.windowStart, set.windowEnd);
  return key ? allCells().map((cell) => ({ name: `${set.id} · ${cell.label}`, set, cell, key })) : [];
});

const harness = createHarness<CaseInput, CaseOutput>({
  name: "reg-monitor",
  run: async ({ input }) => {
    const run = await getRun(input);
    if (!run) throw new Error(`No finished run for "${input.name}" — run an arena or set EVAL_MODE=live.`);
    const s = scoreRun(run, input.key);
    const d = datesAgainstKey(run, input.key);
    // Transcript check: pipeline grounds on the FR API by construction; baseline must have searched AND every kept item resolved to FR.
    const searched = run.config.mode === "pipeline" || run.calls.some((c) => c.toolCalls?.some((t) => /search/i.test(t.name)));
    const output: CaseOutput = {
      runId: run.id,
      recall: s.recall,
      precision: s.precision,
      tp: s.tp,
      fp: s.fp,
      missed: s.missed,
      extra: s.extra,
      datesChecked: d.checked,
      datesCorrect: d.correct,
      datesShown: s.datesShown,
      datesVerified: s.datesVerified,
      clarity: run.judge?.clarity ?? null,
      costUsd: run.totalCostUsd + (run.judge?.costUsd ?? 0),
      seconds: run.totalMs / 1000,
      groundedOnFR: searched && run.stages.some((st) => st.name.startsWith("scan:federal-register") || st.name.includes("resolve")),
    };
    return {
      events: [
        { type: "message", role: "user", content: `${input.name} (${run.id})` },
        ...run.calls.flatMap((c, k) => (c.toolCalls ?? []).map((t, j) => ({ type: "tool_call" as const, id: `${k}-${j}`, name: t.name, arguments: (t.input ?? {}) as Record<string, never> }))),
        { type: "message", role: "assistant", content: run.markdown ?? "" },
      ],
      output,
      usage: {},
    };
  },
});

// ── Code graders ──
const RecallJudge = createJudge<CaseInput, CaseOutput>(`Recall ≥ ${GATES.recall}`, ({ output }) => ({ score: output.recall, metadata: { rationale: `found ${output.tp}; missed ${output.missed.join(", ") || "none"}` } }));
const PrecisionJudge = createJudge<CaseInput, CaseOutput>(`Precision ≥ ${GATES.precision}`, ({ output }) => ({ score: output.precision, metadata: { rationale: `extra ${output.extra.join(", ") || "none"}` } }));
const DatesJudge = createJudge<CaseInput, CaseOutput>("Dates match the key", ({ output }) => ({
  score: output.datesChecked ? output.datesCorrect / output.datesChecked : 1,
  metadata: { rationale: `${output.datesCorrect}/${output.datesChecked} found rules show the key's deadline` },
}));
// ── Model grader, persisted on the run when it finished ──
const ClarityJudge = createJudge<CaseInput, CaseOutput>(`Clarity (${experiment().judgeModel})`, ({ output }) => ({ score: output.clarity ?? 0, metadata: { rationale: output.clarity === null ? "no judge score on run" : "" } }));

describeEval(
  "regulatory triage · config/evalsets × config/setups",
  { harness, judges: [RecallJudge, PrecisionJudge, DatesJudge, ClarityJudge], judgeThreshold: null },
  (it) => {
    it.for(CASES)("$name", async (c, { run }) => {
      const o = (await run(c)).output;
      console.log(`${c.name}: recall ${o.recall.toFixed(2)} precision ${o.precision.toFixed(2)} dates ${o.datesCorrect}/${o.datesChecked} $${o.costUsd.toFixed(3)} ${o.seconds.toFixed(0)}s`);
      // Hard gates from the RFC (config/experiment.yaml). Expected to fail for some setups — that's the comparison.
      expect.soft(o.recall, "recall").toBeGreaterThanOrEqual(GATES.recall);
      expect.soft(o.precision, "precision").toBeGreaterThanOrEqual(GATES.precision);
      expect.soft(o.datesCorrect, "every found rule shows the key's deadline").toBe(o.datesChecked);
      expect.soft(o.datesVerified, "every shown date verified against the source").toBe(o.datesShown);
      expect.soft(o.groundedOnFR, "grounded on federalregister.gov").toBe(true);
    });
  },
);
