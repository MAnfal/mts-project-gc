import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { runPipeline } from "@/lib/pipeline/run";
import { parseRunRequest } from "./request";
import { buildRunConfig } from "./run-config";
import { runToStream } from "./stream";

// One live run, streamed to the browser as NDJSON RunEvents. Wiring only: validation, the config builder and the
// stream sink are the sibling modules. The server keeps nothing; the browser saves the run.
export const runtime = "nodejs";
// Vercel Hobby's maximum. A slow run (a govinfo outage under retries) can come close; a timeout ends the stream
// with no terminal event, which the browser saves as interrupted.
export const maxDuration = 300;

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** POST /api/run {profileId | customProfile, windowStart, windowEnd} → application/x-ndjson, or 400 with a plain message. */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  let limits: { maxWindowDays: number; presetIds: string[] };
  try {
    limits = { maxWindowDays: readYaml("app.yaml", AppConfigSchema).maxWindowDays, presetIds: presets().map((p) => p.id) };
  } catch (e) {
    // A broken config file: the name and field go to the log, never to the browser.
    console.error("[Pipeline] run not started, config unreadable:", e);
    return plain("The server couldn't read its settings, so the run didn't start. Try again later.", 500);
  }
  const parsed = parseRunRequest(body, limits);
  if (!parsed.ok) return plain(parsed.message, 400);
  const { request } = parsed;
  console.info(`[Pipeline] run requested: ${"profileId" in request ? request.profileId : "custom profile"}, ${request.windowStart}..${request.windowEnd}`);
  const stream = runToStream((emit) => runPipeline(buildRunConfig(request), emit));
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
