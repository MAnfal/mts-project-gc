"use client";

import { useMemo, useReducer, useState } from "react";
import {
  areasNote,
  caresAboutTitle,
  initialState,
  NEW,
  newRunReducer,
  ownersDetail,
  pickerLabel,
  pickerOptions,
  runFor,
  runSummary,
  switchPrompt,
} from "@/lib/runs/new-run";
import { blankProfile, mergeSuggested } from "@/lib/runs/profileForm";
import { requestSuggestions } from "@/lib/runs/suggest-client";
import { lastFullWeeks, scanNote, validateWindow, type Window } from "@/lib/runs/weeks";
import type { CompanyProfile } from "@/lib/types";
import { OwnersTable } from "./OwnersTable";
import { ProfileEditor } from "./ProfileEditor";
import { ProfilePicker } from "./ProfilePicker";
import { StartRunButton } from "./StartRunButton";
import { saveProfile, useSavedProfiles } from "./useRun";
import { WeekPicker, type WeekChoice } from "./WeekPicker";

const newId = () => crypto.randomUUID();

/**
 * The new-run screen's form: profile, week, "What <company> cares about", and the Run bar. Every decision (what Run
 * sends, edits, the switch confirm, labels) comes from src/lib/runs/new-run.ts; this file only renders and wires.
 * `today` is New York's date from the server, so the week buttons match what the server rendered.
 */
export function NewRunForm({ presets, today, maxWindowDays, focusProfile }: { presets: CompanyProfile[]; today: string; maxWindowDays: number; focusProfile: boolean }) {
  const saved = useSavedProfiles();
  const [state, dispatch] = useReducer(newRunReducer, presets, initialState);
  const weeks = useMemo(() => lastFullWeeks(today, 3), [today]);
  const [weekChoice, setWeekChoice] = useState<WeekChoice>(0);
  const [custom, setCustom] = useState<Window>(weeks[0]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const options = pickerOptions(presets, saved);
  const week = weekChoice === "custom" ? custom : weeks[weekChoice];
  const windowError = weekChoice === "custom" ? validateWindow(custom.start, custom.end, maxWindowDays) : null;
  const plan = runFor(state, week);
  const edit = (form: typeof state.form) => dispatch({ type: "edit", form });

  const pick = (value: string) => {
    const profile = value === NEW ? blankProfile(`custom-${newId()}`) : options.find((o) => o.value === value)?.profile;
    if (profile) dispatch({ type: "pick", value, profile });
  };

  const suggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    const r = await requestSuggestions(state.form.summary, (input, init) => fetch(input, init));
    if (r.ok) edit({ ...state.form, areas: mergeSuggested(state.form.areas, r.areas, newId) });
    else setSuggestError(r.message);
    setSuggesting(false);
  };

  return (
    <>
      <div className="grow overflow-y-auto px-4 pt-7 pb-6 sm:px-8 sm:pt-9">
        <div className="mx-auto flex max-w-[720px] flex-col gap-[26px]">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-xl font-semibold text-heading">New triage run</h1>
            <p className="m-0 leading-normal text-muted-foreground">
              Scan a week of federal rules and get back only the ones that affect your company, each with a priority, deadline and owner.
            </p>
          </div>
          <ProfilePicker
            options={options}
            value={state.choice}
            label={pickerLabel(state, presets, saved)}
            detail={ownersDetail(state.form.base)}
            focus={focusProfile}
            onPick={pick}
            confirm={switchPrompt(state)}
            onDiscard={() => dispatch({ type: "discard" })}
            onKeep={() => dispatch({ type: "keep" })}
          />
          <WeekPicker
            weeks={weeks}
            choice={weekChoice}
            custom={custom}
            today={today}
            note={scanNote(week.start, week.end)}
            error={windowError}
            onChoose={setWeekChoice}
            onCustom={setCustom}
          />
          <ProfileEditor
            title={caresAboutTitle(state.form)}
            form={state.form}
            errors={plan.errors}
            onChange={edit}
            owners={
              <OwnersTable
                rows={state.form.areas}
                onChange={(areas) => edit({ ...state.form, areas })}
                onAdd={() => edit({ ...state.form, areas: [...state.form.areas, { rowId: newId(), area: "", covers: "", owner: "" }] })}
                onSuggest={suggest}
                suggesting={suggesting}
                suggestError={suggestError}
                error={plan.errors.areas}
                note={areasNote(state.form)}
              />
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3.5 border-t border-border-subtle px-4 py-3.5 sm:px-8">
        <span className="text-[13px] text-muted-foreground">{runSummary(state.form, week)}</span>
        <StartRunButton
          request={plan.request}
          profile={plan.profile}
          disabled={windowError !== null || state.pending !== null}
          beforeStart={async () => {
            if (plan.save && plan.profile) await saveProfile({ key: plan.savedKey ?? newId(), savedAt: new Date().toISOString(), profile: plan.profile });
          }}
        >
          Run triage
        </StartRunButton>
      </div>
    </>
  );
}
