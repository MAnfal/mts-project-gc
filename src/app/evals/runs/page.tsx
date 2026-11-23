import type { Metadata } from "next";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { RunsView } from "@/components/evals/RunsView";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { evalDirectory } from "@/lib/evals/evalsetInfo";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Runs · Reg Monitor evals" };

/** /evals/runs: every recorded run with a link to its raw trace. Names come from config/ per request; runs load in the browser. */
export default async function RunsPage() {
  await connection();
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active="runs" />}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-6">
        <div className="flex grow basis-[260px] flex-col gap-0.5">
          <h1 className="m-0 text-sm font-semibold">Runs</h1>
          <span className="text-[13px] text-muted-foreground">Every recorded run, grouped by suite, with its raw trace</span>
        </div>
      </header>
      <div className="px-4 pt-6 pb-12 sm:px-6">
        <div className="mx-auto max-w-[900px]">
          <RunsView directory={evalDirectory()} />
        </div>
      </div>
    </AppShell>
  );
}
