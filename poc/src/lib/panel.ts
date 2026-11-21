import crypto from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import { judges, loadKey, prompts, render } from "./config";
import { gatewayCost, languageModel } from "./gateway";
import { Tracer } from "./trace";
import { majority } from "./grade";
import type { PanelResult, PanelVote, RunRecord } from "./types";

/**
 * Judge panel (config/judges.yaml): each judge model grades every action item on every criterion in ONE call,
 * and a verdict needs `minAgree` matching votes. Verdicts are stored on the run with a hash of the panel config
 * and prompt, so editing the panel re-judges old runs without re-running the pipeline.
 */
export function panelHash(): string {
  const j = judges();
  return crypto.createHash("sha256").update(JSON.stringify(j)).update(prompts().panelJudge).digest("hex").slice(0, 10);
}

const VoteSchema = z.object({
  votes: z.array(z.object({ document_number: z.string(), criterion: z.string(), verdict: z.enum(["PASS", "FAIL", "UNKNOWN"]), why: z.string() })),
});

export async function judgePanel(run: RunRecord): Promise<PanelResult> {
  const cfg = judges();
  const key = loadKey(run.config.profileId, run.config.windowStart, run.config.windowEnd);
  const items = (run.items ?? []).map((i) => ({
    document_number: i.document_number,
    title: i.title,
    owner: i.owner.name,
    reason: i.reason,
    action: i.action,
    ...(key?.details?.[i.document_number]?.rubric ? { rubric: key.details[i.document_number].rubric } : {}),
  }));
  const hash = panelHash();
  const trace = new Tracer(run);
  if (!items.length) {
    trace.emit("judge.skip", { panelHash: hash, why: "no items to judge" });
    await trace.flush();
    return { panelHash: hash, judges: [], verdicts: [], costUsd: 0 };
  }

  const applies = (c: (typeof cfg.criteria)[number], it: (typeof items)[number]) => !c.needsRubric || "rubric" in it;
  const criteriaText = cfg.criteria.map((c) => `- ${c.id}: ${c.question}${c.needsRubric ? " (only for items that have a rubric)" : ""}`).join("\n");
  const prompt = render(prompts().panelJudge, { criteria: criteriaText, items: JSON.stringify(items, null, 1) });

  const results = await Promise.all(
    cfg.judges.map(async (j) => {
      try {
        const t0 = Date.now();
        const r = await generateText({ model: languageModel(j.model), output: Output.object({ schema: VoteSchema }), prompt, maxRetries: 2 });
        const costUsd = r.steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0) || gatewayCost(r.providerMetadata);
        trace.emit("judge.call", { panelHash: hash, model: j.model, prompt, votes: r.output.votes, usage: r.totalUsage, costUsd, ms: Date.now() - t0 });
        return { model: j.model, votes: r.output.votes as PanelVote[], costUsd };
      } catch (e) {
        trace.emit("judge.call", { panelHash: hash, model: j.model, prompt, votes: [], error: (e as Error).message.slice(0, 300), costUsd: 0 });
        return { model: j.model, votes: [] as PanelVote[], costUsd: 0, error: (e as Error).message.slice(0, 300) };
      }
    }),
  );

  const verdicts: PanelResult["verdicts"] = [];
  for (const it of items)
    for (const c of cfg.criteria) {
      if (!applies(c, it)) continue;
      const votes = results.map((r) => r.votes.find((v) => v.document_number === it.document_number && v.criterion === c.id)?.verdict ?? ("MISSING" as const));
      // A missing vote (judge errored or skipped the item) is an abstention, like UNKNOWN.
      const verdict = majority(votes.map((v) => (v === "MISSING" ? "UNKNOWN" : v)), cfg.minAgree);
      verdicts.push({ document_number: it.document_number, criterion: c.id, verdict, votes });
      trace.emit("judge.verdict", { panelHash: hash, document_number: it.document_number, criterion: c.id, votes: Object.fromEntries(cfg.judges.map((j, k) => [j.model, votes[k]])), minAgree: cfg.minAgree, verdict });
    }
  await trace.flush();
  return { panelHash: hash, judges: results, verdicts, costUsd: results.reduce((a, r) => a + r.costUsd, 0) };
}

/** Panel summary for a set of runs: pass rate per criterion (over decided verdicts), contested share, judge agreement. */
export function panelSummary(runs: RunRecord[]) {
  const vs = runs.flatMap((r) => r.panel?.verdicts ?? []);
  const byCrit: Record<string, { pass: number; fail: number; contested: number }> = {};
  let unanimous = 0;
  for (const v of vs) {
    const b = (byCrit[v.criterion] ??= { pass: 0, fail: 0, contested: 0 });
    if (v.verdict === "PASS") b.pass++;
    else if (v.verdict === "FAIL") b.fail++;
    else b.contested++;
    const cast = v.votes.filter((x) => x === "PASS" || x === "FAIL");
    if (cast.length === v.votes.length && new Set(cast).size === 1) unanimous++;
  }
  const decided = vs.filter((v) => v.verdict !== "CONTESTED");
  return {
    verdicts: vs.length,
    passRate: decided.length ? decided.filter((v) => v.verdict === "PASS").length / decided.length : null,
    contested: vs.length ? (vs.length - decided.length) / vs.length : null,
    unanimous: vs.length ? unanimous / vs.length : null,
    byCriterion: byCrit,
  };
}
