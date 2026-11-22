import type { Metadata } from "next";
import { connection } from "next/server";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { IterationView } from "@/components/evals/IterationView";
import { AppShell } from "@/components/shell/AppShell";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Iteration · Reg Monitor evals" };

/**
 * /evals/iterations/<id>: one improvement iteration. Labels and outcomes come from config/eval-story.yaml (read
 * per request); the record and numbers load in the browser, which also shows the not-found state for an id the
 * bundle doesn't have.
 */
export default async function IterationPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);

  return (
    <AppShell sidebar={<EvalSidebar appName={app.appName} story={story} active={id} />}>
      <div className="px-4 pt-7 pb-12 sm:px-8">
        <div className="mx-auto max-w-[860px]">
          <IterationView id={id} story={story} />
        </div>
      </div>
    </AppShell>
  );
}
