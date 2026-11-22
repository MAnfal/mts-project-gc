"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SPLIT_WORD } from "@/lib/evals/cases";
import type { EvalDirectory } from "@/lib/evals/evalsetInfo";
import type { EvalIndex, UserViewIndex } from "@/lib/evals/index-schema";
import { loadSuiteRuns, loadTraceChecks, loadUserViewIndex, USER_VIEW, type TraceCheck } from "@/lib/evals/loader";
import { runLabel, suiteRunRows, type LabelledRun, type RunLabel, type RunRow } from "@/lib/evals/runList";
import { cn } from "@/lib/utils";
import { iterationNumber } from "./EvalSidebar";
import { LoadState, useEvalIndex } from "./EvalSummary";
import { traceHref } from "./RunPanel";

type Suite = EvalIndex["suites"][number];

/** True once the element has come near the viewport (and stays true), so far-down suites load their labels lazily. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return { ref, near };
}

function RunLink({ href, failed }: { href: string; failed: boolean }) {
  return (
    <Link href={href} className={cn("shrink-0 whitespace-nowrap", failed && "text-status-red-fg")}>
      Raw trace
    </Link>
  );
}

function labelText(l: RunLabel, directory: EvalDirectory) {
  const info = directory.evalsets[l.evalset];
  const where = info ? `${info.companyName} · ${info.week} · ${SPLIT_WORD[info.split]}` : l.evalset;
  return `${l.setup} · ${where} · run ${l.repeat + 1}${l.status !== "done" ? ` · ${l.status === "error" ? "failed" : l.status}` : ""}${l.superseded ? " · superseded" : ""}`;
}

/** One suite: every run's trace link (from trace-checks.json); its setup · week · repeat once runs.jsonl.gz loads. */
function SuiteSection({ suite, checks, iterations, directory }: { suite: Suite; checks: Record<string, TraceCheck[]>; iterations: string[]; directory: EvalDirectory }) {
  const { ref, near } = useNearViewport<HTMLElement>();
  const [labels, setLabels] = useState<Map<string, RunLabel> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!near) return;
    let live = true;
    loadSuiteRuns(suite.id)
      .then((runs) => live && setLabels(new Map(runs.map((r) => [r.id, runLabel(r as unknown as LabelledRun)]))))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [near, suite.id]);

  const rows: RunRow[] = suiteRunRows(checks, labels);
  return (
    <section ref={ref} id={suite.id} aria-labelledby={`${suite.id}-h`} className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${suite.id}-h`} className="m-0 text-[15px] font-semibold break-all">
          {suite.id}
        </h2>
        <span className="text-[13px] text-muted-foreground">
          {suite.runs} runs{suite.failed ? `, ${suite.failed} failed` : ""} · {suite.setups.map((s) => s.key).join(", ")}
          {iterations.length ? ` · iteration ${iterations.map(iterationNumber).join(", ")}` : ""}
        </span>
      </div>
      {error ? <LoadState error={error} /> : null}
      {rows.length ? (
        <ul className="m-0 list-none rounded-lg border border-border p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-row-border px-3 py-2 first:border-t-0">
              <div className="flex min-w-0 grow basis-[260px] flex-col">
                <span className="[overflow-wrap:anywhere]">{r.label ? labelText(r.label, directory) : <span className="text-muted-foreground">Loading setup and week…</span>}</span>
                <span className="font-mono text-xs break-all text-muted-foreground">
                  {r.id} ·{" "}
                  <span className={cn("whitespace-nowrap", r.checks.failing.length && "text-status-red-fg")}>
                    {r.checks.passed}/{r.checks.total} trace checks
                  </span>
                </span>
              </div>
              <RunLink href={traceHref(suite.id, r.id)} failed={r.label?.status === "error"} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function UserViewSection({ directory }: { directory: EvalDirectory }) {
  const [rows, setRows] = useState<UserViewIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadUserViewIndex()
      .then((r) => live && setRows(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);
  return (
    <section id={USER_VIEW} aria-labelledby="user-view-h" className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id="user-view-h" className="m-0 text-[15px] font-semibold">
          Example runs (GC view)
        </h2>
        <span className="text-[13px] text-muted-foreground">Recorded runs of the GC view, failed ones included; they record no trace checks.</span>
      </div>
      {error ? <LoadState error={error} /> : null}
      {!rows && !error ? <p className="m-0 text-muted-foreground">Loading the example runs…</p> : null}
      {rows?.length ? (
        <ul className="m-0 list-none rounded-lg border border-border p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-row-border px-3 py-2 first:border-t-0">
              <div className="flex min-w-0 grow basis-[260px] flex-col">
                <span className="[overflow-wrap:anywhere]">
                  {directory.companyNames[r.profileId] ?? r.profileId} · {r.window.start} to {r.window.end} · {r.setup ?? "no setup recorded"} ·{" "}
                  {r.status === "done" ? `${r.items ?? 0} items` : r.status === "error" ? "failed" : r.status}
                </span>
                <span className="font-mono text-xs break-all text-muted-foreground">{r.id}</span>
              </div>
              <RunLink href={traceHref(USER_VIEW, r.id)} failed={r.status === "error"} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Every suite's trace-checks.json (about 100 KB each), all before any section renders, so sections lay out at
 * their full height at once and only the ones in view start loading their runs.jsonl.gz for labels.
 */
function useAllChecks(index: EvalIndex | null) {
  const [state, setState] = useState<{ byId: Record<string, Record<string, TraceCheck[]>> | null; error: string | null }>({ byId: null, error: null });
  const ids = index?.suites.map((s) => s.id).join(",") ?? "";
  useEffect(() => {
    if (!ids) return;
    let live = true;
    Promise.all(ids.split(",").map(async (id) => [id, (await loadTraceChecks(id)) ?? {}] as const))
      .then((all) => live && setState({ byId: Object.fromEntries(all), error: null }))
      .catch((e: Error) => live && setState({ byId: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [ids]);
  return state;
}

/**
 * /evals/runs: every shipped run, newest suite first, then the example runs, each with a direct raw-trace link,
 * so any run's trace is two clicks from the summary (sidebar Runs, then the link).
 */
export function RunsView({ directory }: { directory: EvalDirectory }) {
  const { index, error } = useEvalIndex();
  const checks = useAllChecks(index);
  if (!index || !checks.byId) return <LoadState error={error ?? checks.error} />;
  const suites = [...index.suites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const usedBy = (id: string) => index.iterations.filter((i) => i.suite === id).map((i) => i.id);
  return (
    <div className="flex flex-col gap-7">
      <p className="m-0 max-w-[75ch] leading-relaxed text-muted-foreground">
        {index.counts.runs} runs in {index.counts.suites} suites, and {index.counts.userViewRuns} example runs. Each links to its full trace.
      </p>
      {suites.map((s) => (
        <SuiteSection key={s.id} suite={s} checks={checks.byId![s.id]} iterations={usedBy(s.id)} directory={directory} />
      ))}
      <UserViewSection directory={directory} />
    </div>
  );
}
