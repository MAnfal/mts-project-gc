import type { Metadata } from "next";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { EvalSummary } from "@/components/evals/EvalSummary";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema, EvalAppConfigSchema } from "@/lib/config/schemas";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Evaluation summary · Reg Monitor" };

/**
 * /evals: the reviewer's summary. The prose (config/eval-story.yaml) and targets (config/app.yaml) are read here
 * per request; the recorded numbers load in the browser from public/evals/index.json (EvalSummary).
 */
export default async function EvalSummaryPage() {
  await connection(); // render at request time, so edits to the YAML show without a rebuild
  const app = readYaml("app.yaml", AppConfigSchema);
  const { evalTargets } = readYaml("app.yaml", EvalAppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active="summary" />}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-6 py-3.5">
        <div className="flex grow basis-[300px] flex-col gap-0.5">
          <span className="font-semibold">{story.page.title}</span>
          <span className="text-[13px] text-muted-foreground">{story.page.description}</span>
        </div>
      </header>
      <div className="px-4 pt-8 pb-12 sm:px-8">
        <div className="mx-auto max-w-[900px]">
          <EvalSummary story={story} targets={evalTargets} />
        </div>
      </div>
    </AppShell>
  );
}
