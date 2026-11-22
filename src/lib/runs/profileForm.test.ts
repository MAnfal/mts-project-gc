import { describe, expect, it } from "vitest";
import { CompanySchema, presets } from "@/lib/config";
import type { CompanyProfile } from "../types";
import { blankProfile, formErrors, formToProfile, isEdited, mergeSuggested, profileToForm, type AreaRow, type ProfileForm } from "./profileForm";

// The real presets from config/companies/, so a round trip is checked against what the picker actually loads.
const ledgerly = () => presets().find((p) => p.id === "ledgerly")!;
const hearth = () => presets().find((p) => p.id === "hearth")!;

let n = 0;
const row = (area: string, covers: string, owner: string): AreaRow => ({ rowId: `r${++n}`, area, covers, owner });
const withAreas = (form: ProfileForm, areas: AreaRow[]): ProfileForm => ({ ...form, areas });

describe("profileToForm → formToProfile", () => {
  it("an unedited preset round-trips deep-equal (ids, owner emails, business lines, general counsel all kept)", () => {
    for (const p of [ledgerly(), hearth()]) expect(formToProfile(profileToForm(p))).toEqual(p);
  });

  it("an edited preset keeps its id, use, businessLines and generalCounsel, and CompanySchema accepts it", () => {
    const base = ledgerly();
    const form = { ...profileToForm(base), summary: "A smaller fintech.", applies: [...profileToForm(base).applies, "State money transmitter licensing"] };
    const p = formToProfile(form);
    expect(CompanySchema.parse(p)).toEqual(p);
    expect(p).toMatchObject({ id: "ledgerly", use: "demo", businessLines: base.businessLines, generalCounsel: base.generalCounsel, summary: "A smaller fintech." });
    expect(p.applies.at(-1)).toBe("State money transmitter licensing");
  });

  it("'New company…' gets the POC defaults: the given uuid id, use demo, no business lines, 'You (General Counsel)'", () => {
    const p = blankProfile("custom-1b2c");
    expect(p).toEqual({
      id: "custom-1b2c",
      use: "demo",
      name: "",
      summary: "",
      businessLines: [],
      applies: [],
      doesNotApply: [],
      areas: {},
      generalCounsel: { name: "You (General Counsel)", email: "gc@example.com" },
    });
  });
});

describe("formToProfile: areas", () => {
  const acme = (): ProfileForm => ({ ...profileToForm(blankProfile("custom-acme")), name: "Acme Widgets", summary: "Makes widgets." });

  it("an empty owners table becomes the single catch-all area 'general', owned by the general counsel", () => {
    const p = formToProfile(acme());
    expect(p.areas).toEqual({ general: { description: "Everything", owner: { name: "You (General Counsel)", email: "gc@example.com" } } });
    expect(CompanySchema.safeParse(p).success).toBe(true);
  });

  it("fully blank rows (an 'Add area' never filled in) are ignored, so they also leave the catch-all", () => {
    expect(Object.keys(formToProfile(withAreas(acme(), [row(" ", "", "")])).areas)).toEqual(["general"]);
  });

  it("one area: the key is the trimmed area name, covers becomes its description", () => {
    const p = formToProfile(withAreas(acme(), [row("  Product safety ", "CPSC recalls", "Ann Lee")]));
    expect(p.areas).toEqual({ "Product safety": { description: "CPSC recalls", owner: { name: "Ann Lee", email: "ann-lee@owners.example" } } });
    expect(CompanySchema.safeParse(p).success).toBe(true);
  });

  it("a blank owner falls back to the general counsel", () => {
    const base = ledgerly();
    const p = formToProfile(withAreas(profileToForm(base), [row("Payments", "Reg E", "  ")]));
    expect(p.areas.Payments.owner).toEqual(base.generalCounsel);
    expect(CompanySchema.safeParse(p).success).toBe(true);
  });

  it("a preset owner keeps their real email, also when moved to another row", () => {
    const p = formToProfile(withAreas(profileToForm(ledgerly()), [row("Wires", "Wire transfers", "Priya Shah (BSA Officer)")]));
    expect(p.areas.Wires.owner).toEqual({ name: "Priya Shah (BSA Officer)", email: "bsa@ledgerly.example" });
  });

  it("a new owner gets one placeholder email, shared by every area they own and distinct from everyone else's", () => {
    const p = formToProfile(withAreas(acme(), [row("A", "", "Ann Lee"), row("B", "", "Bo Chen"), row("C", "", "Ann Lee")]));
    expect(p.areas.A.owner.email).toBe("ann-lee@owners.example");
    expect(p.areas.C.owner.email).toBe(p.areas.A.owner.email);
    expect(p.areas.B.owner.email).toBe("bo-chen@owners.example");
  });

  it("two different people whose names slug alike still get different emails", () => {
    const p = formToProfile(withAreas(acme(), [row("A", "", "Ann Lee"), row("B", "", "Ann-Lee")]));
    expect(p.areas.A.owner.email).toBe("ann-lee@owners.example");
    expect(p.areas.B.owner.email).toBe("ann-lee-2@owners.example");
  });

  it("a name with no letters or digits still gets a usable placeholder", () => {
    expect(formToProfile(withAreas(acme(), [row("A", "", "???")])).areas.A.owner.email).toBe("owner@owners.example");
  });
});

