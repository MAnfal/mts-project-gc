import { readYaml } from "@/lib/config/load";
import { SuggestAreasConfigSchema, type SuggestAreasConfig } from "@/lib/config/schemas";
import { parseSuggestBody, suggestAreas } from "./suggest";

// "Suggest from description" on the new-run screen. Wiring only: the body guard, prompt and model call are in
// ./suggest.ts. Every failure answers with a fixed sentence: SDK and config errors name model ids, env variables and
// files, so they go to the server log only.
export const runtime = "nodejs";

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** POST /api/suggest-areas {description} → {areas: [{id, description}]}, or a plain message (400, 500, 503). */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const parsed = parseSuggestBody(body);
  if (!parsed.ok) return plain(parsed.message, 400);

  let config: SuggestAreasConfig;
  try {
    config = readYaml("app.yaml", SuggestAreasConfigSchema).suggestAreas;
  } catch (e) {
    console.error("[SuggestAreas] settings unreadable:", e);
    return plain("The server couldn't read its settings. Add the areas yourself, or try again later.", 500);
  }
  try {
    return Response.json({ areas: await suggestAreas(parsed.description, { config }) });
  } catch (e) {
    console.error("[SuggestAreas] failed:", e);
    return plain("Suggestions aren't available right now. Add the areas yourself, or try again later.", 503);
  }
}
