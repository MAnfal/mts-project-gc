"use client";

import { Building2, ChevronDown, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { buildFollowUpContext, followUpChatId } from "@/lib/runs/followup-context";
import { withHeldBack } from "@/lib/runs/memo";
import { applyConfirmed, reduceEvents, type RunViewState } from "@/lib/runs/reduce";
import { formatWindow, reportJson, sortItems } from "@/lib/runs/report";
import type { StoredRun } from "@/lib/runs/types";
import { saveText } from "./download";
import { FailedStep } from "./FailedStep";
import { FollowUpChat } from "./FollowUpChat";
import { GcSidebar, type SidebarUser } from "./GcSidebar";
import { ReportView } from "./ReportView";
import { RunSteps } from "./RunSteps";
import { SourcesPanel } from "./SourcesPanel";
import { useRun } from "./useRun";

/**
 * One run, live or reopened from IndexedDB: Running, Report, Failed or Interrupted, all from its stored events. A
 * finished report gets the follow-up chat under it; `suggestions` are its chips (config/app.yaml → followUp).
 */
export function RunView({ id, appName, user, suggestions }: { id: string; appName: string; user: SidebarUser | null; suggestions: string[] }) {
  const { run, persistent, retry, confirm } = useRun(id);
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const onRetry = async () => {
    setRetrying(true);
    const next = await retry();
    if (next) router.push(`/runs/${next}`);
    else setRetrying(false);
  };
  // Confirmations are applied after the events: the run's events stay what the server sent (amendment 5).
  const view = useMemo(() => (run ? applyConfirmed(reduceEvents(run.events), run.confirmed ?? [], run.profile.generalCounsel) : null), [run]);
  const editHref = `/runs/new?from=${encodeURIComponent(id)}`;
  const items = useMemo(() => (view ? sortItems(view.items) : []), [view]);
  const chatId = run ? followUpChatId("live", id, run.status) : null;
  const followUpContext = useMemo(() => (chatId && run && view ? buildFollowUpContext(view, run.profile) : null), [chatId, run, view]);

  return (
    <AppShell
      sidebar={<GcSidebar appName={appName} user={user} activeRunId={id} />}
      asideLabel="Sources and profile"
      aside={run && view ? <SourcesPanel items={run.status === "done" ? items : view.confirmed} profile={run.profile} /> : undefined}
    >
      {run && view ? <Header run={run} view={view} /> : null}
      <div className="px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[800px] flex-col gap-[22px]">
          {!persistent ? (
            <p className="m-0 rounded-md bg-status-yellow-surface px-3 py-2 text-[13px] text-status-yellow-fg">
              This browser isn&apos;t letting the app save runs (private browsing, or storage is blocked), so runs last only until you close or reload this tab.
            </p>
          ) : null}
          {run === undefined ? <p className="m-0 text-muted-foreground">Loading run…</p> : null}
          {run === null ? <NotFound /> : null}
          {run && view ? (
            run.status === "done" ? (
              <ReportView
                view={view}
                items={items}
                company={view.company ?? run.profile.name}
                trace={<RunSteps steps={view.steps} live={false} />}
                onConfirm={confirm}
                followUp={chatId && followUpContext ? <FollowUpChat chatId={chatId} context={followUpContext} suggestions={suggestions} /> : undefined}
              />
            ) : (
              <>
                <ProfileChip run={run} />
                {run.status === "running" ? <Running run={run} steps={<RunSteps steps={view.steps} live />} currentLabel={view.steps.find((s) => s.state === "running")?.label ?? null} /> : null}
                {run.status === "failed" ? (
                  <>
                    <p className="m-0 text-[15px] text-muted-foreground">The run stopped before it finished.</p>
                    {view.failure && view.failure.step === null ? <FailedStep alert message={view.failure.message} onRetry={onRetry} retrying={retrying} editHref={editHref} /> : null}
                    <RunSteps steps={view.steps} live={false} onRetry={onRetry} retrying={retrying} editHref={editHref} />
                  </>
                ) : null}
                {run.status === "interrupted" ? (
                  <>
                    <FailedStep
                      alert
                      message="This run didn't finish: the connection closed before its last step, or the page was reloaded while it ran. A run can't pick up where it stopped; Retry starts it again with the same settings."
                      onRetry={onRetry}
                      retrying={retrying}
                      editHref={editHref}
                    />
                    <RunSteps steps={view.steps} live={false} />
                  </>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function Header({ run, view }: { run: StoredRun; view: RunViewState }) {
  const title = `${run.profile.name.split(/\s+/)[0]} · ${formatWindow(run.request.windowStart, run.request.windowEnd)}`;
  const [open, setOpen] = useState(false);
  const base = `reg-monitor_${run.profile.name.split(/\s+/)[0].toLowerCase()}_${run.request.windowStart}_${run.request.windowEnd}`;
  const result = run.result;
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border-subtle px-5 py-3">
      <span className="grow font-medium">{title}</span>
      {result ? (
        <div className="relative">
          <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Download aria-hidden="true" />
            Download
            <ChevronDown aria-hidden="true" />
          </Button>
          {open ? (
            <div className="absolute right-0 z-10 mt-1 flex min-w-40 flex-col rounded-md bg-popover p-1 shadow-md">
              {/* Held-back and confirmed items get their own section in the .md (src/lib/runs/memo.ts). */}
              <DownloadItem name={`${base}.md`} type="text/markdown" text={() => withHeldBack(result.markdown, view)} onDone={() => setOpen(false)}>
                Report (.md)
              </DownloadItem>
              <DownloadItem name={`${base}.json`} type="application/json" text={() => reportJson(view, { company: run.profile.name })} onDone={() => setOpen(false)}>
                Report (.json)
              </DownloadItem>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DownloadItem({ name, type, text, onDone, children }: { name: string; type: string; text: () => string; onDone: () => void; children: ReactNode }) {
  const save = () => {
    saveText(name, type, text());
    onDone();
  };
  return (
    <button type="button" onClick={save} className="rounded-sm px-2.5 py-1.5 text-left hover:bg-nav-hover">
      {children}
    </button>
  );
}

function ProfileChip({ run }: { run: StoredRun }) {
  return (
    <div className="inline-flex items-center gap-2 self-center rounded-lg bg-secondary px-3 py-1.5 text-center">
      <Building2 aria-hidden="true" className="size-3.5 shrink-0" />
      {run.profile.name} · Federal rules published {formatWindow(run.request.windowStart, run.request.windowEnd)}
    </div>
  );
}

function useSecondsSince(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
}

function Running({ run, steps, currentLabel }: { run: StoredRun; steps: ReactNode; currentLabel: string | null }) {
  const seconds = useSecondsSince(run.createdAt);
  return (
    <>
      <div className="flex flex-col gap-1">
        <p role="status" aria-live="polite" aria-atomic="true" className="m-0 text-[15px] text-muted-foreground">
          <span aria-hidden="true">Working for {seconds}s</span>
          <span className="sr-only">{currentLabel ? `Working: ${currentLabel}` : "Starting the run"}</span>
        </p>
        <div className="mt-2">{steps}</div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2.5 pt-2">
        <div className="h-[26px] w-[55%] rounded-md bg-secondary motion-safe:animate-pulse" />
        <div className="h-3.5 w-[92%] rounded-md bg-secondary motion-safe:animate-pulse" />
        <div className="h-3.5 w-[80%] rounded-md bg-secondary motion-safe:animate-pulse" />
        <div className="mt-2 h-[120px] w-full rounded-lg bg-secondary motion-safe:animate-pulse" />
      </div>
      <p className="m-0 leading-relaxed text-muted-foreground">
        Items appear here only after their dates and citation match the Federal Register. Anything that can&apos;t be confirmed is listed separately for you to check.
      </p>
    </>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="m-0 text-2xl font-bold text-heading">Run not found</h1>
      <p className="m-0 text-muted-foreground">Runs are saved only in the browser that started them, and this one has no run with this link.</p>
      <Link href="/">Start a new run</Link>
    </div>
  );
}
