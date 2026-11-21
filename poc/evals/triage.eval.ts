/**
 * Experiment 2 — what our evals look like.
 *
 * Following Anthropic's "Demystifying evals for AI agents":
 *  - grade the OUTCOME with code where possible (recall/precision on FR document numbers,
 *    dates checked against the primary source),
 *  - grade the TRANSCRIPT as a secondary signal (did it ground on federalregister.gov?),
 *  - use an LLM judge only where code can't (is the action item usable?).
 *
 * EVAL_MODE=replay  → grade the latest saved run per case (free, regression-style).
 * EVAL_MODE=live    → execute fresh runs (spends money; capability-style). Default: replay.
 */
import { generateText, Output } from "ai";
import { expect } from "vitest";
import { createHarness, createJudge, describeEval } from "vitest-evals";
import { z } from "zod";
import { gw } from "../src/lib/gateway";
import { execute, newRun } from "../src/lib/pipeline/run";
import { scoreRun } from "../src/lib/score";
import { listRuns, loadLabels } from "../src/lib/store";
import type { RunConfig, RunRecord } from "../src/lib/types";

const WINDOW = { profileId: "ledgerly", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13" };
const MODEL = process.env.EVAL_MODEL ?? "anthropic/claude-sonnet-5.5";
const LIVE = process.env.EVAL_MODE === "live";

type CaseInput = { name: string; config: RunConfig };
type CaseOutput = {
  runId: string;
  recall: number;
  precision: number;
  tp: number;
  fp: number;
  fn: number;
  missed: string[];
  extra: string[];
  datesShown: number;
  datesVerified: number;
  unresolved: number;
  costUsd: number;
  seconds: number;
  items: { document_number: string; tier: string; owner: string; action: string; reason: string; sourceTag: string }[];
  groundedOnFR: boolean;
};

const CASES: CaseInput[] = [
  { name: "pipeline · jev@0.1 → llm", config: { ...WINDOW, mode: "pipeline", model: MODEL, filter: "jev+llm", jevThreshold: 0.1, webLeads: false } },
  { name: "pipeline · llm on every doc", config: { ...WINDOW, mode: "pipeline", model: MODEL, filter: "llm", jevThreshold: 0, webLeads: false } },
  { name: "baseline · one prompt + native search", config: { ...WINDOW, mode: "baseline", model: MODEL, filter: "llm", jevThreshold: 0, webLeads: false } },
];

const sameCfg = (a: RunConfig, b: RunConfig) =>
  a.mode === b.mode && a.model === b.model && a.windowStart === b.windowStart && a.windowEnd === b.windowEnd &&
  (a.mode === "baseline" || (a.filter === b.filter && (a.filter === "llm" || a.jevThreshold === b.jevThreshold)));

async function getRun(cfg: RunConfig): Promise<RunRecord | null> {
  if (LIVE) return execute(newRun(cfg));
  return (await listRuns()).find((r) => r.status === "done" && sameCfg(r.config, cfg)) ?? null;
}

const harness = createHarness<CaseInput, CaseOutput>({
  name: "reg-monitor",
  run: async ({ input }) => {
    const labels = await loadLabels(WINDOW.profileId, WINDOW.windowStart, WINDOW.windowEnd);
    if (!labels?.relevant.length) throw new Error("No labels — label the week at /label first.");
    const run = await getRun(input.config);
    if (!run) throw new Error(`No saved run for "${input.name}" — run it from the UI or set EVAL_MODE=live.`);
    const s = scoreRun(run, labels);
    const items = (run.items ?? []).map((i) => ({ document_number: i.document_number, tier: i.tier, owner: i.owner.name, action: i.action, reason: i.reason, sourceTag: i.sourceTag }));
    // Transcript check: pipeline grounds on the FR API by construction; baseline must have searched AND every kept item resolved to FR.
    const searched = run.calls.some((c) => c.toolCalls?.some((t) => /search/i.test(t.name))) || run.config.mode === "pipeline";
    const output: CaseOutput = {
      runId: run.id,
      recall: s.recall,
      precision: s.precision,
      tp: s.tp,
      fp: s.fp,
      fn: s.fn,
      missed: s.missed,
      extra: s.extra,
      datesShown: s.datesShown,
      datesVerified: s.datesVerified,
      unresolved: s.unresolved,
      costUsd: run.totalCostUsd,
      seconds: run.totalMs / 1000,
      items,
      groundedOnFR: searched && run.stages.some((st) => st.name.startsWith("scan:federal-register") || st.name.includes("resolve")),
    };
    return {
      events: [
        { type: "message", role: "user", content: `${input.name} (${run.id})` },
        ...run.calls.flatMap((c, k) => [
          ...(c.toolCalls ?? []).map((t, j) => ({ type: "tool_call" as const, id: `${k}-${j}`, name: t.name, arguments: (t.input ?? {}) as Record<string, never> })),
        ]),
        { type: "message", role: "assistant", content: run.markdown ?? "" },
      ],
      output,
      usage: {},
    };
  },
});

// ── Code graders ──
const RecallJudge = createJudge<CaseInput, CaseOutput>("Recall ≥ 0.9", ({ output }) => ({ score: output.recall, metadata: { rationale: `tp ${output.tp} / fn ${output.fn}; missed ${output.missed.join(", ") || "none"}` } }));
const PrecisionJudge = createJudge<CaseInput, CaseOutput>("Precision ≥ 0.8", ({ output }) => ({ score: output.precision, metadata: { rationale: `tp ${output.tp} / fp ${output.fp}; extra ${output.extra.join(", ") || "none"}` } }));
const DatesJudge = createJudge<CaseInput, CaseOutput>("Dates verified = 100%", ({ output }) => ({
  score: output.datesShown ? output.datesVerified / output.datesShown : 1,
  metadata: { rationale: `${output.datesVerified}/${output.datesShown} shown deadlines match the Federal Register record` },
}));

// ── Model grader (only where code can't): is each action item forwardable? ──
const ActionQualityJudge = createJudge<CaseInput, CaseOutput>("Action items usable (LLM judge)", async ({ output }) => {
  if (!output.items.length) return { score: 0, metadata: { rationale: "no items" } };
  const r = await generateText({
    model: gw("anthropic/claude-haiku-5.5"),
    output: Output.object({ schema: z.object({ scores: z.array(z.object({ document_number: z.string(), score: z.number().min(0).max(1), why: z.string() })) }) }),
    prompt: `You grade action items a GC would forward to an owner. Score each 0..1: 1 = names a concrete next step, the owner is plausible for the topic, and the reason is specific to the company; 0.5 = vague but not wrong; 0 = wrong owner, generic, or asserts facts not supported by the reason.\n\n${JSON.stringify(output.items, null, 1)}`,
  });
  const scores = r.output.scores;
  const mean = scores.reduce((a, s) => a + s.score, 0) / (scores.length || 1);
  return { score: mean, metadata: { rationale: scores.map((s) => `${s.document_number}: ${s.score} ${s.why}`).join(" | ") } };
});

describeEval(
  "regulatory triage · ledgerly · week of 2026-11-09",
  { harness, judges: [RecallJudge, PrecisionJudge, DatesJudge, ActionQualityJudge], judgeThreshold: null },
  (it) => {
    it.for(CASES)("$name", async (c, { run }) => {
      const result = await run(c);
      const o = result.output;
      console.log(`${c.name}: recall ${o.recall.toFixed(2)} precision ${o.precision.toFixed(2)} dates ${o.datesVerified}/${o.datesShown} unresolved ${o.unresolved} $${o.costUsd.toFixed(3)} ${o.seconds.toFixed(0)}s`);
      // Hard gates from the RFC. Expected to FAIL for the baseline — that's the comparison.
      expect.soft(o.recall, "recall").toBeGreaterThanOrEqual(0.9);
      expect.soft(o.precision, "precision").toBeGreaterThanOrEqual(0.8);
      expect.soft(o.datesVerified, "every shown date verified").toBe(o.datesShown);
      expect.soft(o.groundedOnFR, "grounded on federalregister.gov").toBe(true);
    });
  },
);
