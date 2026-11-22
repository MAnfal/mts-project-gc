import { connection } from "next/server";
import { GcSidebar } from "@/components/gc/GcSidebar";
import { NewRunForm } from "@/components/gc/NewRunForm";
import { AppShell } from "@/components/shell/AppShell";
import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema, NewRunConfigSchema } from "@/lib/config/schemas";
import { orderPresets } from "@/lib/runs/new-run";
import { sidebarUser } from "@/lib/runs/sidebar-user";
import { todayInNewYork } from "@/lib/runs/weeks";

/**
 * /runs/new: pick a company profile and a week, then Run. Presets come from the `use: demo` companies only and are
 * passed as props (no presets API). The browser gets the presets, the window limit and New York's date; never the
 * rest of app.yaml, which names the suggest-areas model. `?from=<runId>` ("Edit settings" on a run) fills the form from
 * that run as this browser's IndexedDB holds it.
 */
export default async function NewRunPage({ searchParams }: { searchParams: Promise<{ focus?: string | string[]; from?: string | string[] }> }) {
  await connection(); // read config/ per request, and compute today per request
  const { focus, from } = await searchParams;
  const { appName, maxWindowDays } = readYaml("app.yaml", AppConfigSchema);
  const { defaultPreset } = readYaml("app.yaml", NewRunConfigSchema);
  const list = orderPresets(presets(), defaultPreset);

  return (
    <AppShell sidebar={<GcSidebar appName={appName} user={sidebarUser(list, defaultPreset)} active="new" />}>
      {list.length ? (
        <NewRunForm
          presets={list}
          today={todayInNewYork(new Date())}
          maxWindowDays={maxWindowDays}
          focusProfile={focus === "profile"}
          from={typeof from === "string" ? from : undefined}
        />
      ) : (
        <p className="m-0 px-8 py-9 text-muted-foreground">No preset company is configured.</p>
      )}
    </AppShell>
  );
}
