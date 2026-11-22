"use client";

import { ChevronDown, CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CaseRow } from "@/lib/evals/cases";
import { loadTrace, type TraceCheck } from "@/lib/evals/loader";
import { filterWhy, judgeView, traceFacts, type FactRun, type FilterWhy, type TraceFacts } from "@/lib/evals/runFacts";
import { checkSummary } from "@/lib/evals/runList";
import { cn } from "@/lib/utils";

export const traceHref = (suiteId: string, runId: string) => `/evals/traces/${encodeURIComponent(suiteId)}/${encodeURIComponent(runId)}`;

type Facts = TraceFacts | { error: string };
/** Traces already read this session, so going back to a case doesn't fetch its traces again. */
const factsCache = new Map<string, Promise<Facts>>();

async function readFacts(suiteId: string, runId: string): Promise<Facts> {
  const events = [];
  try {
    for await (const e of loadTrace(suiteId, runId)) events.push(e);
    return traceFacts(events);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Each listed run's event count and passages, read from its trace (one gz file per run), as each one arrives. */
function useTraceFacts(suiteId: string, runIds: string[]): Record<string, Facts> {
  const [facts, setFacts] = useState<Record<string, Facts>>({});
  const key = runIds.join(",");
  useEffect(() => {
    let live = true;
    for (const id of key ? key.split(",") : []) {
      const k = `${suiteId}/${id}`;
      if (!factsCache.has(k)) factsCache.set(k, readFacts(suiteId, id));
      factsCache.get(k)!.then((f) => live && setFacts((prev) => ({ ...prev, [id]: f })));
    }
    return () => {
      live = false;
    };
  }, [suiteId, key]);
  return facts;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 text-[13px] font-semibold text-caption">{children}</h3>;
}

const toggle = cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 self-start text-primary [&[data-panel-open]_svg]:rotate-180");

function WhySection({ why }: { why: FilterWhy }) {
  const heading =
    why.kind === "llm" ? (why.relevant ? "Why the filter flagged it" : "Why the filter skipped it") : why.kind === "jev" ? "Why the filter skipped it" : "The filter's decision";
  const text =
    why.kind === "llm"
      ? (why.reason ?? "The LLM filter decided without a recorded reason.")
      : why.kind === "jev"
        ? `Screened out before the LLM filter: the Jev pre-filter scored it ${why.probability ?? "—"}, below the run's threshold of ${why.threshold ?? "—"}.`
        : why.kind === "baseline"
          ? "This setup is the single-prompt baseline: it has no filter step, so there is no decision to explain."
          : why.kind === "failed"
            ? `This repeat did not finish: ${why.error}`
            : "The run recorded no filter decision for this document.";
  return (
    <section className="flex flex-col gap-1.5">
      <H3>{heading}</H3>
      <p className="m-0 leading-relaxed">{text}</p>
    </section>
  );
}

function PassagesSection({ facts, doc }: { facts: Facts | undefined; doc: string }) {
  if (!facts) return <p className="m-0 text-xs text-muted-foreground">Reading this run&apos;s trace for the passages…</p>;
  if ("error" in facts) return <p className="m-0 text-xs text-status-red-fg">The trace could not be read: {facts.error}</p>;
  const p = facts.passages.get(doc);
  if (!p) return <p className="m-0 text-xs text-muted-foreground">No passages recorded for this document in this run.</p>;
  return (
    <Collapsible>
      <CollapsibleTrigger className={toggle}>
        The {p.picked.length} passages it read
        <ChevronDown />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Picked by the pre-filter from {p.chunks} scored passages of the document.
        </p>
        <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {p.picked.map((x) => (
            <li key={x.index} className="rounded-md bg-background px-3 py-2">
              <div className="text-xs text-caption">
                Passage {x.index} · p = {x.p}
              </div>
              <p className="m-0 mt-1 text-[13px] leading-relaxed [overflow-wrap:anywhere]">{x.text}</p>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The trace-check result: "All N passed" or the failing ones named. `compact` folds the passed list away (run panel). */
export function ChecksBox({ checks, compact = false }: { checks: TraceCheck[] | null | undefined; compact?: boolean }) {
  const s = checkSummary(checks);
  if (!s) return <p className="m-0 rounded-md bg-status-neutral-surface px-3.5 py-3 text-status-neutral-fg">No trace checks recorded for this run.</p>;
  const ok = s.failing.length === 0;
  const list = (
    <ul className="m-0 pl-[18px] leading-relaxed">
      {(ok ? checks! : s.failing).map((c) => (
        <li key={c.id} className="[overflow-wrap:anywhere]">
          {c.label}
          {ok ? null : <span className="opacity-80"> · {c.detail}</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <section className={cn("flex flex-col gap-2 rounded-md px-3.5 py-3", ok ? "bg-status-green-surface text-status-green-fg" : "bg-status-red-surface text-status-red-fg")}>
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
        {ok ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
        {ok ? `All ${s.total} trace checks passed` : `${s.failing.length} of ${s.total} trace checks failed`}
      </h3>
      {ok && compact ? (
        <Collapsible>
          <CollapsibleTrigger className={cn(toggle, "text-current")}>
            Which checks
            <ChevronDown />
          </CollapsibleTrigger>
          <CollapsibleContent>{list}</CollapsibleContent>
        </Collapsible>
      ) : (
        list
      )}
    </section>
  );
}

const shortModel = (m: string) => m.split("/").at(-1) ?? m;

function JudgesSection({ run, doc }: { run: FactRun; doc: string }) {
  const v = judgeView(run, doc);
  return (
    <section className="flex flex-col gap-1.5">
      <H3>Judge panel on the action text</H3>
      {v.kind === "notJudged" ? (
        <p className="m-0 text-muted-foreground">Not judged: the panel judges only the first repeat of each setup.</p>
      ) : v.kind === "nothingToJudge" ? (
        <p className="m-0 text-muted-foreground">Nothing to judge: this run didn&apos;t flag the document, and the panel judges only flagged items.</p>
      ) : (
        <>
          <ul className="m-0 list-none p-0 leading-relaxed">
            {v.verdicts.map((x) => (
              <li key={x.criterion}>
                {x.criterion}: <span className="font-semibold">{x.verdict}</span> <span className="text-muted-foreground">· votes {x.votes.join(" / ")}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-muted-foreground">{v.judges.map(shortModel).join(", ")}</p>
          <Collapsible>
            <CollapsibleTrigger className={toggle}>
              Judges&apos; reasoning
              <ChevronDown />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
                {v.reasoning.map((x) => (
                  <li key={`${x.model}-${x.criterion}`} className="text-[13px] leading-relaxed">
                    <span className="font-medium">
                      {shortModel(x.model)} · {x.criterion} · {x.verdict}
                    </span>
                    <span className="text-muted-foreground"> — {x.why}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </section>
  );
}

/**
 * What one repeat of the iteration's setup did on the selected case (design/HiEvalCases.dc.html, right panel):
 * the filter's reason, the passages it read, the trace checks and the judge panel, with a raw-trace link for
 * every repeat so any run's trace is one click from here.
 */
export function RunPanel({
  row,
  title,
  where,
  iteration,
  suiteId,
  runsById,
  checks,
}: {
  row: CaseRow;
  title: string;
  where: string;
  iteration: string;
  suiteId: string;
  runsById: ReadonlyMap<string, FactRun>;
  checks: Record<string, TraceCheck[]>;
}) {
  const repeats = row.after.repeats;
  const [tab, setTab] = useState(0);
  const facts = useTraceFacts(
    suiteId,
    repeats.map((r) => r.id),
  );
  const current = repeats[Math.min(tab, repeats.length - 1)];
  const run = current ? runsById.get(current.id) : undefined;

  return (
    <div className="flex flex-col gap-4 p-1 md:sticky md:top-2 md:max-h-[calc(100dvh-2.5rem)] md:overflow-y-auto">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="leading-snug font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">
            {row.doc} · {where} · iteration {iteration}
          </span>
        </div>
        {repeats.length ? (
          <div role="tablist" aria-label="Repeat" className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-nav-hover p-[3px]">
            {repeats.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r === current}
                onClick={() => setTab(i)}
                className={cn("h-7 rounded-md px-1 text-[13px]", r === current ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
              >
                Run {r.repeat + 1}
                {r.status !== "done" ? " · failed" : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!current || !run ? (
        <p className="m-0 text-muted-foreground">This setup has no repeats on this company-week.</p>
      ) : (
        <div role="tabpanel" aria-label={`Run ${current.repeat + 1}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <WhySection why={filterWhy(run, row.doc)} />
            {run.status === "done" ? <PassagesSection facts={facts[current.id]} doc={row.doc} /> : null}
          </div>
          <ChecksBox checks={checks[current.id]} compact />
          <JudgesSection run={run} doc={row.doc} />
        </div>
      )}

      {repeats.length ? (
        <nav aria-label="Raw traces" className="flex flex-col gap-2 border-t border-border-subtle pt-3.5">
          {repeats.map((r) => {
            const f = facts[r.id];
            const count = f && !("error" in f) ? ` · ${f.events.toLocaleString("en-US")} events` : "";
            return (
              <Link
                key={r.id}
                href={traceHref(suiteId, r.id)}
                className={cn(
                  buttonVariants({ variant: r === current ? "default" : "outline" }),
                  "h-auto min-h-[34px] justify-center no-underline [overflow-wrap:anywhere] whitespace-normal",
                )}
              >
                Run {r.repeat + 1} · Raw trace{count}
                {r.status !== "done" ? " (failed run)" : ""}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
