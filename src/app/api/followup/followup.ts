import "server-only";
import { streamText } from "ai";
import { z } from "zod";
import { render } from "@/lib/config";
import type { FollowUpConfig } from "@/lib/config/schemas";
import { languageModel } from "@/lib/gateway";
import { assertPublicText } from "@/lib/pipeline/events";
import { RETRY, withRetry, type RetryPolicy } from "@/lib/pipeline/retry";
import { EMPTY_QUESTION, FOLLOWUP_FAILED, type FollowUpContext, type FollowUpLine } from "@/lib/runs/followup-context";
import type { ChatTurn } from "@/lib/runs/types";

// The follow-up chat under a finished report: one streamed model call that answers a question from that run's report
// alone. The browser sends the report (src/lib/runs/followup-context.ts builds it) and the conversation; the server
// keeps nothing. The model and the system prompt come from config/app.yaml → followUp, off the decision path.

export { EMPTY_QUESTION };
/** A body this route can't use. Fixed: the reason (which may quote what matched) goes to the server log only. */
export const BAD_BODY = "This question couldn't be sent with the report. Reload the page and ask again.";
export const TOO_MANY_TURNS = "This conversation has reached its length limit. Clear it to ask more.";
export const REPORT_TOO_LARGE = "This report is too large to ask about here.";
export const tooLongMessage = (max: number) => `Shorten the question to ${max} characters or fewer, then ask again.`;

// The context's shape, field for field. Strict: a field the builder doesn't copy is refused, not passed on.
const Owner = z.object({ name: z.string(), email: z.string() }).strict();
const Dated = z.object({ date: z.string(), kind: z.enum(["comment", "effective", "compliance", "other"]) }).strict();
const Note = z.object({ document_number: z.string(), title: z.string(), reason: z.string() }).strict();
const Context: z.ZodType<FollowUpContext> = z
  .object({
    company: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
    asOf: z.string().nullable(),
    scanned: z.number(),
    notReviewedCount: z.number(),
    items: z.array(
      z
        .object({
          source: z.number(),
          document_number: z.string(),
          title: z.string(),
          type: z.string(),
          agencies: z.array(z.string()),
          tier: z.enum(["Critical", "High", "Medium", "Low"]),
          tierReason: z.string(),
          deadline: Dated.nullable(),
          dates: z.array(Dated),
          owner: Owner,
          areas: z.array(z.string()),
          reason: z.string(),
          action: z.string(),
          citation: z.string().nullable(),
          url: z.string(),
        })
        .strict(),
    ),
    checkedByYou: z.array(Note.extend({ tier: z.literal("Not tiered"), owner: Owner, url: z.string() }).strict()),
    heldBack: z.array(Note),
    screenedOut: z.array(Note),
    profile: z
      .object({
        name: z.string(),
        summary: z.string(),
        businessLines: z.array(z.string()),
        applies: z.array(z.string()),
        doesNotApply: z.array(z.string()),
        areas: z.array(z.object({ name: z.string(), description: z.string(), owner: Owner }).strict()),
        generalCounsel: Owner,
      })
      .strict(),
  })
  .strict();
const Turn: z.ZodType<ChatTurn> = z.object({ role: z.enum(["user", "assistant"]), content: z.string() }).strict();
const Body = z.object({ context: Context, messages: z.array(Turn) }).strict();

export type Caps = Pick<FollowUpConfig, "maxTurns" | "maxMessageChars" | "maxContextChars">;
export type ParsedFollowUp = { ok: true; context: FollowUpContext; messages: ChatTurn[] } | { ok: false; message: string; reason?: string };

/**
 * POST body → the context and the conversation, or a plain sentence for the GC. Checked before any model is resolved:
 * the shape (strict), a question last, the caps, and that the context names no internal component or model.
 */
export function parseFollowUpBody(body: unknown, caps: Caps): ParsedFollowUp {
  const parsed = Body.safeParse(body);
  if (!parsed.success) return { ok: false, message: BAD_BODY, reason: "body shape" };
  const { context, messages } = parsed.data;
  const last = messages.at(-1);
  if (!last || last.role !== "user") return { ok: false, message: BAD_BODY, reason: "no question last" };
  if (!last.content.trim()) return { ok: false, message: EMPTY_QUESTION };
  if (messages.length > caps.maxTurns) return { ok: false, message: TOO_MANY_TURNS };
  if (messages.some((m) => m.content.length > caps.maxMessageChars)) return { ok: false, message: tooLongMessage(caps.maxMessageChars) };
  const text = JSON.stringify(context);
  if (text.length > caps.maxContextChars) return { ok: false, message: REPORT_TOO_LARGE };
  try {
    assertPublicText(text, "follow-up context");
  } catch (e) {
    return { ok: false, message: BAD_BODY, reason: (e as Error).message };
  }
  return { ok: true, context, messages };
}

/** The configured system prompt with the report filled in. Throws if it names an internal component or model. */
export function followUpSystem(config: Pick<FollowUpConfig, "system">, context: FollowUpContext): string {
  const system = render(config.system, { report: JSON.stringify(context, null, 1) });
  assertPublicText(system, "follow-up system prompt");
  return system;
}

const encoder = new TextEncoder();
const line = (l: FollowUpLine) => encoder.encode(JSON.stringify(l) + "\n");

/**
 * Starts the answer and returns it as NDJSON lines: `text` pieces, then `done`, or `failed` with a fixed sentence when
 * the answer breaks off (the SDK's text stream would just end, and the GC couldn't tell). Resolving the model throws at
 * once when the Gateway key is missing.
 *
 * `streamText` returns before the request is made and reports failures inside its stream, so a retry wraps the wait
 * for the first piece of text: a call that fails before any text is sent again (at most `policy.attempts` tries, the
 * SDK's own retries off). Once text has gone to the browser it can't be taken back, so a later failure isn't retried.
 */
export async function streamFollowUp(
  input: { context: FollowUpContext; messages: ChatTurn[] },
  opts: { config: FollowUpConfig; policy?: RetryPolicy; abortSignal?: AbortSignal },
): Promise<ReadableStream<Uint8Array>> {
  const { config } = opts;
  const model = languageModel(config.model);
  const system = followUpSystem(config, input.context);
  const started = await withRetry(async () => {
    const result = streamText({ model, system, messages: input.messages, maxOutputTokens: config.maxAnswerTokens, maxRetries: 0, abortSignal: opts.abortSignal });
    const parts = result.stream[Symbol.asyncIterator]();
    for (;;) {
      const next = await parts.next();
      if (next.done) return { parts, first: null };
      const p = next.value;
      if (p.type === "error") throw p.error;
      if (p.type === "text-delta") return { parts, first: p.text };
    }
  }, opts.policy ?? RETRY);

  const { parts } = started;
  let first = started.first;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (first !== null) {
        controller.enqueue(line({ type: "text", text: first }));
        first = null;
        return;
      }
      try {
        for (;;) {
          const next = await parts.next();
          if (next.done) break;
          const p = next.value;
          if (p.type === "text-delta") {
            controller.enqueue(line({ type: "text", text: p.text }));
            return;
          }
          if (p.type === "error") throw p.error;
          if (p.type === "abort") {
            controller.close();
            return;
          }
        }
        controller.enqueue(line({ type: "done" }));
      } catch (e) {
        console.error("[FollowUp] answer broke off:", e);
        controller.enqueue(line({ type: "failed", message: FOLLOWUP_FAILED }));
      }
      controller.close();
    },
    async cancel() {
      await parts.return?.();
    },
  });
}
