import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it } from "vitest";
import { setModelsForTests } from "@/lib/gateway";
import { readYaml } from "@/lib/config/load";
import { SuggestAreasConfigSchema } from "@/lib/config/schemas";
import { RetriesExhausted } from "@/lib/pipeline/retry";
import { MAX_DESCRIPTION, parseSuggestBody, suggestAreas, suggestPrompt } from "./suggest";

const NO_WAIT = { attempts: 3, delaysMs: [0, 0] };
const config = { model: "test/model", prompt: "Areas for: {{description}}" };

type Part = { type: string; text?: string };
type Message = { role: string; content: string | Part[] };
const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** Stubs the gateway with a mock model; `answer` returns the structured output or throws. Records every call. */
function stubModel(answer: () => unknown) {
  const calls: { model: string; prompt: string }[] = [];
  setModelsForTests({
    language: (model) =>
      new MockLanguageModelV4({
        modelId: model,
        doGenerate: async (opts) => {
          const prompt = (opts.prompt as unknown as Message[])
            .filter((m) => m.role === "user")
            .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("")))
            .join("\n");
          calls.push({ model, prompt });
          return { content: [{ type: "text", text: JSON.stringify(answer()) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] };
        },
      }),
    decision: () => {
      throw new Error("no decision model in suggest-areas");
    },
  });
  return calls;
}
afterEach(() => setModelsForTests(null));

describe("config/app.yaml → suggestAreas", () => {
  it("names a model and a prompt with a {{description}} placeholder", () => {
    const { suggestAreas: cfg } = readYaml("app.yaml", SuggestAreasConfigSchema);
    expect(cfg.model).toBe("anthropic/claude-sonnet-5.5");
    expect(cfg.prompt).toContain("{{description}}");
  });

  it("rejects a prompt without the placeholder, which would send the model no description", () => {
    const r = SuggestAreasConfigSchema.safeParse({ suggestAreas: { model: "m", prompt: "Suggest areas." } });
    expect(r.success).toBe(false);
  });
});

describe("parseSuggestBody", () => {
  it("accepts a description and trims it", () => {
    expect(parseSuggestBody({ description: "  Makes widgets.  " })).toEqual({ ok: true, description: "Makes widgets." });
  });

  it("refuses an empty or whitespace description", () => {
    for (const body of [{ description: "" }, { description: "   \n" }]) {
      expect(parseSuggestBody(body)).toEqual({ ok: false, message: "Describe what the company does first, then ask for suggestions." });
    }
  });

  it("refuses a missing body, a non-object, or a description that isn't text", () => {
    for (const body of [undefined, null, "Makes widgets.", [], { description: 42 }, {}]) {
      expect(parseSuggestBody(body)).toEqual({ ok: false, message: "Describe what the company does first, then ask for suggestions." });
    }
  });

  it(`refuses a description over ${MAX_DESCRIPTION} characters (bounds what one click can spend)`, () => {
    expect(parseSuggestBody({ description: "x".repeat(MAX_DESCRIPTION) }).ok).toBe(true);
    expect(parseSuggestBody({ description: "x".repeat(MAX_DESCRIPTION + 1) })).toEqual({
      ok: false,
      message: `Shorten the description to ${MAX_DESCRIPTION} characters or fewer, then ask again.`,
    });
  });
});

describe("suggestPrompt", () => {
  it("fills the configured template with the description", () => {
    expect(suggestPrompt(config, "Makes widgets.")).toBe("Areas for: Makes widgets.");
  });
});

describe("suggestAreas", () => {
  it("asks the configured model with the rendered prompt and returns its areas, cleaned", async () => {
    const calls = stubModel(() => ({
      areas: [
        { id: " Product safety ", description: " CPSC recalls " },
        { id: "", description: "no name" },
        { id: "product safety", description: "duplicate" },
        { id: "Privacy", description: "COPPA" },
      ],
    }));
    const areas = await suggestAreas("Makes widgets.", { config, policy: NO_WAIT });
    expect(areas).toEqual([
      { id: "Product safety", description: "CPSC recalls" },
      { id: "Privacy", description: "COPPA" },
    ]);
    expect(calls).toEqual([{ model: "test/model", prompt: "Areas for: Makes widgets." }]);
  });

  it("tries a failing call at most 3 times through withRetry, then gives up", async () => {
    const calls = stubModel(() => {
      throw new Error("provider down");
    });
    await expect(suggestAreas("Makes widgets.", { config, policy: NO_WAIT })).rejects.toBeInstanceOf(RetriesExhausted);
    expect(calls).toHaveLength(3);
  });
});
