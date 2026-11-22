import type { Metadata } from "next";
import { connection } from "next/server";
import { CasesView } from "@/components/evals/CasesView";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { evalDirectory } from "@/lib/evals/evalsetInfo";
import { EvalStorySchema } from "@/lib/evals/story-schema";

export const metadata: Metadata = { title: "Cases · Reg Monitor evals" };

/**
 * /evals/cases?iteration=<id>: the cases an iteration changed, with a run panel per case. Company names, weeks and
 * splits come from config/ here, per request; the runs, keys and counts load in the browser. With no
 * `iteration`, the client picks the live iteration from index.json.
 */
export default async function CasesPage({ searchParams }: { searchParams: Promise<{ iteration?: string | string[] }> }) {
  await connection();
  const { iteration } = await searchParams;
  const app = readYaml("app.yaml", AppConfigSchema);
  const story = readYaml("eval-story.yaml", EvalStorySchema);

  return (
    <CasesView
      sidebar={<EvalSidebar appName={app.appName} story={story} active="cases" />}
      iterationId={typeof iteration === "string" ? iteration : null}
      directory={evalDirectory()}
      story={story}
    />
  );
}
