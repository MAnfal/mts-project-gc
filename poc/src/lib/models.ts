import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";
import { gw } from "./gateway";

/**
 * Arena contestants: one flagship per vendor, picked at price parity ($2 in / $10 out per M tokens on the
 * Gateway, checked 2026-11-21). Gemini 4 ships under codenames; Carbon is the newest at that price.
 */
export const ARENA_MODELS = [
  { id: "anthropic/claude-sonnet-5.5", label: "Sonnet 5.5", vendor: "Anthropic" },
  { id: "openai/gpt-6.2-sol", label: "GPT-6.2 Sol", vendor: "OpenAI" },
  { id: "moonshotai/kimi-k3.1-pro", label: "Kimi K3.1 Pro", vendor: "Moonshot" },
  { id: "google/gemini-4-carbon", label: "Gemini 4 Carbon", vendor: "Google" },
] as const;

const OTHER_LABELS: Record<string, string> = { "anthropic/claude-haiku-5.5": "Haiku 5.5" };
export const modelLabel = (id: string) => ARENA_MODELS.find((m) => m.id === id)?.label ?? OTHER_LABELS[id] ?? id;

/** Web search for the baseline: the vendor's own search where it exists, otherwise the Gateway's Exa search. */
export function searchTools(model: string): ToolSet {
  if (model.startsWith("anthropic/")) return { web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }) };
  if (model.startsWith("openai/")) return { web_search: openai.tools.webSearch({}) };
  if (model.startsWith("google/")) return { google_search: google.tools.googleSearch({}) };
  return { web_search: gw.tools.exaSearch({ numResults: 8 }) };
}

export const searchKind = (model: string) =>
  model.startsWith("anthropic/") || model.startsWith("openai/") || model.startsWith("google/") ? "native search" : "Exa search";
