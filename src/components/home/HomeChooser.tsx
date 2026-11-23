import { ArrowRight, ChartColumn, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** One choice on the landing page: a card that links to a screen. */
function Choice({ href, icon, title, children }: { href: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 text-foreground no-underline shadow-xs transition-colors hover:border-primary hover:text-foreground"
    >
      <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex items-center gap-1.5 text-base font-semibold text-heading">
        {title}
        <ArrowRight aria-hidden="true" className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
      </span>
      <span className="text-muted-foreground">{children}</span>
    </Link>
  );
}

/**
 * `/`: pick a screen. The GC's app (a new run) or the reviewer's eval results. Server-safe; the wordmark on both
 * sidebars links back here.
 */
export function HomeChooser({ appName }: { appName: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-sm text-foreground">
      <div className="flex w-full max-w-[640px] flex-col gap-6">
        <div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em] text-heading">{appName}</h1>
          <p className="m-0 mt-1 text-muted-foreground">Weekly triage of federal rules that affect your company.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice href="/runs/new" icon={<Play />} title="Run the monitor">
            Pick a company and a week, and get back only the rules that affect it.
          </Choice>
          <Choice href="/evals" icon={<ChartColumn />} title="Eval results">
            How the monitor was measured: scores, iterations, cases and raw traces.
          </Choice>
        </div>
        {/* A static page (public/submission/, rewritten in next.config.ts), so a plain link: not an app route. */}
        <a href="/submission" className="self-start text-[13px] text-caption underline-offset-2 hover:text-heading">
          How it was built: the design, the build transcripts and the code →
        </a>
      </div>
    </main>
  );
}
