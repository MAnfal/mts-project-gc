import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { render } from "@/lib/config";
import type { SuggestAreasConfig } from "@/lib/config/schemas";
import { languageModel } from "@/lib/gateway";
import { RETRY, withRetry, type RetryPolicy } from "@/lib/pipeline/retry";

// "Suggest from description": one structured model call that proposes owner areas from the GC's company description.
// Off the decision path: it fills the owners table for the GC to review, and nothing runs until they press Run. The
// model and the prompt come from config/app.yaml → suggestAreas.

/** Long enough for any real description (the presets' run ~450 characters), short enough to bound one click's cost. */
export const MAX_DESCRIPTION = 4000;

const EMPTY = "Describe what the company does first, then ask for suggestions.";
const Body = z.object({ description: z.string() });

export type ParsedBody = { ok: true; description: string } | { ok: false; message: string };

/** POST body → the trimmed description, or a plain sentence for the GC. */
export function parseSuggestBody(body: unknown): ParsedBody {
  const parsed = Body.safeParse(body);
  const description = parsed.success ? parsed.data.description.trim() : "";
  if (!description) return { ok: false, message: EMPTY };
  if (description.length > MAX_DESCRIPTION) return { ok: false, message: `Shorten the description to ${MAX_DESCRIPTION} characters or fewer, then ask again.` };
  return { ok: true, description };
}

/** The configured template with the description filled in. */
export const suggestPrompt = (config: SuggestAreasConfig, description: string) => render(config.prompt, { description });

const Suggested = z.object({
  areas: z.array(z.object({ id: z.string().describe("Short area name"), description: z.string().describe("What the area covers, one line") })),
});
export type SuggestedArea = z.infer<typeof Suggested>["areas"][number];

/**
 * Asks the configured model for areas. Tried at most `policy.attempts` times through withRetry, with the SDK's own
 * retries off, as every model call in this app. Resolving the model throws at once when the Gateway key is missing.
 * Areas come back trimmed, without blank names or repeats.
 */
export async function suggestAreas(description: string, opts: { config: SuggestAreasConfig; policy?: RetryPolicy }): Promise<SuggestedArea[]> {
  const model = languageModel(opts.config.model);
  const prompt = suggestPrompt(opts.config, description);
  const r = await withRetry(() => generateText({ model, prompt, output: Output.object({ schema: Suggested }), maxRetries: 0 }), opts.policy ?? RETRY);
  const seen = new Set<string>();
  const out: SuggestedArea[] = [];
  for (const a of r.output.areas) {
    const id = a.id.trim();
    if (!id || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    out.push({ id, description: a.description.trim() });
  }
  return out;
}
