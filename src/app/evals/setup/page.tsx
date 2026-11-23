import type { Metadata } from "next";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { LiveSetupView } from "@/components/evals/LiveSetupView";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { liveSetupContext, liveSetupView } from "@/lib/evals/liveSetup";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Live setup · Reg Monitor evals" };

/**
 * /evals/setup: the setup every GC run executes, read from config/ per request through the same resolver /api/run
 * uses (liveSetupView), so what this page shows is what runs do. Its prose is config/eval-story.yaml → liveSetup.
 */
export default async function LiveSetupPage() {
  await connection();
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);
  const view = await liveSetupView();

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active="setup" />}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-6">
        <div className="flex grow basis-[260px] flex-col gap-0.5">
          <h1 className="m-0 text-sm font-semibold">{story.liveSetup.title}</h1>
          <span className="text-[13px] text-muted-foreground">{story.liveSetup.description}</span>
        </div>
      </header>
      <div className="px-4 pt-8 pb-12 sm:px-8">
        <div className="mx-auto max-w-[960px]">
          <LiveSetupView view={view} story={story} ctx={liveSetupContext(view)} />
        </div>
      </div>
    </AppShell>
  );
}
