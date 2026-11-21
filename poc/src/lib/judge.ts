import { generateText, Output } from "ai";
import { z } from "zod";
import { experiment } from "./config";
import { gw, gatewayCost } from "./gateway";
import { judgeClarity as judgePrompt } from "./prompts";
import type { RunRecord } from "./types";

/** The only model-graded metric: is each action item clear and usable? Relevance and dates are graded by code. */
export async function judgeClarity(run: RunRecord): Promise<NonNullable<RunRecord["judge"]>> {
  const model = experiment().judgeModel;
  const items = (run.items ?? []).map((i) => ({ document_number: i.document_number, title: i.title, owner: i.owner.name, reason: i.reason, action: i.action }));
  if (!items.length) return { model, clarity: null, perItem: [], costUsd: 0 };
  try {
    const r = await generateText({
      model: gw(model),
      output: Output.object({ schema: z.object({ scores: z.array(z.object({ document_number: z.string(), score: z.number().min(0).max(1), why: z.string() })) }) }),
      prompt: judgePrompt(items),
    });
    const scores = r.output.scores;
    return {
      model,
      clarity: scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : null,
      perItem: scores,
      costUsd: gatewayCost(r.providerMetadata),
    };
  } catch (e) {
    return { model, clarity: null, perItem: [], costUsd: 0, error: (e as Error).message };
  }
}
