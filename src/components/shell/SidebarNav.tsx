import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sidebar building blocks from design/HiReport.dc.html. Server-safe (no hooks): callers pass `active`
 * themselves. Owned by chunk 01; GC and eval sidebars compose these without editing them.
 */
export function SidebarNav({
  label = "Main",
  children,
  footer,
}: {
  /** Accessible name for the nav landmark. */
  label?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex w-full flex-col gap-0.5 px-1 py-1.5 text-sidebar-foreground">
      {children}
      {footer ? (
        <>
          <div className="grow" />
          <div className="flex items-center gap-2.5 border-t border-sidebar-border p-2.5">{footer}</div>
        </>
      ) : null}
    </nav>
  );
}

/** The product wordmark at the top of the sidebar. */
export function SidebarWordmark({ children, href = "/" }: { children: ReactNode; href?: string }) {
  return (
    <Link
      href={href}
      className="px-2 pt-1 pb-3 text-[19px] font-bold tracking-[-0.02em] text-heading no-underline hover:text-heading"
    >
      {children}
    </Link>
  );
}

/** One nav row: optional icon + label. `active` marks the current page (aria-current + tint). */
export function SidebarNavItem({
  href,
  icon,
  children,
  active = false,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[34px] items-center gap-2.5 rounded-md px-2.5 py-1.5 no-underline hover:bg-nav-hover hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-nav-active font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

/** Small-caps group label, e.g. "RECENT RUNS". */
export function SidebarSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-[18px] pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-caption uppercase">
      {children}
    </div>
  );
}