describe("formErrors (block Run, shown inline)", () => {
  const ok = (): ProfileForm => ({ ...profileToForm(blankProfile("custom-x")), name: "Acme", summary: "Makes widgets." });

  it("a valid form has none", () => {
    expect(formErrors(ok())).toEqual({});
    expect(formErrors(profileToForm(ledgerly()))).toEqual({});
  });

  it("two areas with the same trimmed name (any case) are an error, and formToProfile refuses the form", () => {
    const form = withAreas(ok(), [row("Tax", "1099", "Ann"), row(" tax ", "W-2", "Bo")]);
    expect(formErrors(form).areas).toBe('Two areas are named "tax". Give each area its own name.');
    expect(() => formToProfile(form)).toThrow(/Two areas are named/);
  });

  it("a row with covers or an owner but no area name is an error", () => {
    expect(formErrors(withAreas(ok(), [row("", "OFAC", "")])).areas).toBe("Name every area, or remove the rows you don't need.");
  });

  it("a blank company name or description is an error", () => {
    expect(formErrors({ ...ok(), name: "  " }).name).toBe("Give the company a name.");
    expect(formErrors({ ...ok(), summary: "" }).summary).toBe("Describe what the company does.");
  });
});

describe("isEdited", () => {
  it("is false for a preset as loaded, true after any field changes", () => {
    const form = profileToForm(ledgerly());
    expect(isEdited(form)).toBe(false);
    expect(isEdited({ ...form, doesNotApply: form.doesNotApply.slice(1) })).toBe(true);
    expect(isEdited(withAreas(form, form.areas.map((r, i) => (i === 0 ? { ...r, owner: "Someone Else" } : r))))).toBe(true);
  });

  it("is true while the form is invalid (an edit the GC hasn't finished)", () => {
    const form = profileToForm(ledgerly());
    expect(isEdited({ ...form, name: "" })).toBe(true);
  });
});

describe("mergeSuggested", () => {
  it("appends suggested areas with the owner left blank, skipping names already in the table", () => {
    const rows = [row("Tax", "1099", "Ravi")];
    let k = 0;
    const merged = mergeSuggested(rows, [{ id: "tax", description: "dup" }, { id: " Privacy ", description: "GLBA" }, { id: "", description: "no name" }], () => `s${++k}`);
    expect(merged).toEqual([rows[0], { rowId: "s1", area: "Privacy", covers: "GLBA", owner: "" }]);
  });
});

// A profile shaped like the POC's custom one, to check a hand-built CompanyProfile maps too.
const custom: CompanyProfile = {
  id: "custom-9",
  use: "demo",
  name: "Acme",
  summary: "Widgets.",
  businessLines: [],
  applies: ["Product safety"],
  doesNotApply: [],
  areas: { general: { description: "Everything", owner: { name: "You (General Counsel)", email: "gc@example.com" } } },
  generalCounsel: { name: "You (General Counsel)", email: "gc@example.com" },
};

describe("a saved custom profile", () => {
  it("round-trips too, its catch-all area included", () => {
    expect(formToProfile(profileToForm(custom))).toEqual(custom);
  });
});
