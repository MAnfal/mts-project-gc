// The editable form behind "What <company> cares about", and its mapping to and from a CompanyProfile. Pure and
// client-safe: the browser can't import CompanySchema (src/lib/config.ts is server-only), so the tests check every
// profile built here against it, and the run route parses it again on arrival.
//
// Mapping (the POC's custom-profile mapping, poc:poc/src/app/api/try/route.ts, extended to the owners table):
// - Fields the form doesn't show (id, use, businessLines, generalCounsel) come from the profile it was loaded from.
// - Each owners row is one area: its key is the trimmed area name, "covers" is its description.
// - An owner keeps the email of the person of that name in the loaded profile; anyone new gets a placeholder email
//   (report.ts groups owners and drafts mail by email, so each person needs exactly one); a blank owner is the GC.
// - No areas at all becomes the POC's catch-all `general`, owned by the GC: every item still has an owner, and the
//   pipeline's area enum is never empty.
import type { CompanyProfile, Owner } from "../types";

export interface AreaRow {
  /** Stable key for the row on screen; never sent. */
  rowId: string;
  area: string;
  covers: string;
  owner: string;
}

export interface ProfileForm {
  /** The profile these fields were loaded from. */
  base: CompanyProfile;
  name: string;
  summary: string;
  applies: string[];
  doesNotApply: string[];
  areas: AreaRow[];
}

export type FormErrors = Partial<Record<"name" | "summary" | "areas", string>>;

const GENERAL_COUNSEL: Owner = { name: "You (General Counsel)", email: "gc@example.com" };
/** A reserved test domain (RFC 2606), so a placeholder can never reach a real mailbox. */
const PLACEHOLDER_DOMAIN = "owners.example";

/** "New company…": the POC's defaults for a profile the GC writes from scratch. `id` is uuid-based. */
export const blankProfile = (id: string): CompanyProfile => ({
  id,
  use: "demo",
  name: "",
  summary: "",
  businessLines: [],
  applies: [],
  doesNotApply: [],
  areas: {},
  generalCounsel: { ...GENERAL_COUNSEL },
});

export function profileToForm(p: CompanyProfile): ProfileForm {
  return {
    base: p,
    name: p.name,
    summary: p.summary,
    applies: [...p.applies],
    doesNotApply: [...p.doesNotApply],
    areas: Object.entries(p.areas).map(([key, a], i) => ({ rowId: `${p.id}:${i}`, area: key, covers: a.description, owner: a.owner.name })),
  };
}

const isBlankRow = (r: AreaRow) => !r.area.trim() && !r.covers.trim() && !r.owner.trim();
const filled = (form: ProfileForm) => form.areas.filter((r) => !isBlankRow(r));

/** What stops this form from running, per field, as sentences for the GC. Empty when it can run. */
export function formErrors(form: ProfileForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Give the company a name.";
  if (!form.summary.trim()) errors.summary = "Describe what the company does.";
  const seen = new Set<string>();
  for (const r of filled(form)) {
    const name = r.area.trim();
    if (!name) {
      errors.areas = "Name every area, or remove the rows you don't need.";
      break;
    }
    // Case-insensitive: "Tax" and "tax" would read as one area to the GC and to the model routing items.
    if (seen.has(name.toLowerCase())) {
      errors.areas = `Two areas are named "${name}". Give each area its own name.`;
      break;
    }
    seen.add(name.toLowerCase());
  }
  return errors;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "owner";

/** One email per person: known people keep theirs; a new name gets a placeholder no one else in the profile has. */
function ownerDirectory(base: CompanyProfile) {
  const byName = new Map<string, Owner>();
  for (const o of [...Object.values(base.areas).map((a) => a.owner), base.generalCounsel]) if (!byName.has(o.name)) byName.set(o.name, o);
  const taken = new Set([...byName.values()].map((o) => o.email));
  return (name: string): Owner => {
    const known = byName.get(name);
    if (known) return known;
    const stem = slug(name);
    let email = `${stem}@${PLACEHOLDER_DOMAIN}`;
    for (let i = 2; taken.has(email); i++) email = `${stem}-${i}@${PLACEHOLDER_DOMAIN}`;
    const owner = { name, email };
    byName.set(name, owner);
    taken.add(email);
    return owner;
  };
}

/** The profile a run is sent with. Throws on a form with errors: call `formErrors` first. */
export function formToProfile(form: ProfileForm): CompanyProfile {
  const errors = Object.values(formErrors(form));
  if (errors.length) throw new Error(`The profile can't run yet: ${errors.join(" ")}`);
  const { base } = form;
  const owner = ownerDirectory(base);
  const rows = filled(form);
  const areas: CompanyProfile["areas"] = rows.length
    ? Object.fromEntries(rows.map((r) => [r.area.trim(), { description: r.covers.trim(), owner: r.owner.trim() ? owner(r.owner.trim()) : base.generalCounsel }]))
    : { general: { description: "Everything", owner: base.generalCounsel } };
  const list = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return {
    id: base.id,
    use: base.use,
    name: form.name.trim(),
    summary: form.summary.trim(),
    businessLines: base.businessLines,
    applies: list(form.applies),
    doesNotApply: list(form.doesNotApply),
    areas,
    generalCounsel: base.generalCounsel,
  };
}

/** Structural equality of JSON-like values; key order is ignored and a key holding undefined counts as absent. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = (o: object) => Object.keys(o).filter((k) => (o as Record<string, unknown>)[k] !== undefined).sort();
  const ka = keys(a);
  const kb = keys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** True once the form no longer describes the profile it was loaded from (an unfinished, invalid edit included). */
export function isEdited(form: ProfileForm): boolean {
  if (Object.keys(formErrors(form)).length) return true;
  const p = formToProfile(form);
  // Area order counts too: it is the order the table shows and the prompts list them in.
  return !deepEqual(p, form.base) || Object.keys(p.areas).join("\n") !== Object.keys(form.base.areas).join("\n");
}

/** "Suggest from description": proposed areas appended for review, owner left blank; names already in the table are skipped. */
export function mergeSuggested(rows: AreaRow[], suggested: { id: string; description: string }[], newRowId: () => string): AreaRow[] {
  const have = new Set(rows.map((r) => r.area.trim().toLowerCase()));
  const added: AreaRow[] = [];
  for (const s of suggested) {
    const area = s.id.trim();
    if (!area || have.has(area.toLowerCase())) continue;
    have.add(area.toLowerCase());
    added.push({ rowId: newRowId(), area, covers: s.description.trim(), owner: "" });
  }
  return [...rows, ...added];
}
