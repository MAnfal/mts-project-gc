import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";
import { pipelineCfg, setups } from "./config";
import { gw } from "./gateway";

// Contestants and their baseline search live in config/setups.yaml.

export const arenaModels = () => setups().models;

/** "anthropic/claude-opus-5.5" → "Opus 5.5", "openai/gpt-6.2-sol" → "GPT-6.2 Sol" (labels from setups.yaml win). */
function prettify(id: string) {
  const name = id.split("/").pop() ?? id;
  return name
    .replace(/^claude-/, "")
    .split("-")
    .map((w) => (/^gpt$/i.test(w) ? "GPT" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/^GPT (\S+)/, "GPT-$1");
}
export const modelLabel = (id: string) => arenaModels().find((m) => m.id === id)?.label ?? prettify(id);

const searchOf = (model: string) => arenaModels().find((m) => m.id === model)?.search ?? "exa";

/** Web search for the baseline, as configured per model (vendor-native, or the Gateway's Exa). */
export function searchTools(model: string): ToolSet {
  const b = pipelineCfg().baseline;
  switch (searchOf(model)) {
    case "anthropic-native":
      return { web_search: anthropic.tools.webSearch_20250305({ maxUses: b.anthropicMaxUses }) };
    case "openai-native":
      return { web_search: openai.tools.webSearch({}) };
    case "google-native":
      return { google_search: google.tools.googleSearch({}) };
    case "exa":
      return { web_search: gw.tools.exaSearch({ numResults: b.exaNumResults }) };
  }
}

export const searchKind = (model: string) => (searchOf(model) === "exa" ? "Exa search" : "native search");
