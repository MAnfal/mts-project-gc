import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { RecordedReport } from "@/components/evals/RecordedReport";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { evalDirectory } from "@/lib/evals/evalsetInfo";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Run report · Reg Monitor evals" };

/**
 * /evals/reports/<suiteId>/<runId>: one recorded run's report, read-only. `suiteId` is an arena id, or `user-view` for
 * an example run. The record loads in the browser (one file, or the suite's runs.jsonl.gz up to the match); company
 * names come from config/ per request.
 */
export default async function RunReportPage({ params }: { params: Promise<{ suiteId: string; runId: string }> }) {
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
          <RecordedReport suiteId={suite} runId={run} companyNames={evalDirectory().companyNames} />
        </div>
      </div>
    </AppShell>
  );
}
