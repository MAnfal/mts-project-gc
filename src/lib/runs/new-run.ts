// The new-run screen's decisions, kept out of the components so they are tested: which profiles the picker offers,
// what picking one does to unsaved edits, what Run sends, and every sentence the screen derives. Pure, client-safe.
import type { CompanyProfile } from "../types";
import { formErrors, formToProfile, isEdited, profileToForm, type FormErrors, type ProfileForm } from "./profileForm";
import { formatWindow } from "./report";
import type { RunRequest, SavedProfile } from "./types";
import type { Window } from "./weeks";

/** A picker entry's value: `preset:<id>`, `saved:<key>`, or `new`. */
export type Choice = string;
export const NEW: Choice = "new";
const presetChoice = (id: string): Choice => `preset:${id}`;
const savedChoice = (key: string): Choice => `saved:${key}`;

export interface PickerOption {
  value: Choice;
  label: string;
  /** "Preset" for config presets, "Saved" for the GC's own; null for "New company…". */
  badge: "Preset" | "Saved" | null;
  /** The profile picking this entry loads; null for "New company…" (the caller makes a blank one with a fresh id). */
  profile: CompanyProfile | null;
}

/** The configured default preset first (the screen opens on it), the rest in config order. */
export function orderPresets(presets: CompanyProfile[], defaultId: string): CompanyProfile[] {
  const first = presets.find((p) => p.id === defaultId);
  return first ? [first, ...presets.filter((p) => p !== first)] : presets;
}

const nameOf = (p: CompanyProfile) => p.name.trim() || "Unnamed company";

/** Presets, then this browser's saved profiles (newest first, as the store lists them), then "New company…". */
export function pickerOptions(presets: CompanyProfile[], saved: SavedProfile[]): PickerOption[] {
  return [
    ...presets.map((p): PickerOption => ({ value: presetChoice(p.id), label: nameOf(p), badge: "Preset", profile: p })),
    ...saved.map((s): PickerOption => ({ value: savedChoice(s.key), label: nameOf(s.profile), badge: "Saved", profile: s.profile })),
    { value: NEW, label: "New company…", badge: null, profile: null },
  ];
}

export interface NewRunState {
  choice: Choice;
  form: ProfileForm;
  /** A switch the GC asked for while the form had unsaved edits, waiting on "Discard edits" or "Keep editing". */
  pending: { value: Choice; profile: CompanyProfile } | null;
}

export type NewRunAction =
  | { type: "pick"; value: Choice; profile: CompanyProfile }
  | { type: "discard" }
  | { type: "keep" }
  | { type: "edit"; form: ProfileForm };

/** Opens on the first preset (callers order them with `orderPresets`), every field filled from it. */
export function initialState(presets: CompanyProfile[]): NewRunState {
  const first = presets[0];
  if (!first) throw new Error("No preset company is configured.");
  return { choice: presetChoice(first.id), form: profileToForm(first), pending: null };
}

const switchTo = (value: Choice, profile: CompanyProfile): NewRunState => ({ choice: value, form: profileToForm(profile), pending: null });

export function newRunReducer(state: NewRunState, action: NewRunAction): NewRunState {
  switch (action.type) {
    case "pick":
      if (action.value === state.choice) return state;
      // Edits are never dropped silently: ask first.
      if (isEdited(state.form)) return { ...state, pending: { value: action.value, profile: action.profile } };
      return switchTo(action.value, action.profile);
    case "discard":
      return state.pending ? switchTo(state.pending.value, state.pending.profile) : state;
    case "keep":
      return { ...state, pending: null };
    case "edit":
      return { ...state, form: action.form };
  }
}

/** The picker's closed label: the profile's name, with "(edited)" once it differs from what was picked. */
export function pickerLabel(state: NewRunState, presets: CompanyProfile[], saved: SavedProfile[]): string {
  const option = pickerOptions(presets, saved).find((o) => o.value === state.choice);
  if (state.choice === NEW) return state.form.name.trim() || "New company…";
  const name = option ? option.label : nameOf(state.form.base);
  return isEdited(state.form) ? `${name} (edited)` : name;
}

export interface RunPlan {
  /** What Run posts; null while the form has errors. */
  request: RunRequest | null;
  /** The profile saved with the run (a preset as loaded, or the GC's own). */
  profile: CompanyProfile | null;
  errors: FormErrors;
  /** Whether Run also saves the profile under "Company profiles": any profile that isn't an unedited preset. */
  save: boolean;
  /** The saved record a rerun of a saved profile replaces; null to save under a new key. */
  savedKey: string | null;
}

/**
 * What Run does for this state and window. An unedited preset runs by id; anything else (an edited preset, a saved
 * profile, a new company) runs as a custom profile, so the preset's file on the server is never what changes.
 */
export function runFor(state: NewRunState, week: Window): RunPlan {
  const errors = formErrors(state.form);
  const savedKey = state.choice.startsWith("saved:") ? state.choice.slice("saved:".length) : null;
  if (Object.keys(errors).length) return { request: null, profile: null, errors, save: false, savedKey };
  const window = { windowStart: week.start, windowEnd: week.end };
  if (state.choice.startsWith("preset:") && !isEdited(state.form)) {
    return { request: { profileId: state.form.base.id, ...window }, profile: state.form.base, errors, save: false, savedKey };
  }
  const profile = formToProfile(state.form);
  return { request: { customProfile: profile, ...window }, profile, errors, save: true, savedKey };
}

const shortName = (form: ProfileForm) => form.name.trim().split(/\s+/)[0] || null;

/** The bottom bar: "Ledgerly · Nov 16–20". */
export const runSummary = (form: ProfileForm, week: Window) => `${shortName(form) ?? "New company"} · ${formatWindow(week.start, week.end, { year: false })}`;

/** The profile section's heading: "What Ledgerly cares about". */
export const caresAboutTitle = (form: ProfileForm) => `What ${shortName(form) ?? "the company"} cares about`;

/** The picker's detail line: how many distinct people own areas ("6 owners"). */
export function ownersDetail(p: CompanyProfile): string {
  const n = new Set(Object.values(p.areas).map((a) => a.owner.email)).size;
  if (n === 0) return "no owners yet";
  return n === 1 ? "1 owner" : `${n} owners`;
}
