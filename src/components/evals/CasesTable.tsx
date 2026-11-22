"use client";

import { formatTally, SPLIT_WORD, type CaseFilter, type CaseRow } from "@/lib/evals/cases";
import type { FilterChoice } from "@/lib/evals/casesState";
import type { EvalsetInfo } from "@/lib/evals/evalsetInfo";
import { cn } from "@/lib/utils";

const CHANGE = {
  fixed: { text: "Fixed", cls: "bg-status-green-surface text-status-green-fg" },
  regressed: { text: "Regressed", cls: "bg-status-orange-surface text-status-orange-fg" },
};
const KIND = {
  trap: { text: "Trap", cls: "bg-status-red-surface text-status-red-fg" },
  indirect: { text: "Indirect", cls: "bg-status-blue-surface text-status-blue-fg" },
};

function Tag({ text, cls }: { text: string; cls: string }) {
  return <span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>{text}</span>;
}

/** "SkyHop Airlines · Oct 26–30 · tuning": the case's company-week and its split. */
export function caseWhere(info: EvalsetInfo | undefined, evalset: string) {
  return info ? `${info.companyName} · ${info.week} · ${SPLIT_WORD[info.split]}` : evalset;
}

/** Fixed / Regressed and Trap / Indirect tags, then the answer key's reason. */
function WhatHappened({ row: r }: { row: CaseRow }) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      {r.change ? <Tag {...CHANGE[r.change]} /> : null}
      {r.kind !== "direct" ? <Tag {...KIND[r.kind]} /> : null}
      {r.reason ? <span className="line-clamp-2 text-muted-foreground">{r.reason}</span> : null}
    </div>
  );
}


/** The filter buttons: at most four choices, each with its computed count ("All N cases" reads as a link). */
export function CaseFilters({ choices, value, onChange }: { choices: FilterChoice[]; value: CaseFilter; onChange: (f: CaseFilter) => void }) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
      {choices.map((c) =>
        c.id === "all" ? (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === "all"}
            onClick={() => onChange("all")}
            className={cn("ml-1.5 rounded-md px-1.5 py-1 text-primary underline underline-offset-[3px] hover:text-foreground", value === "all" && "font-semibold")}
          >
            All {c.count} cases
          </button>
        ) : (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3",
              value === c.id ? "border-border-strong bg-secondary font-medium" : "border-border bg-card hover:bg-nav-hover",
            )}
          >
            {c.label} <span className="text-muted-foreground">{c.count}</span>
          </button>
        ),
      )}
    </div>
  );
}

/**
 * Cases × setups (design/HiEvalCases.dc.html): each row is one keyed doc in one company-week, with how many
 * finished repeats of each setup flagged it. Selecting a row opens it in the run panel.
 */
export function CasesTable({
  rows,
  titles,
  evalsets,
  showBefore,
  selected,
  onSelect,
}: {
  rows: CaseRow[];
  titles: ReadonlyMap<string, string>;
  evalsets: Record<string, EvalsetInfo>;
  showBefore: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const th = "px-2 py-2.5 font-semibold sm:px-3";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse leading-[1.45] tabular-nums sm:min-w-[600px]">
        <thead>
          <tr className="bg-secondary text-left">
            <th scope="col" className={`${th} pl-3.5`}>
              Rule · company-week
            </th>
            <th scope="col" className={th}>
              Expected
            </th>
            <th scope="col" className={`${th} text-right`}>
              {showBefore ? "After" : "Flagged"}
            </th>
            {showBefore ? (
              <th scope="col" className={`${th} text-right`}>
                Before
              </th>
            ) : null}
            <th scope="col" className={`${th} hidden pr-3.5 sm:table-cell`}>
              What happened
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const on = r.id === selected;
            return (
              <tr key={r.id} className={cn("border-t border-row-border align-top", on ? "bg-accent" : "hover:bg-background")}>
                <td className="py-3 pr-2 pl-3.5 [overflow-wrap:anywhere] sm:pr-3">
                  <button
                    type="button"
                    aria-current={on ? "true" : undefined}
                    onClick={() => onSelect(r.id)}
                    title={titles.get(r.doc)}
                    className="line-clamp-2 text-left font-semibold hover:underline"
                  >
                    {titles.get(r.doc) ?? r.doc}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {r.doc} · {caseWhere(evalsets[r.evalset], r.evalset)}
                  </div>
                  <div className="mt-1.5 sm:hidden">
                    <WhatHappened row={r} />
                  </div>
                </td>
                <td className="px-2 py-3 sm:p-3">{r.expected === "flag" ? "Flag" : "Skip"}</td>
                <td className="px-2 py-3 text-right font-semibold sm:p-3">{formatTally(r.after)}</td>
                {showBefore ? <td className="py-3 pr-3 pl-2 text-right text-muted-foreground sm:p-3">{r.before ? formatTally(r.before) : "—"}</td> : null}
                <td className="hidden py-3 pr-3.5 pl-3 sm:table-cell">
                  <WhatHappened row={r} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
