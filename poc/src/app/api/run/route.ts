import { experiment } from "@/lib/config";
import { after } from "next/server";
import { execute, newRun } from "@/lib/pipeline/run";
import { budgetUsd, saveRun, spentUsd } from "@/lib/store";
import type { RunConfig } from "@/lib/types";

export const maxDuration = 300; // Vercel free-tier ceiling; runs record their own wall-clock against it.

export async function POST(req: Request) {
  const { config, repeat = 1 } = (await req.json()) as { config: RunConfig; repeat?: number };
  if ((await spentUsd()) >= budgetUsd()) return Response.json({ error: `Budget of $${budgetUsd()} exhausted` }, { status: 402 });
  const n = Math.min(Math.max(1, repeat), Math.max(...experiment().arena.repeatOptions));
  const group = config.group || (n > 1 ? `g-${Date.now().toString(36)}` : undefined);
  const runs = Array.from({ length: n }, () => newRun({ ...config, group }));
  await Promise.all(runs.map(saveRun));
  // Repeats run sequentially after the response so the UI can poll progress.
  after(async () => {
    for (const r of runs) await execute(r);
  });
  return Response.json({ ids: runs.map((r) => r.id) });
}
