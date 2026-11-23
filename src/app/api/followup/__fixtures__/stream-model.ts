// Test support for the follow-up chat: a streaming mock model behind the gateway seam, at no cost. The calls go
// through the real AI SDK `streamText` against the SDK's own MockLanguageModelV4 (`doStream`), so the route's handling
// of the SDK's stream parts is exercised, not bypassed. (src/lib/pipeline/__fixtures__/harness.ts stubs only doGenerate.)
import { APICallError, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { setModelsForTests } from "@/lib/gateway";

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const finish = (unified: "stop" | "length" | "error") => ({ type: "finish", finishReason: { unified, raw: undefined }, usage: USAGE });

/**
 * What one model call does: stream these text pieces (then finish), stream them then fail, or fail at the request. A
 * refused request is a retryable 503, the kind the SDK's own retries (when on) would re-send.
 */
export type Answer =
  | { text: string[]; chunkDelayMs?: number; finish?: "stop" | "length" | "error" | "none" }
  | { text: string[]; thenError: string }
  | { reject: string };

/**
 * Provider stream chunks for `a` (the mock's own format: `delta`, not the SDK's `text`). `finish` is the provider's
 * finish reason (default `stop`); `none` closes the stream with no finish chunk, as a dropped upstream connection does.
 */
function chunks(a: Exclude<Answer, { reject: string }>): unknown[] {
  const deltas = a.text.map((delta) => ({ type: "text-delta", id: "t", delta }));
  const open = a.text.length ? [{ type: "text-start", id: "t" }] : [];
  if ("thenError" in a) return [...open, ...deltas, { type: "error", error: new Error(a.thenError) }];
  const reason = "finish" in a && a.finish ? a.finish : "stop";
  return [...open, ...deltas, ...(a.text.length ? [{ type: "text-end", id: "t" }] : []), ...(reason === "none" ? [] : [finish(reason)])];
}

export interface StreamCall {
  model: string;
  system: string;
  messages: { role: string; text: string }[];
  maxOutputTokens: number | undefined;
}

type Part = { type: string; text?: string };
type Message = { role: string; content: string | Part[] };
const textOf = (content: string | Part[]) => (typeof content === "string" ? content : content.map((p) => p.text ?? "").join(""));

/**
 * Replaces the language-model resolver with a mock whose `n`th call (1-based) does `answer(n)`. Records every call;
 * `set` is the seam of a fresh module graph after vi.resetModules().
 */
export function stubStreamingModel(answer: (n: number) => Answer, set: typeof setModelsForTests = setModelsForTests): StreamCall[] {
  const calls: StreamCall[] = [];
  set({
    language: (model) =>
      new MockLanguageModelV4({
        modelId: model,
        doStream: async (opts) => {
          const prompt = opts.prompt as unknown as Message[];
          calls.push({
            model,
            system: prompt.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n"),
            messages: prompt.filter((m) => m.role !== "system").map((m) => ({ role: m.role, text: textOf(m.content) })),
            maxOutputTokens: opts.maxOutputTokens,
          });
          const a = answer(calls.length);
          if ("reject" in a) throw new APICallError({ message: a.reject, url: "https://gateway.test", requestBodyValues: {}, statusCode: 503, isRetryable: true });
          return { stream: simulateReadableStream({ chunks: chunks(a), chunkDelayInMs: "chunkDelayMs" in a ? a.chunkDelayMs : undefined }) } as never;
        },
      }),
    decision: () => {
      throw new Error("no decision model in the follow-up chat");
    },
  });
  return calls;
}

/** Every NDJSON line of a response body, parsed. */
export async function readLines(body: ReadableStream<Uint8Array> | null): Promise<unknown[]> {
  if (!body) throw new Error("no body");
  const text = await new Response(body).text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}
