// Test support: runs the real pipeline with the model layer and the network replaced, at no cost.
// Language and decision calls go through the real AI SDK (`generateText` + `Output.object`, `experimental_decide`)
// against the SDK's own mock models, so the ported context code is exercised, not bypassed.
import { MockLanguageModelV4, Experimental_DecisionMockModelV4 as MockDecisionModelV4 } from "ai/test";
import { setModelsForTests } from "../../gateway";
import type { FrDoc, RunConfig } from "../../types";

export type LlmKind = "filter" | "extract" | "actions";
export interface LlmCall {
  kind: LlmKind;
  model: string;
  system: string;
  prompt: string;
}
export interface JevCall {
  model: string;
  state: string;
  question: string;
}

type Part = { type: string; text?: string };
type Message = { role: string; content: string | Part[] };
const textOf = (content: string | Part[]) => (typeof content === "string" ? content : content.map((p) => p.text ?? "").join(""));

/** Which pipeline call this is, from the output schema the SDK forwards (each stage asks for a different shape). */
function kindOf(responseFormat: unknown): LlmKind {
  const props = Object.keys((responseFormat as { schema?: { properties?: object } } | undefined)?.schema?.properties ?? {});
  if (props.includes("decisions")) return "filter";
  if (props.includes("deadlines")) return "extract";
  if (props.includes("actions")) return "actions";
  throw new Error(`unknown output schema: ${props.join(",")}`);
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/**
 * Replace both model resolvers. `llm` returns the structured output object for a call (or throws);
 * `jev` returns P(relevant) for a decision call (or throws). Every call is logged, in issue order.
 */
export function installModels(h: { llm: (c: LlmCall) => unknown | Promise<unknown>; jev: (c: JevCall) => number | Promise<number> }) {
  const calls = { llm: [] as LlmCall[], jev: [] as JevCall[] };
  setModelsForTests({
    language: (model) =>
      new MockLanguageModelV4({
        modelId: model,
        doGenerate: async (opts) => {
          const msgs = opts.prompt as unknown as Message[];
          const call: LlmCall = {
            kind: kindOf(opts.responseFormat),
            model,
            system: msgs.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n"),
            prompt: msgs.filter((m) => m.role === "user").map((m) => textOf(m.content)).join("\n"),
          };
          calls.llm.push(call);
          const out = await h.llm(call);
          return { content: [{ type: "text", text: JSON.stringify(out) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] };
        },
      }),
    decision: (model) =>
      new MockDecisionModelV4({
        modelId: model,
        doDecide: async (opts) => {
          const q = opts.questions.relevant as { instructions?: unknown };
          const call: JevCall = { model, state: textOf(opts.state as unknown as Part[]), question: textOf(q.instructions as string | Part[]) };
          calls.jev.push(call);
          const p = await h.jev(call);
          return { answers: { relevant: { type: "boolean", probability: p } }, warnings: [] };
        },
      }),
  });
  return calls;
}

export const restoreModels = () => setModelsForTests(null);

/** Document numbers in a filter prompt, in the order shown (each document block opens with `[<number>] <type>`). */
export const docsInPrompt = (prompt: string) => [...prompt.matchAll(/^\[(\d{4}-\d{5})\] /gm)].map((m) => m[1]);

// ───────────── A small synthetic week (a live window, so every Federal Register read goes through fetch) ─────────────

export const SYN_WINDOW = { windowStart: "2026-12-07", windowEnd: "2026-12-08", asOf: "2026-12-08" };

export const synDoc = (n: string, over: Partial<FrDoc> = {}): FrDoc => ({
  document_number: n,
  type: "Rule",
  title: `Synthetic rule ${n}`,
  abstract: `Abstract of ${n}.`,
  agencies: [{ name: "Consumer Financial Protection Bureau" }],
  publication_date: "2026-12-07",
  effective_on: "2027-01-15",
  comments_close_on: null,
  dates: `Effective January 15, 2027.`,
  citation: `91 FR ${n.slice(-5)}`,
  cfr_references: [],
  html_url: `https://www.federalregister.gov/d/${n}`,
  raw_text_url: `https://www.federalregister.gov/documents/full_text/text/${n}.txt`,
  action: "Final rule.",
  ...over,
});

/**
 * A fetch that serves the synthetic week: the window listing, each document's re-fetch, and its govinfo text.
 * `override` can answer (or fail) any request first; return undefined to fall through.
 */
export function synFetch(docs: FrDoc[], text: (n: string) => string, override?: (url: string) => Response | Promise<Response> | undefined) {
  const byNum = new Map(docs.map((d) => [d.document_number, d]));
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const o = await override?.(url);
    if (o) return o;
    if (url.includes("/api/v1/documents.json?")) return new Response(JSON.stringify({ results: docs, total_pages: 1 }));
    const one = url.match(/\/api\/v1\/documents\/(\d{4}-\d{5})\.json/);
    if (one) return byNum.has(one[1]) ? new Response(JSON.stringify(byNum.get(one[1]))) : new Response("not found", { status: 404 });
    const gi = url.match(/govinfo\.gov\/.*\/(\d{4}-\d{5})\.htm$/);
    if (gi) return new Response(`<html><body><pre>${text(gi[1])}</pre></body></html>`);
    return new Response("not found", { status: 404 });
  };
}

/** The live setup's knobs (config/setups.yaml `jev-sonnet-strict-passages`) on the synthetic week, for Ledgerly. */
export const synConfig = (over: Partial<RunConfig> = {}): RunConfig => ({
  mode: "pipeline",
  profileId: "ledgerly",
  ...SYN_WINDOW,
  model: "test/model",
  filter: "jev+llm",
  jevThreshold: 0.1,
  webLeads: false,
  promptSet: "strict",
  filterExcerpts: { topN: 20, chunkChars: 1200, perDoc: 3, maxChunks: 300 },
  ...over,
});
