"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { loadIterationFile } from "@/lib/evals/loader";

/** The parts of the POC's error-analysis.json this sheet lays out; anything else shows in the raw view. */
const ErrorAnalysisSchema = z.looseObject({
  suite: z.string(),
  setup: z.string(),
  split: z.string(),
  runs: z.number(),
  excludedTestRuns: z.number().optional(),
  totals: z.object({ failures: z.number(), distinct: z.number() }),
  bySignal: z.record(z.string(), z.number()),
  buckets: z.array(z.tuple([z.string(), z.number()])),
  rows: z.array(z.looseObject({ evalset: z.string(), doc: z.string().optional(), kind: z.string(), bucket: z.string(), times: z.number().optional() })),
  llm: z
    .looseObject({
      rootCauses: z.array(z.looseObject({ cause: z.string(), whose: z.string().optional(), failures: z.number().optional(), proposedChange: z.string().optional() })),
    })
    .optional(),
});

const th = "px-3 py-2 text-left font-semibold";
const td = "px-3 py-2 align-top";

function Analysis({ raw }: { raw: string }) {
  const parsed = ErrorAnalysisSchema.safeParse(JSON.parse(raw));
  const rawView = (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>Raw error-analysis.json</CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-[60vh] overflow-auto rounded-md border border-border bg-stone-50 p-3 text-xs">{raw}</pre>
      </CollapsibleContent>
    </Collapsible>
  );
  if (!parsed.success) return rawView;
  const a = parsed.data;
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 leading-relaxed">
        {a.setup} on the {a.split} weeks of {a.suite}: {a.runs} runs read
        {a.excludedTestRuns !== undefined ? `, ${a.excludedTestRuns} held-out runs left unread` : ""}. {a.totals.failures} failures,{" "}
        {a.totals.distinct} distinct.
      </p>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Failures by bucket</h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="bg-secondary">
                <th scope="col" className={th}>Bucket</th>
                <th scope="col" className={`${th} text-right`}>Failures</th>
              </tr>
            </thead>
            <tbody>
              {a.buckets.map(([b, n]) => (
                <tr key={b} className="border-t border-row-border">
                  <td className={td}>{b}</td>
                  <td className={`${td} text-right`}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 text-xs text-caption">By signal: {Object.entries(a.bySignal).map(([k, n]) => `${k} ${n}`).join(" · ")}</p>
      </section>
      {a.llm?.rootCauses.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">Root causes</h3>
          <ol className="m-0 flex flex-col gap-3 pl-5">
            {a.llm.rootCauses.map((c, i) => (
              <li key={i} className="leading-relaxed">
                {c.cause}
                {c.whose || c.failures !== undefined ? (
                  <span className="text-caption">
                    {" "}
                    ({[c.whose && `fix in ${c.whose}`, c.failures !== undefined && `${c.failures} failures`].filter(Boolean).join(", ")})
                  </span>
                ) : null}
                {c.proposedChange ? <p className="m-0 mt-1 text-muted-foreground">Proposed: {c.proposedChange}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Failing cases</h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th scope="col" className={th}>Company-week</th>
                <th scope="col" className={th}>Doc</th>
                <th scope="col" className={th}>Kind</th>
                <th scope="col" className={th}>Bucket</th>
                <th scope="col" className={`${th} text-right`}>Times</th>
              </tr>
            </thead>
            <tbody>
              {a.rows.map((r, i) => (
                <tr key={i} className="border-t border-row-border">
                  <td className={td}>{r.evalset}</td>
                  <td className={td}>{r.doc ?? "—"}</td>
                  <td className={td}>{r.kind}</td>
                  <td className={td}>{r.bucket}</td>
                  <td className={`${td} text-right`}>{r.times ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {rawView}
    </div>
  );
}

/** "Error analysis": the iteration's error-analysis.json, loaded when the sheet opens. */
export function ErrorAnalysisSheet({ iterationId }: { iterationId: string }) {
  const [state, setState] = useState<{ raw: string | null; error: string | null }>({ raw: null, error: null });
  const load = () => {
    if (state.raw) return;
    loadIterationFile(iterationId, "error-analysis.json")
      .then((raw) => setState({ raw, error: null }))
      .catch((e: Error) => setState({ raw: null, error: e.message }));
  };
  return (
    <Sheet onOpenChange={(open) => open && load()}>
      <SheetTrigger render={<Button variant="outline" />}>Error analysis</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl!">
        <SheetHeader>
          <SheetTitle>Error analysis · iteration {iterationId}</SheetTitle>
          <SheetDescription>The recorded error analysis behind this iteration: failures by bucket, root causes and failing cases.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {state.error ? (
            <p role="alert" className="m-0 text-status-red-fg">
              {state.error}
            </p>
          ) : state.raw ? (
            <Analysis raw={state.raw} />
          ) : (
            <p className="m-0 text-muted-foreground">Loading…</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
