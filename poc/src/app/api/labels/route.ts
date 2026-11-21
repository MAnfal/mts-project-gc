import { defaultEvalset } from "@/lib/config";
import { listWindow } from "@/lib/fr";
import { loadLabels, saveLabels } from "@/lib/store";
import type { LabelSet } from "@/lib/types";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const profileId = u.searchParams.get("profile") ?? defaultEvalset().company;
  const start = u.searchParams.get("start") ?? defaultEvalset().windowStart;
  const end = u.searchParams.get("end") ?? defaultEvalset().windowEnd;
  const [docs, labels] = await Promise.all([listWindow(start, end), loadLabels(profileId, start, end)]);
  return Response.json({ docs, labels });
}

export async function POST(req: Request) {
  const body = (await req.json()) as LabelSet;
  try {
    await saveLabels(body);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
  return Response.json({ ok: true });
}
