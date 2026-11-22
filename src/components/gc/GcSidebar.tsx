"use client";

import { Building2, History, LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { SidebarNav, SidebarNavItem, SidebarSectionLabel, SidebarWordmark } from "@/components/shell/SidebarNav";
import { formatWindow } from "@/lib/runs/report";
import type { StoredRun } from "@/lib/runs/types";
import { cn } from "@/lib/utils";
import { useRecentRuns } from "./useRun";

export interface SidebarUser {
  name: string;
  role: string;
}

const STATUS_NOTE: Partial<Record<StoredRun["status"], string>> = { failed: "failed", interrupted: "interrupted" };

/** "Ledgerly · Nov 2–6": the profile's first word, so the row fits the sidebar. */
const runLabel = (r: StoredRun) => `${r.profile.name.split(/\s+/)[0]} · ${formatWindow(r.request.windowStart, r.request.windowEnd, { year: false })}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** The GC's sidebar: navigation, this browser's recent runs (from IndexedDB) and the user footer. */
export function GcSidebar({ appName, user, activeRunId, active }: { appName: string; user: SidebarUser | null; activeRunId?: string; active?: "new" }) {
  const { runs } = useRecentRuns();
  return (
    <SidebarNav
      footer={
        user ? (
          <>
            <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.name)}
            </span>
            <span className="leading-tight">
              <span className="block font-semibold">{user.name}</span>
              <span className="text-xs text-caption">{user.role}</span>
            </span>
          </>
        ) : undefined
      }
    >
      <SidebarWordmark>{appName}</SidebarWordmark>
      <SidebarNavItem href="/" icon={<Plus />} active={active === "new"}>
        New run
      </SidebarNavItem>
      <SidebarNavItem href="/#recent-runs" icon={<History />}>
        All runs
      </SidebarNavItem>
      <SidebarNavItem href="/" icon={<Building2 />}>
        Company profiles
      </SidebarNavItem>
      <SidebarSectionLabel>
        <span id="recent-runs">Recent runs</span>
      </SidebarSectionLabel>
      {runs.length ? (
        <ul aria-labelledby="recent-runs" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {runs.slice(0, 12).map((r) => (
            <li key={r.id}>
              <Link
                href={`/runs/${r.id}`}
                aria-current={r.id === activeRunId ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-[7px] text-foreground no-underline hover:bg-nav-hover",
                  r.id === activeRunId && "bg-nav-active font-medium",
                )}
              >
                {r.status === "running" ? <LoaderCircle aria-label="running" className="size-3.5 shrink-0 text-status-blue-fg motion-safe:animate-spin" /> : null}
                <span className="min-w-0 truncate">{runLabel(r)}</span>
                {STATUS_NOTE[r.status] ? <span className="shrink-0 text-caption">· {STATUS_NOTE[r.status]}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 px-2.5 py-1 text-[13px] text-caption">Runs you start appear here. They are saved in this browser only.</p>
      )}
    </SidebarNav>
  );
}
