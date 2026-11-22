import { connection } from "next/server";
import { GcSidebar } from "@/components/gc/GcSidebar";
import { StartRunButton } from "@/components/gc/StartRunButton";
import { AppShell } from "@/components/shell/AppShell";
import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";
import { DEMO_RUN as DEMO } from "@/lib/runs/demo";
import { formatWindow } from "@/lib/runs/report";
import { sidebarUser } from "@/lib/runs/sidebar-user";

export default async function Home() {
  await connection(); // read config/ per request, not at build
  const app = readYaml("app.yaml", AppConfigSchema);
  const all = presets();
  const preset = all.find((p) => p.id === DEMO.profileId);

  return (
    <AppShell sidebar={<GcSidebar appName={app.appName} user={sidebarUser(all, DEMO.profileId)} active="new" />}>
      <div className="flex flex-col gap-[18px] px-5 py-6 sm:px-8">
        <h1 className="m-0 text-2xl leading-snug font-bold text-heading">Weekly federal rules triage</h1>
        <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
          Scan every document the Federal Register published in a week, keep only what affects the company, and get each one back with a priority, a
          verified deadline, an owner and the official source. A run takes about a minute.
        </p>
        {preset ? (
          <div>
            <StartRunButton request={DEMO} profile={preset}>
              Run {preset.name.split(/\s+/)[0]} · {formatWindow(DEMO.windowStart, DEMO.windowEnd, { year: false })}
            </StartRunButton>
          </div>
        ) : (
          <p className="m-0 text-muted-foreground">No preset company is configured.</p>
        )}
      </div>
    </AppShell>
  );
}
