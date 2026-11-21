import { after } from "next/server";
import { startArena } from "@/lib/arena";
import { experiment } from "@/lib/config";

export const maxDuration = 800;

export async function POST(req: Request) {
  const body = (await req.json()) as { evalsetIds: string[]; cellKeys: string[]; repeat: number };
  try {
    const repeat = Math.min(Math.max(1, body.repeat || 1), Math.max(...experiment().arena.repeatOptions));
    const { arena, go } = await startArena({ ...body, repeat });
    after(go);
    return Response.json({ arena });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 402 });
  }
}
