import type { ReactNode } from "react";

/**
 * The three-pane GC AI shell (design/HiReport.dc.html): cream sidebar, a white panel floating on the
 * canvas, and an optional right panel. The panes are flex items that wrap into a single column when
 * the viewport is too narrow for them side by side, so the page never scrolls sideways. Rows pack to the
 * top (content-start); from md up the main panel is at least one viewport tall.
 *
 * Owned by chunk 01. Later chunks compose it (and SidebarNav); they don't edit it.
 */
export function AppShell({
  sidebar,
  children,
  aside,
  asideLabel = "Details",
}: {
  sidebar: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  /** Accessible name for the right panel's landmark. */
  asideLabel?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-wrap content-start gap-2 bg-background p-2 text-sm text-foreground">
      <div className="flex min-w-0 shrink grow basis-[220px] md:max-w-[264px]">{sidebar}</div>
      <main className="flex min-w-0 md:min-h-[calc(100dvh-1rem)] shrink grow-[999] basis-[600px] flex-col rounded-lg bg-card shadow-xs">
        {children}
      </main>
      {aside ? (
        <aside
          aria-label={asideLabel}
          className="flex min-w-0 shrink grow basis-[280px] flex-col gap-3.5 rounded-lg bg-card p-3 shadow-xs md:max-w-[340px]"
        >
          {aside}
        </aside>
      ) : null}
    </div>
  );
}
