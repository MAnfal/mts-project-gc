import { connection } from "next/server";
import { ExampleView } from "@/components/gc/ExampleView";
import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema, FollowUpSuggestionsSchema, NewRunConfigSchema } from "@/lib/config/schemas";
import { sidebarUser } from "@/lib/runs/sidebar-user";

/**
 * /examples/<id>: a recorded example run in the GC's Report screen. The run itself loads in the browser from
 * /examples/<id>.json (public, generated); the server supplies only the wordmark and the sidebar's user.
 */
export default async function ExamplePage({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // read config/ per request, not at build
  const { id } = await params;
  const app = readYaml("app.yaml", AppConfigSchema);
  const { defaultPreset } = readYaml("app.yaml", NewRunConfigSchema);
  // The follow-up chat's chips only: the model and the prompt stay on the server (/api/followup).
  const { suggestions } = readYaml("app.yaml", FollowUpSuggestionsSchema).followUp;
  return <ExampleView id={id} appName={app.appName} user={sidebarUser(presets(), defaultPreset)} suggestions={suggestions} />;
}
