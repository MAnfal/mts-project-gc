import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { agencyNames, getDoc, getRawText, listWindow } from "../fr";
import { getProfile, profileBrief } from "../profiles";
import { saveRun } from "../store";
import type { ActionItem, Deadline, FilterDecision, RunConfig, RunRecord, Tier } from "../types";
import { parseDocNumberFromUrl, verifyQuotedDate } from "../verify";
import { RunCtx } from "./context";
import { filterJev, filterLlm, renderMarkdown, scan, verifyAndTier, webLeads, writeActions } from "./stages";

export function newRun(config: RunConfig): RunRecord {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}_${config.mode}_${Math.random().toString(36).slice(2, 6)}`;
  return { id, createdAt: new Date().toISOString(), config, status: "running", stages: [], calls: [], totalCostUsd: 0, totalMs: 0 };
}

export async function execute(run: RunRecord): Promise<RunRecord> {
  const ctx = new RunCtx(run);
  const t0 = Date.now();
  try {
    await ctx.init();
    await saveRun(run);
    if (run.config.mode === "baseline") await baseline(ctx);
    else await pipeline(ctx);
    run.status = "done";
  } catch (e) {
    run.status = "error";
    run.error = (e as Error).message;
  }
  run.totalMs = Date.now() - t0;
  await saveRun(run);
  return run;
}

async function pipeline(ctx: RunCtx) {
  const cfg = ctx.run.config;
  const profile = getProfile(cfg.profileId);

  const docs = await scan(ctx);
  ctx.run.scanned = docs.length;
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

  const relevantDocs = docs.filter((d) => decisions.get(d.document_number)!.relevant);
  const { items, dropped } = await verifyAndTier(ctx, profile, relevantDocs, decisions);
  ctx.run.dropped = dropped;
  ctx.run.items = await writeActions(ctx, profile, items);
  ctx.run.markdown = renderMarkdown(profile, cfg, ctx.run.items);
}

// ───────────────────────────── Baseline ─────────────────────────────
// One prompt, provider-native web search, the model does everything (relevance, dates, tier, owner).
// Same model as the pipeline so the delta measures the harness, not the model.

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

function nativeSearch(model: string) {
  if (model.startsWith("anthropic/")) return { web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }) };
  if (model.startsWith("openai/")) return { web_search: openai.tools.webSearch({}) };
  throw new Error(`No native web search wired for ${model}`);
}

async function baseline(ctx: RunCtx) {
  const cfg = ctx.run.config;
  const profile = getProfile(cfg.profileId);
  const prompt = `${profileBrief(profile)}

Affected areas and owners:
${Object.entries(profile.areas)
  .map(([k, v]) => `- ${k}: ${v.description} → ${v.owner.name}`)
  .join("\n")}

Task: Find every US Federal Register document published between ${cfg.windowStart} and ${cfg.windowEnd} (inclusive) that affects this company. For each, give the Federal Register document number, title, federalregister.gov URL, the key deadline, a tier (Critical if a deadline is < 90 days from ${cfg.asOf}, otherwise High/Medium/Low by importance), the owner area, a one-line reason, and a one-line action. Only include items you found via search. Return an empty list if none.`;

  const out = await ctx.stage(
    "baseline:single-prompt",
    () => ctx.object("baseline", { model: cfg.model, prompt, schema: baselineSchema, tools: nativeSearch(cfg.model) }),
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
        if (!num) {
          dropped.push({ document_number: c.title, why: "no Federal Register document number" });
          continue;
        }
        const doc = await getDoc(num);
        if (!doc) {
          dropped.push({ document_number: num, why: "document number does not exist on federalregister.gov" });
          continue;
        }
        if (!windowDocs.has(num)) {
          dropped.push({ document_number: num, why: `published ${doc.publication_date}, outside window` });
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
