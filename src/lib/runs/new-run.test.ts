import { describe, expect, it } from "vitest";
import { presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { NewRunConfigSchema } from "@/lib/config/schemas";
import type { CompanyProfile } from "../types";
import {
  NEW,
  caresAboutTitle,
  initialState,
  newRunReducer,
  orderPresets,
  ownersDetail,
  pickerLabel,
  pickerOptions,
  runFor,
  runSummary,
  switchPrompt,
  areasNote,
  prefillState,
  prefillWeek,
  type NewRunState,
} from "./new-run";
import { blankProfile, profileToForm } from "./profileForm";
import type { SavedProfile } from "./types";

const all = () => orderPresets(presets(), "ledgerly");
const ledgerly = () => all()[0];
const hearth = () => all()[1];
const saved = (key: string, profile: CompanyProfile, savedAt = "2026-11-23T10:00:00.000Z"): SavedProfile => ({ key, savedAt, profile });
const week = { start: "2026-11-16", end: "2026-11-20" };

const edit = (s: NewRunState, change: Partial<NewRunState["form"]>): NewRunState => newRunReducer(s, { type: "edit", form: { ...s.form, ...change } });

describe("orderPresets", () => {
  it("puts the configured default first and keeps the rest in config order", () => {
    expect(orderPresets(presets(), "ledgerly").map((p) => p.id)).toEqual(["ledgerly", "hearth"]);
  });

  it("leaves the order alone when the default is not a preset", () => {
    expect(orderPresets(presets(), "brightside").map((p) => p.id)).toEqual(presets().map((p) => p.id));
  });
});

describe("pickerOptions", () => {
  it("lists the presets, then this browser's saved profiles, then 'New company…'", () => {
    const opts = pickerOptions(all(), [saved("k1", { ...ledgerly(), summary: "edited" })]);
    expect(opts.map((o) => [o.value, o.label, o.badge])).toEqual([
      ["preset:ledgerly", "Ledgerly Inc.", "Preset"],
      ["preset:hearth", "Hearth Home Appliances", "Preset"],
      ["saved:k1", "Ledgerly Inc.", "Saved"],
      ["new", "New company…", null],
    ]);
  });

  it("a saved profile with no name is still listed under a readable label", () => {
    expect(pickerOptions([], [saved("k2", { ...blankProfile("custom-2"), summary: "x" })])[0].label).toBe("Unnamed company");
  });
});

describe("the picker and switching profiles", () => {
  it("starts on the first preset with every field filled from it", () => {
    const s = initialState(all());
    expect(s.choice).toBe("preset:ledgerly");
    expect(s.form).toEqual(profileToForm(ledgerly()));
    expect(pickerLabel(s, all(), [])).toBe("Ledgerly Inc.");
  });

  it("an edited field shows '<Name> (edited)' and Run sends a custom profile, not the preset id", () => {
    const s = edit(initialState(all()), { summary: "A smaller fintech." });
    expect(pickerLabel(s, all(), [])).toBe("Ledgerly Inc. (edited)");
    const run = runFor(s, week);
    expect(run.request).not.toHaveProperty("profileId");
    expect(run.request).toMatchObject({ customProfile: { id: "ledgerly", summary: "A smaller fintech." }, windowStart: "2026-11-16", windowEnd: "2026-11-20" });
    expect(run.save).toBe(true);
  });

  it("an unedited preset runs by its id and is not saved as a profile", () => {
    const run = runFor(initialState(all()), week);
    expect(run.request).toEqual({ profileId: "ledgerly", windowStart: "2026-11-16", windowEnd: "2026-11-20" });
    expect(run.profile).toEqual(ledgerly());
    expect(run.save).toBe(false);
  });

  it("switching with no edits switches at once", () => {
    const s = newRunReducer(initialState(all()), { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(s.choice).toBe("preset:hearth");
    expect(s.form).toEqual(profileToForm(hearth()));
    expect(s.pending).toBeNull();
  });

  it("switching with unsaved edits asks first and changes nothing yet", () => {
    const edited = edit(initialState(all()), { name: "Ledgerly West" });
    const s = newRunReducer(edited, { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(s.pending).toEqual({ value: "preset:hearth", profile: hearth() });
    expect(s.choice).toBe("preset:ledgerly");
    expect(s.form).toBe(edited.form);
  });

  it("'Discard edits' switches to the profile asked for; 'Keep editing' stays with the edits", () => {
    const asking = newRunReducer(edit(initialState(all()), { name: "Ledgerly West" }), { type: "pick", value: "preset:hearth", profile: hearth() });
    const discarded = newRunReducer(asking, { type: "discard" });
    expect(discarded).toMatchObject({ choice: "preset:hearth", pending: null, form: profileToForm(hearth()) });
    const kept = newRunReducer(asking, { type: "keep" });
    expect(kept).toMatchObject({ choice: "preset:ledgerly", pending: null });
    expect(kept.form.name).toBe("Ledgerly West");
  });

  it("'Discard edits' with nothing pending changes nothing", () => {
    const s = initialState(all());
    expect(newRunReducer(s, { type: "discard" })).toBe(s);
  });

  it("picking the profile already shown does nothing, edits included", () => {
    const edited = edit(initialState(all()), { name: "Ledgerly West" });
    expect(newRunReducer(edited, { type: "pick", value: "preset:ledgerly", profile: ledgerly() })).toBe(edited);
  });

  it("a saved profile runs as a custom profile under its own key, so a rerun updates the same saved record", () => {
    const mine = { ...ledgerly(), summary: "edited before" };
    const s = newRunReducer(initialState(all()), { type: "pick", value: "saved:k1", profile: mine });
    expect(pickerLabel(s, all(), [saved("k1", mine)])).toBe("Ledgerly Inc.");
    const run = runFor(s, week);
    expect(run.request).toMatchObject({ customProfile: mine });
    expect(run.savedKey).toBe("k1");
    expect(pickerLabel(edit(s, { summary: "and again" }), all(), [saved("k1", mine)])).toBe("Ledgerly Inc. (edited)");
  });

  it("'New company…' starts blank; Run is blocked until it has a name and a description", () => {
    const s = newRunReducer(initialState(all()), { type: "pick", value: "new", profile: blankProfile("custom-7") });
    expect(pickerLabel(s, all(), [])).toBe("New company…");
    expect(runFor(s, week).errors).toEqual({ name: "Give the company a name.", summary: "Describe what the company does." });
    const filled = edit(s, { name: "Acme", summary: "Widgets." });
    expect(pickerLabel(filled, all(), [])).toBe("Acme");
    expect(runFor(filled, week)).toMatchObject({ errors: {}, save: true, savedKey: null, request: { customProfile: { id: "custom-7", name: "Acme" } } });
  });

  it("an invalid form produces no request", () => {
    const s = edit(initialState(all()), { name: "" });
    expect(runFor(s, week).request).toBeNull();
  });
});

describe("screen text", () => {
  it("the bottom bar summarises company and week; the section title names the company", () => {
    const s = initialState(all());
    expect(runSummary(s.form, week)).toBe("Ledgerly · Nov 16–20");
    expect(runSummary({ ...s.form, name: " " }, week)).toBe("New company · Nov 16–20");
    expect(caresAboutTitle(s.form)).toBe("What Ledgerly cares about");
    expect(caresAboutTitle({ ...s.form, name: "" })).toBe("What the company cares about");
  });

  it("the picker's detail counts distinct owners", () => {
    expect(ownersDetail(ledgerly())).toBe("6 owners");
    expect(ownersDetail(blankProfile("x"))).toBe("no owners yet");
    const one = { ...blankProfile("x"), areas: { a: { description: "", owner: { name: "A", email: "a@x" } }, b: { description: "", owner: { name: "A", email: "a@x" } } } };
    expect(ownersDetail(one)).toBe("1 owner");
  });
});

describe("config/app.yaml → defaultPreset", () => {
  it("is ledgerly, a preset, so the screen opens on it", () => {
    const { defaultPreset } = readYaml("app.yaml", NewRunConfigSchema);
    expect(defaultPreset).toBe("ledgerly");
    expect(presets().map((p) => p.id)).toContain(defaultPreset);
  });

  it("rejects an empty value", () => {
    expect(NewRunConfigSchema.safeParse({ defaultPreset: "" }).success).toBe(false);
  });
});

describe("initialState with no presets", () => {
  it("refuses, rather than opening on an empty form the GC can't run", () => {
    expect(() => initialState([])).toThrow("No preset company is configured.");
  });
});

describe("switchPrompt (the inline confirm's sentence)", () => {
  it("names the edited profile and the one asked for", () => {
    const asking = newRunReducer(edit(initialState(all()), { summary: "x" }), { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(switchPrompt(asking)).toBe("You've edited Ledgerly Inc. Switch to Hearth Home Appliances and lose those edits?");
  });

  it("calls a nameless new company 'this profile' and the blank target 'a new company'", () => {
    const blank = newRunReducer(initialState(all()), { type: "pick", value: "new", profile: blankProfile("custom-1") });
    const asking = newRunReducer(edit(blank, { summary: "draft" }), { type: "pick", value: "new", profile: blankProfile("custom-2") });
    expect(asking.pending).toBeNull(); // already on "New company…": picking it again does nothing
    const toPreset = newRunReducer(edit(blank, { summary: "draft" }), { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(switchPrompt(toPreset)).toBe("You've edited this profile. Switch to Hearth Home Appliances and lose those edits?");
    const toNew = newRunReducer(edit(initialState(all()), { summary: "x" }), { type: "pick", value: "new", profile: blankProfile("custom-3") });
    expect(switchPrompt(toNew)).toBe("You've edited Ledgerly Inc. Switch to a new company and lose those edits?");
  });

  it("is null when nothing is pending", () => {
    expect(switchPrompt(initialState(all()))).toBeNull();
  });
});

describe("areasNote (under the owners table)", () => {
  it("with no areas, says every item goes to the general counsel", () => {
    const s = initialState(all());
    expect(areasNote({ ...s.form, areas: [] })).toBe("No areas yet, so every item goes to Jordan Blake, the general counsel.");
    expect(areasNote(profileToForm(blankProfile("x")))).toBe("No areas yet, so every item goes to you, the general counsel.");
  });

  it("with areas, says where items outside them go", () => {
    expect(areasNote(initialState(all()).form)).toBe("Items outside these areas go to Jordan Blake, the general counsel.");
  });
});

describe("an untouched 'New company…'", () => {
  it("has no edits to lose: picking a preset next switches at once", () => {
    const blank = newRunReducer(initialState(all()), { type: "pick", value: "new", profile: blankProfile("custom-9") });
    const s = newRunReducer(blank, { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(s.pending).toBeNull();
    expect(s.choice).toBe("preset:hearth");
  });
});

// Amendment 6: "Edit settings" on a failed run opens /runs/new?from=<runId>, filled from that run as IndexedDB holds
// it ({request, profile}). Profiles are the real presets; the stored runs are constructed the way the runner saves them.
describe("prefillState: the form filled from a stored run", () => {
  const window = { windowStart: "2026-11-02", windowEnd: "2026-11-06" };
  const weekOf = { start: "2026-11-02", end: "2026-11-06" };

  it("a preset run reopens on that preset, unedited, and Run sends the same request", () => {
    const s = prefillState(all(), [], { request: { profileId: "hearth", ...window }, profile: hearth() });
    expect(s.choice).toBe("preset:hearth");
    expect(pickerLabel(s, all(), [])).toBe(hearth().name);
    expect(runFor(s, weekOf).request).toEqual({ profileId: "hearth", ...window });
  });

  it("an edited preset reopens on that preset marked edited, and Run sends the run's own profile", () => {
    const edited = { ...ledgerly(), summary: "Only crypto custody now." };
    const s = prefillState(all(), [], { request: { customProfile: edited, ...window }, profile: edited });
    expect(s.choice).toBe("preset:ledgerly");
    expect(pickerLabel(s, all(), [])).toBe(`${ledgerly().name} (edited)`);
    expect(runFor(s, weekOf).request).toEqual({ customProfile: edited, ...window });
  });

  it("a saved profile's run reopens on that saved profile, and a rerun replaces it rather than saving a copy", () => {
    const mine = { ...blankProfile("custom-1"), name: "SmileBright Dental", summary: "Dental clinics." };
    const list = [saved("k1", mine)];
    const s = prefillState(all(), list, { request: { customProfile: mine, ...window }, profile: mine });
    expect(s.choice).toBe("saved:k1");
    expect(runFor(s, weekOf)).toMatchObject({ request: { customProfile: mine, ...window }, savedKey: "k1" });
  });

  it("a company this browser no longer has reopens as a new company with the run's fields", () => {
    // As the form saves one (formToProfile): a profile with no areas gets the catch-all area owned by the GC.
    const blank = blankProfile("custom-9");
    const gone = { ...blank, name: "Gone Co", summary: "Sells things.", areas: { general: { description: "Everything", owner: blank.generalCounsel } } };
    const s = prefillState(all(), [], { request: { customProfile: gone, ...window }, profile: gone });
    expect(s.choice).toBe(NEW);
    expect(s.form.name).toBe("Gone Co");
    expect(runFor(s, weekOf).request).toEqual({ customProfile: gone, ...window });
  });

  it("a preset run whose preset was removed from config reopens as a new company with the run's profile", () => {
    const removed = { ...hearth(), id: "oldpreset", name: "Old Preset Co" };
    const s = prefillState(all(), [], { request: { profileId: "oldpreset", ...window }, profile: removed });
    expect(s.choice).toBe(NEW);
    expect(runFor(s, weekOf).request).toEqual({ customProfile: removed, ...window });
  });

  it("the reducer's load action replaces the whole state, pending switch included", () => {
    const pending = newRunReducer(edit(initialState(all()), { summary: "changed" }), { type: "pick", value: "preset:hearth", profile: hearth() });
    expect(pending.pending).not.toBeNull();
    const next = prefillState(all(), [], { request: { profileId: "hearth", ...window }, profile: hearth() });
    expect(newRunReducer(pending, { type: "load", state: next })).toBe(next);
  });
});

describe("prefillWeek", () => {
  const weeks = [
    { start: "2026-11-16", end: "2026-11-20" },
    { start: "2026-11-09", end: "2026-11-13" },
    { start: "2026-11-02", end: "2026-11-06" },
  ];

  it("selects the week button that matches the run's window", () => {
    expect(prefillWeek(weeks, { windowStart: "2026-11-09", windowEnd: "2026-11-13" })).toEqual({ choice: 1, custom: weeks[1] });
  });

  it("selects custom dates for a window no button covers", () => {
    expect(prefillWeek(weeks, { windowStart: "2026-10-19", windowEnd: "2026-10-23" })).toEqual({ choice: "custom", custom: { start: "2026-10-19", end: "2026-10-23" } });
    expect(prefillWeek(weeks, { windowStart: "2026-11-09", windowEnd: "2026-11-12" })).toEqual({ choice: "custom", custom: { start: "2026-11-09", end: "2026-11-12" } });
  });
});
