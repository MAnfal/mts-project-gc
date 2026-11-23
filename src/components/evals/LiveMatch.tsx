"use client";

import Link from "next/link";
import { liveIterationId } from "@/lib/evals/cases";
import type { LiveSetupStory } from "@/lib/evals/story-schema";
import { fillTemplate, iterationNumber } from "@/lib/evals/story";
import { useEvalIndex } from "./EvalSummary";

/**
 * Whether the setup user runs execute (config/, read on the server) is the one the recorded evaluation scored as live
 * (index.json). Matches name and link the iteration that promoted it; a mismatch says so instead of implying the
 * summary's scores describe the running config.
 */
export function LiveMatch({ setupId, story, labels }: { setupId: string; story: LiveSetupStory; labels: Record<string, string> }) {
  const { index } = useEvalIndex();
  if (!index) return null;
  if (index.live.setup !== setupId)
    return (
      <p role="alert" className="m-0 rounded-md bg-status-red-surface px-3 py-2 text-status-red-fg">
        {fillTemplate(story.mismatch, { recorded: index.live.setup, "setup.id": setupId })}
      </p>
    );
  const id = liveIterationId(index);
  if (!id) return null;
  return (
    <p className="m-0 rounded-md bg-status-green-surface px-3 py-2 text-status-green-fg">
      <Link href={`/evals/iterations/${id}`} className="text-inherit">
        {fillTemplate(story.match, { "iteration.number": iterationNumber(id), "iteration.label": labels[id] ?? id })}
      </Link>
    </p>
  );
}
