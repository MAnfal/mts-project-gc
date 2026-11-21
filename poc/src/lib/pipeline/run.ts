import { z } from "zod";
import { agencyNames, getDoc, getRawText, listWindow } from "../fr";
import { configHash, experiment, getCompany, pipelineCfg, prompts, setups, withPromptSet } from "../config";
import { baselineFormat, baselineTask } from "../prompts";
import { saveRun } from "../store";
import { searchKind, searchTools } from "../models";
import type { ActionItem, Deadline, FilterDecision, RunConfig, RunRecord, Tier } from "../types";
import { parseDocNumberFromUrl, verifyQuotedDate } from "../verify";
import { RunCtx } from "./context";
import { filterJev, filterLlm, renderMarkdown, scan, verifyAndTier, webLeads, writeActions } from "./stages";

export function newRun(config: RunConfig): RunRecord {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}_${config.mode}_${Math.random().toString(36).slice(2, 6)}`;
  return { id, createdAt: new Date().toISOString(), config, configHash: configHash(), status: "running", stages: [], calls: [], totalCostUsd: 0, totalMs: 0 };
}

export async function execute(run: RunRecord): Promise<RunRecord> {
  const ctx = new RunCtx(run);
  const t0 = Date.now();
  // Everything the run depends on, resolved, so the trace alone can explain the run.
  ctx.trace.emit("run.start", {
    config: run.config,
    configHash: run.configHash,
    profile: run.config.customProfile ?? (() => { try { return getCompany(run.config.profileId); } catch { return null; } })(),
    promptSet: run.config.promptSet ?? null,
    prompts: await withPromptSet(run.config.promptSet, async () => prompts()),
    pipeline: pipelineCfg(),
    setup: setups().setups.find((s) => s.id === run.config.cell) ?? null,
    jevModel: experiment().jevModel,
  });
  try {
    await ctx.init();
    await saveRun(run);
    await withPromptSet(run.config.promptSet, () => (run.config.mode === "baseline" ? baseline(ctx) : pipeline(ctx)));
    run.status = "done";
  } catch (e) {
    run.status = "error";
    run.error = (e as Error).message;
  }
  run.totalMs = Date.now() - t0;
  ctx.trace.emit("run.end", { status: run.status, error: run.error, totalCostUsd: run.totalCostUsd, totalMs: run.totalMs, scanned: run.scanned, items: run.items?.length ?? 0, dropped: run.dropped ?? [], itemsFinal: run.items ?? [] });
  await ctx.trace.flush();
  await saveRun(run);
  return run;
}

async function pipeline(ctx: RunCtx) {
  const cfg = ctx.run.config;
  const profile = cfg.customProfile ?? getCompany(cfg.profileId);

  const docs = await scan(ctx);
  ctx.run.scanned = docs.length;
  ctx.trace.emit("scan.result", { count: docs.length, documents: docs.map((d) => ({ document_number: d.document_number, type: d.type, title: d.title })) });
  if (cfg.webLeads) ctx.run.webLeads = await webLeads(ctx, profile, docs);

  const decisions = new Map<string, FilterDecision>(docs.map((d) => [d.document_number, { document_number: d.document_number, relevant: false }]));
  let toLlm = docs;
  if (cfg.filter !== "llm") {
    const probs = await filterJev(ctx, profile, docs);
    for (const [n, p] of probs) decisions.get(n)!.jevProbability = p;
    toLlm = docs.filter((d) => (probs.get(d.document_number) ?? 0) >= cfg.jevThreshold);
    if (cfg.filter === "jev") for (const d of toLlm) decisions.get(d.document_number)!.relevant = true;
  }
  if (cfg.filter !== "jev") {
    const llm = await filterLlm(ctx, profile, toLlm);
    for (const [n, v] of llm) {
      const dec = decisions.get(n)!;
      dec.llm = v;
      dec.relevant = v.relevant;
    }
  }
  ctx.run.decisions = [...decisions.values()];
  const sentToLlm = new Set(toLlm.map((d) => d.document_number));
  for (const d of ctx.run.decisions)
    ctx.trace.emit("filter.decision", {
      document_number: d.document_number,
      jevProbability: d.jevProbability ?? null,
      jevThreshold: cfg.filter === "llm" ? null : cfg.jevThreshold,
      passedJev: cfg.filter === "llm" ? null : sentToLlm.has(d.document_number),
      llm: d.llm ?? null,
      relevant: d.relevant,
    });

  const relevantDocs = docs.filter((d) => decisions.get(d.document_number)!.relevant);
  const { items, dropped } = await verifyAndTier(ctx, profile, relevantDocs, decisions);
  ctx.run.dropped = dropped;
  ctx.run.items = await writeActions(ctx, profile, items);
  ctx.run.markdown = renderMarkdown(profile, cfg, ctx.run.items);
}

// ───────────────────────────── Baseline ─────────────────────────────
// One task prompt + web search (vendor-native, or Exa where the vendor has none); the model does everything
// (relevance, dates, tier, owner). Same model as the pipeline cell, so the delta measures the harness.

const baselineSchema = z.object({
  items: z.array(
    z.object({
      document_number: z.string().nullable().describe("Federal Register document number, e.g. 2026-22809"),
      title: z.string(),
      url: z.string(),
      deadline: z.string().nullable().describe("YYYY-MM-DD"),
      deadline_kind: z.enum(["comment", "effective", "compliance", "other"]).nullable(),
      tier: z.enum(["Critical", "High", "Medium", "Low"]),
      owner_area: z.string(),
      reason: z.string(),
      action: z.string(),
    }),
  ),
});

async function baseline(ctx: RunCtx) {
  const cfg = ctx.run.config;
  const profile = cfg.customProfile ?? getCompany(cfg.profileId);
  const prompt = baselineTask(profile, cfg);

  // Two steps for every model: research freely with web search, then put the answer in our format.
  // (Some providers skip tool calls when structured output is requested in the same call — Kimi did in smoke tests.)
  const research = await ctx.stage(
    `baseline:search (${searchKind(cfg.model)})`,
    () => ctx.agent("baseline:search", { model: cfg.model, prompt, tools: searchTools(cfg.model), maxSteps: pipelineCfg().baseline.searchMaxSteps }),
    (r) => ({ outCount: r.toolCalls.length, note: `${r.toolCalls.length} search calls` }),
  );
  const out = await ctx.stage(
    "baseline:format",
    () =>
      ctx.object("baseline:format", {
        model: cfg.model,
        prompt: baselineFormat(prompt, research.text),
        schema: baselineSchema,
      }),
    (r) => ({ outCount: r.items.length }),
  );
  ctx.run.claimed = out.items;

  // Resolution + verification use the same code as the pipeline, so both are graded identically.
  const windowDocs = new Set((await listWindow(cfg.windowStart, cfg.windowEnd)).map((d) => d.document_number));
  const dropped: { document_number: string; why: string }[] = [];
  const items: ActionItem[] = [];
  await ctx.stage(
    "baseline:resolve+verify",
    async () => {
      for (const c of out.items) {
        const num = c.document_number?.trim() || parseDocNumberFromUrl(c.url);
        const drop = (document_number: string, why: string) => {
          dropped.push({ document_number, why });
          ctx.trace.emit("baseline.resolve", { claim: c, document_number, outcome: "dropped", why });
        };
        if (!num) {
          drop(c.title, "no Federal Register document number");
          continue;
        }
        const doc = await getDoc(num);
        if (!doc) {
          drop(num, "document number does not exist on federalregister.gov");
          continue;
        }
        if (!windowDocs.has(num)) {
          drop(num, `published ${doc.publication_date}, outside window`);
          continue;
        }
        const deadlines: Deadline[] = [];
        if (c.deadline) {
          const raw = await getRawText(doc);
          const fieldHit = c.deadline === doc.comments_close_on || c.deadline === doc.effective_on;
          // Accept if it equals a structured field or appears in the source text in any common rendering.
          const textHit = verifyQuotedDate(`${doc.dates ?? ""}\n${raw}`, `${doc.dates ?? ""}\n${raw}`, c.deadline).ok;
          deadlines.push({ date: c.deadline, kind: c.deadline_kind ?? "other", source: "extracted", verified: fieldHit || textHit, verifyNote: fieldHit ? "matches FR field" : textHit ? "date appears in source text" : "date not found in primary source" });
        }
        const areaKey = Object.keys(profile.areas).find((k) => c.owner_area.toLowerCase().includes(k)) ?? null;
        ctx.trace.emit("baseline.resolve", {
          claim: c,
          document_number: num,
          outcome: "kept",
          date: deadlines[0] ? { claimed: deadlines[0].date, verified: deadlines[0].verified, note: deadlines[0].verifyNote } : null,
          owner: { claimedArea: c.owner_area, matchedArea: areaKey },
        });
        items.push({
          document_number: num,
          title: doc.title,
          type: doc.type,
          agencies: agencyNames(doc),
          tier: c.tier as Tier,
          tierReason: "model-assigned",
          deadline: deadlines[0] ?? null,
          deadlines,
          owner: areaKey ? profile.areas[areaKey].owner : profile.generalCounsel,
          areas: areaKey ? [areaKey] : [],
          reason: c.reason,
          action: c.action,
          citation: doc.citation,
          citationVerified: true,
          url: doc.html_url,
          sourceTag: "[web search — verify]",
        });
      }
    },
    () => ({ inCount: out.items.length, outCount: items.length }),
  );
  ctx.run.items = items;
  ctx.run.dropped = dropped;
  ctx.run.markdown = renderMarkdown(profile, cfg, items);
}
