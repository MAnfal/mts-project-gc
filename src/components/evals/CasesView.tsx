"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { filterCases, type CaseFilter, type CaseKey, type CaseRun } from "@/lib/evals/cases";
import { activeFilter, casesPageState, computeCases, filterChoices, selectedRow, type CasesQuery } from "@/lib/evals/casesState";
import type { EvalDirectory } from "@/lib/evals/evalsetInfo";
import type { EvalIndex } from "@/lib/evals/index-schema";
import { loadAnswerKey, loadSuiteRuns, loadTraceChecks, loadWeekDocs, type TraceCheck } from "@/lib/evals/loader";
import type { FactRun } from "@/lib/evals/runFacts";
import type { EvalStory } from "@/lib/evals/story-schema";
import { cn } from "@/lib/utils";
import { CaseFilters, CasesTable, caseWhere } from "./CasesTable";
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

/** Part of the URL was ignored (casesState decides which, and words it). */
function Note({ text }: { text?: string }) {
  return text ? <p className="m-0 rounded-md bg-status-blue-surface px-3 py-2 text-status-blue-fg">{text}</p> : null;
}

/**
 * /evals/cases: the cases one iteration changed (design/HiEvalCases.dc.html), or one setup's cases in one suite
 * (?suite=&setup=, from the Models page). Counts are computed in the browser from the suite (runs.jsonl.gz + the
 * answer keys) by cases.ts; nothing is typed.
 */
