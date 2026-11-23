import { connection } from "next/server";
import { RunView } from "@/components/gc/RunView";
import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema, FollowUpSuggestionsSchema, NewRunConfigSchema } from "@/lib/config/schemas";
import { sidebarUser } from "@/lib/runs/sidebar-user";

/** /runs/<id>: one run from this browser's IndexedDB. The server has no copy; it only supplies the wordmark and the sidebar's user. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // read config/ per request, not at build
  const { id } = await params;
  const app = readYaml("app.yaml", AppConfigSchema);
  const { defaultPreset } = readYaml("app.yaml", NewRunConfigSchema);
  // The follow-up chat's chips only: the model and the prompt stay on the server (/api/followup).
  const { suggestions } = readYaml("app.yaml", FollowUpSuggestionsSchema).followUp;
  return <RunView id={id} appName={app.appName} user={sidebarUser(presets(), defaultPreset)} suggestions={suggestions} />;
}
