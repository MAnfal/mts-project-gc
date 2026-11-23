import type { ReactNode } from "react";
import { lineDiff, type DiffCell } from "@/lib/evals/lineDiff";
import type { LiveSetupView as View, PromptView } from "@/lib/evals/liveSetup";
import type { EvalStory } from "@/lib/evals/story-schema";
import { fillTemplate } from "@/lib/evals/story";
import { cn } from "@/lib/utils";
import { LiveMatch } from "./LiveMatch";

const CELL_CLASS: Record<DiffCell["kind"], string> = {
  same: "",
  removed: "bg-status-red-surface text-status-red-fg",
  added: "bg-status-green-surface text-status-green-fg",
};
const MARK: Record<DiffCell["kind"], string> = { same: " ", removed: "−", added: "+" };

function Cell({ cell }: { cell: DiffCell | null }) {
  if (!cell) return <td className="bg-secondary/60" />;
  return (
    <td data-kind={cell.kind} className={cn("w-1/2 px-2 py-0.5 align-top whitespace-pre-wrap", CELL_CLASS[cell.kind])}>
      <span aria-hidden="true" className="mr-1.5 inline-block w-2 select-none opacity-60">
        {MARK[cell.kind]}
      </span>
      {cell.text}
    </td>
  );
}

/** A prompt the live prompt set overrides: GitHub-style, the default on the left and the live text on the right. */
function PromptDiff({ p, left, right }: { p: PromptView; left: string; right: string }) {
  const rows = lineDiff(p.defaultText ?? "", p.text);
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] table-fixed border-collapse font-mono text-xs leading-relaxed">
        <thead>
          <tr className="bg-secondary text-left font-sans text-[13px]">
            <th className="w-1/2 px-2 py-1.5 font-semibold">{left}</th>
            <th className="w-1/2 px-2 py-1.5 font-semibold">{right}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border-subtle">
              <Cell cell={r.left} />
              <Cell cell={r.right} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Prompt({ p, story, ctx }: { p: PromptView; story: EvalStory["liveSetup"]; ctx: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <code className="text-[13px] font-semibold">{p.name}</code>
        {p.defaultText ? <span className="text-[13px] text-status-green-fg">{fillTemplate(story.overridden, ctx)}</span> : null}
      </div>
      {p.defaultText ? (
        <PromptDiff p={p} left={story.defaultPane} right={fillTemplate(story.livePane, ctx)} />
      ) : (
        <pre className="m-0 overflow-x-auto rounded-md bg-secondary px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">{p.text}</pre>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border-subtle py-2 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-muted-foreground sm:w-[180px]">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}

/**
 * /evals/setup: the configuration every GC run executes today (config/, via liveSetupView), stated as facts, then
 * each stage's prompts in full; a prompt the live prompt set overrides shows side by side with its default. Prose
 * from config/eval-story.yaml → liveSetup, filled from `ctx` (liveSetupContext). Server-safe: LiveMatch is the only
 * client part, and it receives the setup id alone.
 */
export function LiveSetupView({ view, story: full, ctx }: { view: View; story: EvalStory; ctx: Record<string, string> }) {
  const story = full.liveSetup;
  const f = story.facts;
  const labels = Object.fromEntries(Object.entries(full.iterations).map(([id, it]) => [id, it.label]));
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[74ch] text-[15px] leading-relaxed">{fillTemplate(story.intro, ctx)}</p>
        <LiveMatch setupId={view.setup.id} story={story} labels={labels} />
      </div>

      <dl className="m-0 border-b border-border-subtle">
        <Fact label={f.model}>
          {view.model.label} <code className="text-xs text-muted-foreground">{view.model.id}</code>
        </Fact>
        <Fact label={f.method}>{view.method.label}</Fact>
        {view.filter !== "llm" ? (
          <>
            <Fact label={f.screen}>
              <code className="text-xs">{view.jevModel}</code>
            </Fact>
            <Fact label={f.cutoff}>{view.jevThreshold}</Fact>
          </>
        ) : null}
        <Fact label={f.promptSet}>
          <code className="text-xs">{view.promptSet ?? "default"}</code>
        </Fact>
        <Fact label={f.passages}>{view.filterExcerpts ? fillTemplate(story.passages, ctx) : story.noPassages}</Fact>
        <Fact label={f.votes}>{view.filterVotes}</Fact>
        <Fact label={f.webLeads}>{view.webLeads ? "on" : "off"}</Fact>
      </dl>

      <section aria-labelledby="stages-h" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="stages-h" className="m-0 text-lg font-semibold">
            {story.stagesHeading}
          </h2>
          <p className="m-0 text-[13px] text-muted-foreground">{story.placeholders}</p>
        </div>
        {view.stages.map((s, i) => (
          <section key={s.id} aria-labelledby={`stage-${s.id}`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 id={`stage-${s.id}`} className="m-0 text-[15px] font-semibold">
                {i + 1}. {fillTemplate(story.stages[s.id].title, ctx)}
              </h3>
              <p className="m-0 text-muted-foreground">{fillTemplate(story.stages[s.id].text, ctx)}</p>
            </div>
            {s.prompts.map((p) => (
              <Prompt key={p.name} p={p} story={story} ctx={ctx} />
            ))}
          </section>
        ))}
        <section aria-labelledby="stage-code" className="flex flex-col gap-0.5 rounded-lg bg-secondary px-4 py-3">
          <h3 id="stage-code" className="m-0 text-[15px] font-semibold">
            {fillTemplate(story.code.title, ctx)}
          </h3>
          <p className="m-0 text-muted-foreground">{fillTemplate(story.code.text, ctx)}</p>
        </section>
      </section>
    </div>
  );
}
