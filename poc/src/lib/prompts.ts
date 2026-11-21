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

export const baselineTask = (p: CompanyProfile, cfg: { windowStart: string; windowEnd: string; asOf: string }) =>
  prompt("baselineTask", {
    profile: profileBrief(p),
    areasWithOwners: bullets(Object.entries(p.areas).map(([k, v]) => `${k}: ${v.description} → ${v.owner.name}`)),
    windowStart: cfg.windowStart,
    windowEnd: cfg.windowEnd,
    asOf: cfg.asOf,
    criticalWindowDays: pipelineCfg().tiering.criticalWindowDays,
  });
export const baselineFormat = (task: string, research: string) => prompt("baselineFormat", { task, research });

export const judgeClarity = (items: unknown[]) => prompt("judgeClarity", { items: JSON.stringify(items, null, 1) });
