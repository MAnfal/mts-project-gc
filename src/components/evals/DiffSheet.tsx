"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { loadIterationFile, type IterationFile } from "@/lib/evals/loader";
import { cn } from "@/lib/utils";

const TITLE: Partial<Record<IterationFile, string>> = {
  "config.diff": "Config change (config.diff)",
  "system.diff": "Effective system change (system.diff)",
};

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) return "text-caption";
  if (line.startsWith("@@")) return "bg-status-blue-surface text-status-blue-fg";
  if (line.startsWith("+")) return "bg-status-green-surface text-status-green-fg";
  if (line.startsWith("-")) return "bg-status-red-surface text-status-red-fg";
  return "";
}

/** A unified diff, one coloured line each; scrolls inside its own box. */
function Diff({ text }: { text: string }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-md border border-border bg-background py-2 text-xs leading-5">
      {text.split("\n").map((line, i) => (
        <span key={i} className={cn("block px-3 whitespace-pre", lineClass(line))}>
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

/**
 * "Config diff": the iteration's config.diff and system.diff (as shipped in public/evals/iterations/<id>/),
 * loaded when the sheet opens. Only files the index says exist are offered.
 */
export function DiffSheet({ iterationId, files }: { iterationId: string; files: IterationFile[] }) {
  const [state, setState] = useState<{ texts: [IterationFile, string][] | null; error: string | null }>({ texts: null, error: null });
  const load = () => {
    if (state.texts) return;
    Promise.all(files.map(async (f) => [f, await loadIterationFile(iterationId, f)] as [IterationFile, string]))
      .then((texts) => setState({ texts, error: null }))
      .catch((e: Error) => setState({ texts: null, error: e.message }));
  };
  return (
    <Sheet onOpenChange={(open) => open && load()}>
      <SheetTrigger render={<Button variant="outline" />}>Config diff</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl!">
        <SheetHeader>
          <SheetTitle>Config diff · iteration {iterationId}</SheetTitle>
          <SheetDescription>What changed against the previous iteration, as recorded.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          {state.error ? (
            <p role="alert" className="m-0 text-status-red-fg">
              {state.error}
            </p>
          ) : !state.texts ? (
            <p className="m-0 text-muted-foreground">Loading…</p>
          ) : (
            state.texts.map(([f, text]) => (
              <section key={f} className="flex flex-col gap-2">
                <h3 className="m-0 text-sm font-semibold">{TITLE[f] ?? f}</h3>
                <Diff text={text} />
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
