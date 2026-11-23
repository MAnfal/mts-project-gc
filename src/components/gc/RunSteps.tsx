import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import { stepStatusText, type StepView } from "@/lib/runs/reduce";
import { FailedStep } from "./FailedStep";

/** "466 · 2s": the step's count and how long it took. */
const doneMeta = (s: StepView) => [s.count, s.ms === null ? null : s.ms < 1000 ? "<1s" : `${Math.round(s.ms / 1000)}s`].filter((x) => x !== null).join(" · ");

/**
 * The run's steps as the Running screen shows them (design/HiRunning.dc.html): done, in progress with its sub-items,
 * waiting, or failed with its message, Retry and Edit settings right under it (FailedStep). Finished steps stay as
 * they were. `live` is false once the stream is over, so a step that was cut off stops spinning.
 */
export function RunSteps({ steps, live, onRetry, retrying = false, editHref }: { steps: StepView[]; live: boolean; onRetry?: () => void; retrying?: boolean; editHref?: string }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
      {steps.map((s) => (
        <li key={s.step} className="flex flex-col gap-1.5 py-[7px]">
          <div className={`flex items-start gap-2.5 ${s.state === "waiting" ? "text-caption" : ""}`}>
            <StepIcon state={s.state} live={live} />
            <span className={`min-w-0 ${s.state === "running" && live ? "font-semibold" : ""}`}>
              {s.label} <span className="sr-only">{stepStatusText(s.state, live)}</span>
            </span>
            {s.state === "done" ? <span className="shrink-0 pt-px text-xs text-caption">{doneMeta(s)}</span> : null}
            {s.state === "running" && s.progress.length ? <span className="shrink-0 pt-px text-xs text-caption">{s.progress.at(-1)!.count} so far</span> : null}
          </div>
          {s.state === "running" && s.retry && live ? (
            <p className="m-0 ml-[26px] text-[13px] text-status-orange-fg">
              No answer yet, trying again (attempt {s.retry.attempt} of 3)…
            </p>
          ) : null}
          {s.state === "running" && s.progress.length ? (
            <ul className="m-0 ml-[7px] flex list-none flex-col gap-1.5 border-l border-border-strong py-0.5 pl-[19px] text-muted-foreground">
              {s.progress.slice(-3).map((p) => (
                <li key={p.count} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
                  {p.title}
                </li>
              ))}
            </ul>
          ) : null}
          {s.state === "failed" && s.message ? (
            <div className="ml-[26px]">
              <FailedStep message={s.message} onRetry={onRetry} retrying={retrying} editHref={editHref} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ state, live }: { state: StepView["state"]; live: boolean }) {
  const cls = "mt-px size-4 shrink-0";
  if (state === "done") return <CircleCheck aria-hidden="true" className={`${cls} text-status-green-fg`} />;
  if (state === "failed") return <CircleX aria-hidden="true" className={`${cls} text-destructive`} />;
  if (state === "running" && live) return <LoaderCircle aria-hidden="true" className={`${cls} text-status-blue-fg motion-safe:animate-spin`} />;
  return <CircleDashed aria-hidden="true" className={cls} />;
}
