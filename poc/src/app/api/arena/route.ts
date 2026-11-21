import { after } from "next/server";
import { startArena } from "@/lib/arena";

export const maxDuration = 800;

export async function POST(req: Request) {
  const body = (await req.json()) as { profileId: string; windowStart: string; windowEnd: string; cellKeys: string[]; repeat: number };
  try {
    const repeat = Math.min(Math.max(1, body.repeat || 1), 5);
    const { arena, go } = await startArena({ ...body, asOf: body.windowEnd, repeat });
    after(go);
    return Response.json({ arena });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 402 });
  }
}
