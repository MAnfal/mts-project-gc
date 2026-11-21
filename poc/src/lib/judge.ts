import { generateText, Output } from "ai";
import { z } from "zod";
import { gw, gatewayCost } from "./gateway";
import type { RunRecord } from "./types";

/** The only model-graded metric: is each action item clear and usable? Relevance and dates are graded by code. */
export const JUDGE_MODEL = "anthropic/claude-haiku-5.5";

export async function judgeClarity(run: RunRecord): Promise<NonNullable<RunRecord["judge"]>> {
  const items = (run.items ?? []).map((i) => ({ document_number: i.document_number, title: i.title, owner: i.owner.name, reason: i.reason, action: i.action }));
  if (!items.length) return { model: JUDGE_MODEL, clarity: null, perItem: [], costUsd: 0 };
  try {
    const r = await generateText({
      model: gw(JUDGE_MODEL),
      output: Output.object({ schema: z.object({ scores: z.array(z.object({ document_number: z.string(), score: z.number().min(0).max(1), why: z.string() })) }) }),
      prompt: `You grade action items a General Counsel would forward to a colleague. Score each 0..1:
1 = plain English a non-lawyer understands, names a concrete next step, the owner fits the topic, the reason is specific to the company.
0.5 = understandable but vague or generic.
0 = jargon-heavy, wrong owner, or asserts facts the reason doesn't support.
Judge clarity and usefulness only — not whether the rule is truly relevant.

${JSON.stringify(items, null, 1)}`,
    });
    const scores = r.output.scores;
    return {
      model: JUDGE_MODEL,
      clarity: scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : null,
      perItem: scores,
      costUsd: gatewayCost(r.providerMetadata),
    };
  } catch (e) {
    return { model: JUDGE_MODEL, clarity: null, perItem: [], costUsd: 0, error: (e as Error).message };
  }
}
