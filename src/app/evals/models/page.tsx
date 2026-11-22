import type { Metadata } from "next";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { ModelsView } from "@/components/evals/ModelTable";
import { AppShell } from "@/components/shell/AppShell";
import { judges } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Models · Reg Monitor evals" };

/**
 * /evals/models: the models the arena compared, within one suite at a time, and why the live model. The prose
 * (config/eval-story.yaml → models) and the judge panel (config/judges.yaml, via judges()) are read here per
 * request; the recorded numbers load in the browser from public/evals/index.json.
 */
export default async function ModelsPage() {
  await connection();
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);
  const panel = judges();

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active="models" />}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-6">
        <div className="flex grow basis-[260px] flex-col gap-0.5">
          <h1 className="m-0 text-sm font-semibold">{story.models.title}</h1>
          <span className="text-[13px] text-muted-foreground">{story.models.description}</span>
        </div>
      </header>
      <div className="px-4 pt-6 pb-12 sm:px-6">
        <div className="mx-auto max-w-[1160px]">
          <ModelsView story={story} judges={{ models: panel.judges.map((j) => j.model), minAgree: panel.minAgree }} />
        </div>
      </div>
    </AppShell>
  );
}
