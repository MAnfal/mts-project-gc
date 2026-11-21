import { pipelineCfg, prompt } from "./config";
import { agencyNames } from "./fr";
import type { ActionItem, CompanyProfile, FrDoc } from "./types";

// Prompt text lives in config/prompts.yaml. These functions only render data into its placeholders.

const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

export const profileBrief = (p: CompanyProfile) =>
  prompt("profileBrief", { name: p.name, summary: p.summary, applies: bullets(p.applies), doesNotApply: bullets(p.doesNotApply) });

/** How one Federal Register document is shown to a model (data formatting, not prompt wording). */
export const docBlock = (d: FrDoc) =>
  [`[${d.document_number}] ${d.type} — ${agencyNames(d).join("; ")}`, `Title: ${d.title}`, d.action ? `Action: ${d.action}` : "", `Abstract: ${(d.abstract ?? "(none)").slice(0, pipelineCfg().filter.abstractChars)}`]
    .filter(Boolean)
    .join("\n");

export const jevQuestion = () => prompt("jevQuestion");
export const jevState = (p: CompanyProfile, d: FrDoc) => prompt("jevState", { profile: profileBrief(p), document: docBlock(d) });

export const filterSystem = (p: CompanyProfile) => prompt("filterSystem", { areas: bullets(Object.entries(p.areas).map(([k, v]) => `${k}: ${v.description}`)) });
export const filterPrompt = (p: CompanyProfile, docs: FrDoc[]) =>
  prompt("filterPrompt", { profile: profileBrief(p), count: docs.length, documents: docs.map(docBlock).join("\n\n") });

export const extractSystem = () => prompt("extractSystem");
export const extractPrompt = (d: FrDoc, text: string) => prompt("extractPrompt", { number: d.document_number, title: d.title, text });

export const actionsSystem = () => prompt("actionsSystem");
export const actionsPrompt = (p: CompanyProfile, items: Pick<ActionItem, "document_number" | "type" | "title" | "tier" | "tierReason" | "owner" | "reason">[]) =>
  prompt("actionsPrompt", {
    profile: profileBrief(p),
    items: items.map((i) => `[${i.document_number}] ${i.type}: ${i.title}\nTier: ${i.tier} (${i.tierReason})\nOwner: ${i.owner.name}\nWhy relevant: ${i.reason}`).join("\n\n"),
  });

export const webLeadsSystem = () => prompt("webLeadsSystem");
export const webLeadsPrompt = (p: CompanyProfile, windowStart: string, windowEnd: string) => prompt("webLeadsPrompt", { profile: profileBrief(p), windowStart, windowEnd });

/** The tier rules in words, generated from config/pipeline.yaml so the baseline is told exactly what the code applies. */
export function tierRulesText(asOf: string) {
  const t = pipelineCfg().tiering;
  const types = t.criticalDocTypes.map((x) => `${x.toLowerCase()}`).join(" or ");
  return `Critical if it is a ${types} with a deadline less than ${t.criticalWindowDays} days after ${asOf}, or a final rule that took effect within the ${t.recentlyEffectiveDays} days before ${asOf}; otherwise High for final rules, Medium for proposed rules and for notices with a deadline, Low for anything else`;
}

export const baselineTask = (p: CompanyProfile, cfg: { windowStart: string; windowEnd: string; asOf: string }) =>
  prompt("baselineTask", {
    profile: profileBrief(p),
    areasWithOwners: bullets(Object.entries(p.areas).map(([k, v]) => `${k}: ${v.description} → ${v.owner.name}`)),
    windowStart: cfg.windowStart,
    windowEnd: cfg.windowEnd,
    tierRules: tierRulesText(cfg.asOf),
  });
export const baselineFormat = (task: string, research: string) => prompt("baselineFormat", { task, research });

export const judgeClarity = (items: unknown[]) => prompt("judgeClarity", { items: JSON.stringify(items, null, 1) });
