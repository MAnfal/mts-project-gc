"use client";

import { CalendarDays, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { weekLabel, type Window } from "@/lib/runs/weeks";

/** Which window is chosen: one of the offered weeks (by index, newest first) or a custom range. */
export type WeekChoice = number | "custom";

const toggle =
  "inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const on = "border-border-strong bg-secondary font-semibold";
const off = "border-border bg-card hover:bg-background";

/**
 * "Week to scan": toggle buttons for the last full Mon–Fri weeks, plus Custom with two date inputs. `note` is the stone
 * note under the buttons; `error` replaces it while the custom range can't run.
 */
export function WeekPicker({
  weeks,
  choice,
  custom,
  today,
  note,
  error,
  onChoose,
  onCustom,
}: {
  weeks: Window[];
  choice: WeekChoice;
  custom: Window;
  /** YYYY-MM-DD in New York: the latest date a custom range may reach. */
  today: string;
  note: string;
  error: string | null;
  onChoose: (c: WeekChoice) => void;
  onCustom: (w: Window) => void;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2 p-0 font-medium">Week to scan</legend>
      <div className="flex flex-wrap gap-2">
        {weeks.map((w, i) => (
          <button key={w.start} type="button" aria-pressed={choice === i} onClick={() => onChoose(i)} className={cn(toggle, choice === i ? on : off)}>
            {weekLabel(w, i)}
          </button>
        ))}
        <button type="button" aria-pressed={choice === "custom"} onClick={() => onChoose("custom")} className={cn(toggle, choice === "custom" ? on : off)}>
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Custom
        </button>
      </div>
      {choice === "custom" ? (
        <div className="flex flex-wrap gap-3">
          {(["start", "end"] as const).map((k) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`window-${k}`} className="text-[13px] font-medium">
                {k === "start" ? "From" : "To"}
              </label>
              <Input
                id={`window-${k}`}
                type="date"
                max={today}
                value={custom[k]}
                aria-invalid={error ? true : undefined}
                aria-describedby="window-note"
                onChange={(e) => onCustom({ ...custom, [k]: e.target.value })}
                className="h-[34px] w-44 rounded-md bg-card"
              />
            </div>
          ))}
        </div>
      ) : null}
      <div
        id="window-note"
        role={error ? "alert" : "note"}
        className={cn(
          "flex items-start gap-2 rounded-md px-3 py-2.5 text-[13px]",
          error ? "bg-status-red-surface text-status-red-fg" : "bg-secondary text-status-neutral-fg",
        )}
      >
        <Info aria-hidden="true" className="mt-px size-[15px] shrink-0" />
        <span>{error ?? note}</span>
      </div>
    </fieldset>
  );
}