export function CasesView({ sidebar, query, directory, story }: { sidebar: ReactNode; query: CasesQuery; directory: EvalDirectory; story: EvalStory }) {
  const { index, error } = useEvalIndex();
  const { iteration, suite: suiteParam, setup: setupParam } = query;
  const st = useMemo(() => (index ? casesPageState(index, iteration, { suite: suiteParam, setup: setupParam }) : null), [index, iteration, suiteParam, setupParam]);
  const it = st?.kind === "iteration" || st?.kind === "setup" ? st : null;
  const suite = (it && index?.suites.find((s) => s.id === it.suite)) || null;
  const loaded = useSuiteData(suite, directory);
  const [filter, setFilter] = useState<CaseFilter | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const computed = useMemo(() => (it ? computeCases(it, loaded?.data ?? null) : { rows: null, error: null }), [it, loaded]);
  const runsById = useMemo(() => new Map((loaded?.data?.runs ?? []).map((r) => [r.id, r])), [loaded]);

  const shell = (main: ReactNode, aside?: ReactNode) => (
    <AppShell sidebar={sidebar} aside={aside} asideLabel="Selected case">
      {main}
    </AppShell>
  );

  if (!index || !st) return shell(<Body><LoadState error={error} /></Body>);
  if (st.kind === "unknown" || st.kind === "error")
    return shell(
      <>
        <Header title="Cases" sub="Each rule an iteration's setup was graded on, with how often its repeats flagged it." />
        <Body>
          <Note text={st.note} />
          {st.kind === "error" ? <LoadState error={st.message} /> : <p className="m-0">There is no iteration “{st.requested}” in the recorded evaluation. Pick one:</p>}
          <IterationNav index={index} current="" />
        </Body>
      </>,
    );
  if (st.kind === "unknownSuite" || st.kind === "unknownSetup")
    return shell(
      <>
        <Header title="Cases" sub="One setup's cases in one suite, opened from the Models page." />
        <Body>
          {st.kind === "unknownSuite" ? (
            <p className="m-0">There is no suite “{st.suite}” in the recorded evaluation.</p>
          ) : (
            <>
              <p className="m-0">
                {st.setup ? `Suite ${shortSuite(st.suite)} did not run “${st.setup}”.` : `Pick a setup in suite ${shortSuite(st.suite)}.`} Its setups:
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {st.setups.map((key) => (
                  <li key={key}>
                    <Link href={`/evals/cases?suite=${encodeURIComponent(st.suite)}&setup=${encodeURIComponent(key)}`}>{key}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link href="/evals/models" className="self-start">
            Back to Models
          </Link>
        </Body>
      </>,
    );
  if (st.kind === "evidenceOnly")
    return shell(
      <>
        <Header title={`Iteration ${st.no} has no cases`} sub={story.iterations[st.id]?.label ?? st.id} />
        <Body>
          <Note text={st.note} />
          <IterationNav index={index} current={st.id} />
          <p className="m-0 max-w-[70ch] leading-relaxed">
            Iteration {st.no} is evidence only: it records the error analysis behind the next change, but no setup was run for it, so no case was graded.
          </p>
          <Link href={`/evals/iterations/${st.id}`} className="self-start">
            Open iteration {st.no}&apos;s evidence
          </Link>
        </Body>
      </>,
    );

  const setupLabel = (key: string) => index.setups.find((s) => s.key === key)?.label ?? key;
  const sub =
    st.kind === "setup"
      ? `Repeats that flagged each rule, out of the setup's finished repeats · ${setupLabel(st.setup)} · suite ${shortSuite(st.suite)} · one setup, opened from the Models page`
      : st.comparedTo
        ? `Repeats that flagged each rule, out of each setup's finished repeats · After = ${setupLabel(st.setup)}, Before = ${setupLabel(st.comparedTo)} · suite ${shortSuite(st.suite)} · held-out weeks are scored, never tuned on`
        : `Repeats that flagged each rule, out of the setup's finished repeats · ${setupLabel(st.setup)} · suite ${shortSuite(st.suite)} · the reference point: nothing to compare it with`;
  // Above the filters: the iteration picker, or, for one setup in one suite, the way back to the Models page.
  const nav =
    st.kind === "iteration" ? (
      <IterationNav index={index} current={st.id} />
    ) : (
      <Link href="/evals/models" className="self-start text-[13px]">
        Back to Models
      </Link>
    );
  const no = st.kind === "iteration" ? st.no : "";
  const rows = computed.rows;

  if (!loaded?.data || !rows)
    return shell(
      <>
        <Header title={st.title} sub={sub} />
        <Body>
          <Note text={st.note} />
          {nav}
          {loaded?.error || computed.error ? <LoadState error={loaded?.error ?? computed.error} /> : <p className="m-0 text-muted-foreground" aria-live="polite">Loading the suite&apos;s runs and answer keys…</p>}
        </Body>
      </>,
    );

  const choices = filterChoices(rows, no, !!st.comparedTo);
  const active = activeFilter(filter, choices);
  const shown = filterCases(rows, active);
  const sel = selectedRow(shown, selected);
  const { titles, checks } = loaded.data;
  // Below md the run panel stacks under the table, so bring it into view when a case is picked.
  const select = (rowId: string) => {
    setSelected(rowId);
    if (window.matchMedia("(max-width: 767px)").matches) requestAnimationFrame(() => document.querySelector("aside")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return shell(
    <>
      <Header title={st.title} sub={sub} />
      <Body>
        <Note text={st.note} />
        {nav}
        <CaseFilters choices={choices} value={active} onChange={setFilter} />
        {shown.length ? (
          <CasesTable rows={shown} titles={titles} evalsets={directory.evalsets} showBefore={!!st.comparedTo} selected={sel?.id ?? null} onSelect={select} />
        ) : (
          <p className="m-0 rounded-md bg-status-neutral-surface px-3 py-2 text-status-neutral-fg">No case matches this filter.</p>
        )}
        <p className="m-0 text-xs text-muted-foreground">
          After and Before count finished repeats; a repeat that failed is listed in the run panel but not counted. Suite {st.suite}.
        </p>
      </Body>
    </>,
    sel ? (
      <RunPanel
        key={sel.id}
        row={sel}
        title={titles.get(sel.doc) ?? sel.doc}
        // RunPanel prints "· iteration <no>" after `where`; one setup in one suite has no iteration, so it names
        // the setup and suite in `where` and shows the iteration as "—".
        where={`${caseWhere(directory.evalsets[sel.evalset], sel.evalset)}${st.kind === "setup" ? ` · ${st.setup} in ${shortSuite(st.suite)}` : ""}`}
        iteration={st.kind === "setup" ? "—" : no}
        suiteId={st.suite}
        runsById={runsById}
        checks={checks}
      />
    ) : undefined,
  );
}
