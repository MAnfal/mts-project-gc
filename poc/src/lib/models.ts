import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";
import { pipelineCfg, setups } from "./config";
import { gw } from "./gateway";

// Contestants and their baseline search live in config/setups.yaml.

export const arenaModels = () => setups().models;

const HELPER_LABELS: Record<string, string> = { "anthropic/claude-haiku-5.5": "Haiku 5.5" };
export const modelLabel = (id: string) => arenaModels().find((m) => m.id === id)?.label ?? HELPER_LABELS[id] ?? id;

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
