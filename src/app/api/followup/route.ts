import { readYaml } from "@/lib/config/load";
import { FollowUpConfigSchema, type FollowUpConfig } from "@/lib/config/schemas";
import { FOLLOWUP_UNAVAILABLE } from "@/lib/runs/followup-context";
import { parseFollowUpBody, streamFollowUp } from "./followup";

// The follow-up chat's one request. Wiring only: the body guard, prompt and model call are in ./followup.ts. Every
// refusal answers with a fixed sentence: SDK and config errors name model ids, env variables and files, so they go
// to the server log only.
export const runtime = "nodejs";
// One answer is capped at followUp.maxAnswerTokens; with retries' waits (6 s at most) it finishes well inside a minute.
export const maxDuration = 60;

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** POST /api/followup {context, messages} → the answer as NDJSON lines (followup-context.ts → FollowUpLine), or a plain sentence (400, 500, 503). */
export async function POST(req: Request): Promise<Response> {
  let config: FollowUpConfig;
  try {
    config = readYaml("app.yaml", FollowUpConfigSchema).followUp;
  } catch (e) {
    console.error("[FollowUp] settings unreadable:", e);
    return plain("The server couldn't read its settings. Try again later.", 500);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const parsed = parseFollowUpBody(body, config);
  if (!parsed.ok) {
    if (parsed.reason) console.warn("[FollowUp] refused:", parsed.reason);
    return plain(parsed.message, 400);
  }
  try {
    const stream = await streamFollowUp(parsed, { config, abortSignal: req.signal });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    console.error("[FollowUp] failed before the answer started:", e);
    return plain(FOLLOWUP_UNAVAILABLE, 503);
  }
}
