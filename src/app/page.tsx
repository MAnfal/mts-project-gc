import { Activity, Clock, Plus } from "lucide-react";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { SidebarNav, SidebarNavItem, SidebarSectionLabel, SidebarWordmark } from "@/components/shell/SidebarNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readYaml } from "@/lib/config/load";
import { AppConfigSchema } from "@/lib/config/schemas";

const TONES = [
  { label: "Critical", className: "bg-status-red-surface text-status-red-fg" },
  { label: "High", className: "bg-status-orange-surface text-status-orange-fg" },
  { label: "Medium", className: "bg-status-yellow-surface text-status-yellow-fg" },
  { label: "Verified", className: "bg-status-green-surface text-status-green-fg" },
  { label: "Info", className: "bg-status-blue-surface text-status-blue-fg" },
  { label: "Example", className: "bg-status-purple-surface text-status-purple-fg" },
  { label: "Low", className: "bg-status-neutral-surface text-status-neutral-fg" },
] as const;

// Placeholder home: proves the theme, the shell, and that config/app.yaml is read on the server per request.
export default async function Home() {
  await connection(); // render at request time, so the YAML on disk is what the page shows
  const app = readYaml("app.yaml", AppConfigSchema);

  return (
    <AppShell
      sidebar={
        <SidebarNav>
          <SidebarWordmark>{app.appName}</SidebarWordmark>
          <SidebarNavItem href="/" icon={<Plus />} active>
            New run
          </SidebarNavItem>
          <SidebarNavItem href="/" icon={<Clock />}>
            All runs
          </SidebarNavItem>
          <SidebarSectionLabel>Diagnostics</SidebarSectionLabel>
          <SidebarNavItem href="/api/probe/stream?seconds=5" icon={<Activity />}>
            Streaming probe
          </SidebarNavItem>
        </SidebarNav>
      }
      asideLabel="Deploy checks"
      aside={
        <>
          <h2 className="m-0 text-sm font-semibold">Deploy checks</h2>
          <p className="m-0 leading-relaxed text-muted-foreground">
            On a deployment, the streaming probe must reach <code>done</code> after 90 seconds:
          </p>
          <code className="rounded-sm bg-background px-2 py-1.5 text-xs break-all">/api/probe/stream?seconds=90</code>
        </>
      }
    >
      <div className="flex flex-col gap-[18px] px-5 py-6 sm:px-8">
        <h1 className="m-0 text-2xl leading-snug font-bold">{app.appName}</h1>
        <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
          Placeholder. The weekly triage lands here in a later step.
        </p>
        <dl className="m-0 grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-1 rounded-md bg-secondary px-3 py-2.5 text-[13px]">
          <dt className="font-medium">App name (config/app.yaml)</dt>
          <dd className="m-0" data-testid="config-app-name">{app.appName}</dd>
          <dt className="font-medium">Longest window</dt>
          <dd className="m-0" data-testid="config-max-window-days">{app.maxWindowDays} days</dd>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <Badge key={t.label} className={t.className}>
              {t.label}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Start a run</Button>
          <a href="/api/probe/stream?seconds=5">Open the 5-second streaming probe</a>
        </div>
      </div>
    </AppShell>
  );
}
