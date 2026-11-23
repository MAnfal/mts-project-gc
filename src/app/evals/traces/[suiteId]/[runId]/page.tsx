import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { TraceViewer } from "@/components/evals/TraceViewer";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Raw trace · Reg Monitor evals" };

/**
 * /evals/traces/<suiteId>/<runId>: one run's full trace. `suiteId` is an arena id, or `user-view` for an example
 * run. The trace (one gz file) is fetched and decompressed in the browser.
 */
export default async function TracePage({ params }: { params: Promise<{ suiteId: string; runId: string }> }) {
  await connection();
  const { suiteId: suite, runId: run } = await params;
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active="runs" />}>
      <div className="px-4 pt-5 pb-12 sm:px-8">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
          <Link href={`/evals/runs#${encodeURIComponent(suite)}`} className="inline-flex items-center gap-1 self-start text-[13px]">
            <ArrowLeft className="size-3.5" aria-hidden />
            All runs
          </Link>
          <TraceViewer suiteId={suite} runId={run} />
        </div>
      </div>
    </AppShell>
  );
}
