"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { caseCounts, casesForIteration, filterCases, liveIterationId, type CaseFilter, type CaseKey, type CaseRun } from "@/lib/evals/cases";
import type { EvalDirectory } from "@/lib/evals/evalsetInfo";
import type { EvalIndex } from "@/lib/evals/index-schema";
import { loadAnswerKey, loadSuiteRuns, loadTraceChecks, loadWeekDocs, type TraceCheck } from "@/lib/evals/loader";
import type { FactRun } from "@/lib/evals/runFacts";
import type { EvalStory } from "@/lib/evals/story-schema";
import { cn } from "@/lib/utils";
import { CaseFilters, CasesTable, caseWhere, type FilterChoice } from "./CasesTable";
import { iterationNumber } from "./EvalSidebar";
import { LoadState, useEvalIndex } from "./EvalSummary";
import { RunPanel } from "./RunPanel";
import { shortSuite } from "./Scoreboard";

type SuiteData = { runs: (CaseRun & FactRun)[]; checks: Record<string, TraceCheck[]>; keys: Record<string, CaseKey>; titles: Map<string, string> };

/** One suite's runs, trace checks, the answer keys of its eval sets and the titles of their weeks' documents. */
function useSuiteData(suite: EvalIndex["suites"][number] | null, directory: EvalDirectory) {
  const [state, setState] = useState<{ id: string; data: SuiteData | null; error: string | null } | null>(null);
  const id = suite?.id ?? null;
  const evalsetKey = suite?.evalsets.join(",") ?? "";
  useEffect(() => {
    if (!id) return;
    let live = true;
    const evalsets = evalsetKey.split(",").filter(Boolean);
    const weeks = [...new Set(evalsets.map((e) => directory.evalsets[e]?.weekId).filter((w): w is string => !!w))];
    Promise.all([
      loadSuiteRuns(id),
      loadTraceChecks(id),
      Promise.all(evalsets.map(async (e) => [e, await loadAnswerKey(e)] as const)),
      Promise.all(weeks.map((w) => loadWeekDocs(w))),
    ])
      .then(([runs, checks, keys, weekDocs]) => {
        const titles = new Map(weekDocs.flat().map((d) => [d.document_number, d.title]));
        // Run records are narrowed to the fields cases.ts and runFacts.ts read (POC SCHEMA.md RunRecord).
        const data = { runs: runs as unknown as SuiteData["runs"], checks: checks ?? {}, keys: Object.fromEntries(keys) as Record<string, CaseKey>, titles };
        if (live) setState({ id, data, error: null });
      })
      .catch((e: Error) => live && setState({ id, data: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [id, evalsetKey, directory]);
  return state && state.id === id ? state : null;
}

function Header({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-6">
      <div className="flex grow basis-[260px] flex-col gap-0.5">
        <h1 className="m-0 text-sm font-semibold">{title}</h1>
        <span className="text-[13px] text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

function IterationNav({ index, current }: { index: EvalIndex; current: string }) {
  return (
    <nav aria-label="Iteration" className="flex flex-wrap items-center gap-1 text-[13px]">
      <span className="mr-1 text-caption">Iteration</span>
      {index.iterations.map((it) => (
        <Link
          key={it.id}
          href={`/evals/cases?iteration=${it.id}`}
          aria-current={it.id === current ? "page" : undefined}
          className={cn(
            "rounded-md px-2 py-0.5 text-foreground no-underline hover:bg-nav-hover hover:text-foreground",
            it.id === current && "bg-nav-active font-semibold",
          )}
        >
          {iterationNumber(it.id)}
        </Link>
      ))}
    </nav>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3.5 px-4 pt-4 pb-8 sm:px-6">{children}</div>;
}

/**
 * /evals/cases: the cases one iteration changed (design/HiEvalCases.dc.html). Counts are computed in the browser
 * from the iteration's suite (runs.jsonl.gz + the answer keys) by cases.ts; nothing is typed.
 */
export function CasesView({ sidebar, iterationId, directory, story }: { sidebar: ReactNode; iterationId: string | null; directory: EvalDirectory; story: EvalStory }) {
  const { index, error } = useEvalIndex();
  const id = iterationId ?? (index ? liveIterationId(index) : null);
  const it = index?.iterations.find((i) => i.id === id) ?? null;
  const suite = (it?.suite && index?.suites.find((s) => s.id === it.suite)) || null;
  const loaded = useSuiteData(it && !it.evidenceOnly ? suite : null, directory);
  const [filter, setFilter] = useState<CaseFilter | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(
    () => (it?.setup && loaded?.data ? casesForIteration(loaded.data.runs, { setup: it.setup, comparedTo: it.comparedTo }, loaded.data.keys) : null),
    [it, loaded],
  );
  const runsById = useMemo(() => new Map((loaded?.data?.runs ?? []).map((r) => [r.id, r])), [loaded]);

  const shell = (main: ReactNode, aside?: ReactNode) => (
    <AppShell sidebar={sidebar} aside={aside} asideLabel="Selected case">
      {main}
    </AppShell>
  );

  if (!index) return shell(<Body><LoadState error={error} /></Body>);
  if (!it || !id)
    return shell(
      <>
        <Header title="Cases" sub="Each rule an iteration's setup was graded on, with how often its repeats flagged it." />
        <Body>
          <p className="m-0">There is no iteration “{iterationId}” in the recorded evaluation. Pick one:</p>
          <IterationNav index={index} current="" />
        </Body>
      </>,
    );

  const no = iterationNumber(it.id);
  const label = story.iterations[it.id]?.label ?? it.title ?? it.id;
  if (it.evidenceOnly)
    return shell(
      <>
        <Header title={`Iteration ${no} has no cases`} sub={label} />
        <Body>
          <IterationNav index={index} current={it.id} />
          <p className="m-0 max-w-[70ch] leading-relaxed">
            Iteration {no} is evidence only: it records the error analysis behind the next change, but no setup was run for it, so no case was graded.
          </p>
          <Link href={`/evals/iterations/${it.id}`} className="self-start">
            Open iteration {no}&apos;s evidence
          </Link>
        </Body>
      </>,
    );

  const setupLabel = (key: string | null) => (key ? (index.setups.find((s) => s.key === key)?.label ?? key) : null);
  const after = setupLabel(it.setup);
  const before = setupLabel(it.comparedTo);
  const title = it.comparedTo ? `Cases that changed in ${no}` : `Cases in ${no}`;
  const sub = it.comparedTo
    ? `Repeats that flagged each rule, out of each setup's finished repeats · After = ${after}, Before = ${before} · suite ${it.suite ? shortSuite(it.suite) : "—"} · held-out weeks are scored, never tuned on`
    : `Repeats that flagged each rule, out of the setup's finished repeats · ${after} · suite ${it.suite ? shortSuite(it.suite) : "—"} · the reference point: nothing to compare it with`;

  if (!loaded || !rows)
    return shell(
      <>
        <Header title={title} sub={sub} />
        <Body>
          <IterationNav index={index} current={it.id} />
          {loaded?.error ? <LoadState error={loaded.error} /> : <p className="m-0 text-muted-foreground" aria-live="polite">Loading the suite&apos;s runs and answer keys…</p>}
        </Body>
      </>,
    );

  const counts = caseCounts(rows);
  const choices: FilterChoice[] = [
    ...(it.comparedTo ? [{ id: "changed" as const, label: `Changed in ${no}`, count: counts.changed }] : []),
    { id: "stillMissed", label: "Still missed", count: counts.stillMissed },
    { id: "trapsFlagged", label: "Traps flagged", count: counts.trapsFlagged },
    { id: "all", label: "All", count: counts.all },
  ];
  const active = filter && choices.some((c) => c.id === filter) ? filter : choices[0].id;
  const shown = filterCases(rows, active);
  const sel = shown.find((r) => r.id === selected) ?? shown[0] ?? null;
  const titles = loaded.data!.titles;
  // Below md the run panel stacks under the table, so bring it into view when a case is picked.
  const select = (rowId: string) => {
    setSelected(rowId);
    if (window.matchMedia("(max-width: 767px)").matches) requestAnimationFrame(() => document.querySelector("aside")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return shell(
    <>
      <Header title={title} sub={sub} />
      <Body>
        <IterationNav index={index} current={it.id} />
        <CaseFilters choices={choices} value={active} onChange={setFilter} />
        {shown.length ? (
          <CasesTable rows={shown} titles={titles} evalsets={directory.evalsets} showBefore={!!it.comparedTo} selected={sel?.id ?? null} onSelect={select} />
        ) : (
          <p className="m-0 rounded-md bg-status-neutral-surface px-3 py-2 text-status-neutral-fg">No case matches this filter.</p>
        )}
        <p className="m-0 text-xs text-muted-foreground">
          After and Before count finished repeats; a repeat that failed is listed in the run panel but not counted. Suite {it.suite}.
        </p>
      </Body>
    </>,
    sel ? (
      <RunPanel
        key={sel.id}
        row={sel}
        title={titles.get(sel.doc) ?? sel.doc}
        where={caseWhere(directory.evalsets[sel.evalset], sel.evalset)}
        iteration={no}
        suiteId={it.suite!}
        runsById={runsById}
        checks={loaded.data!.checks}
      />
    ) : undefined,
  );
}
