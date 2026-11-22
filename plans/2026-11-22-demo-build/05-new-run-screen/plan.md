---
chunk: 05
title: New-run screen with presets, profile and owners editor, week picker
branch: feat/demo-build--new-run-screen
base: feat/plan--demo-build
execution: sequential
depends: [04]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 05 — New-run screen

## Context

Chunk 04 starts a run from a single hard-coded button. This chunk builds the real
**New run** screen from `design/HiSettings.dc.html`, in GC AI's automation-form pattern:

- **Company profile picker.** A building icon, with a "Preset" badge on preset entries.
- **Week to scan.** Toggle buttons for the last three full Mon–Fri weeks, plus a Custom
  date range. A stone-coloured note underneath reads "Scans every federal document
  published …".
- **Collapsible "What <company> cares about".** Contains:
  - the description;
  - In scope / Out of scope chips you can add and remove;
  - the **Who owns what** table: Area | Covers | Owner, with remove buttons, "Add area"
    and "Suggest from description".
- **Bottom bar.** A summary of the choices and the navy **Run triage** button.

User decisions this screen must honour:

- Presets come only from `use: demo` companies (`presets()` from chunk 02); the eval
  companies never appear.
- Picking a preset fills every field. Editing any field turns it into the user's own
  profile. The preset's YAML on the server never changes.
- Switching preset after edits asks first. Use an inline confirm, not `window.confirm`.
- Edited profiles are saved in IndexedDB, so "Company profiles" lists them for reuse.
  Add a `profiles` store next to chunk 04's `runs` store in `src/lib/runs/store.ts`.
- The week window is per run, never part of the profile. Its maximum is `maxWindowDays`
  from `config/app.yaml`.

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunk 04 actually merged. Where the text
below conflicts with these points, these win:

1. **Gates.** Write `plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` and commit
   it. It runs:
   - `bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh`, which includes 03's
     gates, parity and no-fs-writes;
   - `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`;
   - `bash scripts/verify-eval-bundle.sh`;
   - this chunk's own checks.

   Servers are keyless (`AI_GATEWAY_API_KEY=` empty), use `./node_modules/.bin/next
   start` with a `trap` and an lsof check as 04's gates do, and take ports 3501–3509 via
   `PORT`. Gate 3 (parity) is dropped, because 03's gates already run it.
2. **Empty areas.** `formToProfile` maps an empty owners table to the POC's single
   catch-all area `general`, owned by the general counsel. Every item still routes to
   the GC, and `stages.ts` never receives an empty enum.
3. **Unexposed profile fields.** An edited preset carries over `id`, `use`,
   `businessLines` and `generalCounsel` unchanged. "New company…" gets the POC defaults:
   - a uuid-based `id`;
   - `use: demo`;
   - `businessLines: []`;
   - general counsel "You (General Counsel)".

   An unedited preset must round-trip deep-equal; test it.
4. **Owner emails.** `report.ts` groups owners and builds mailto links by email.
   - Preset rows keep their real emails.
   - A new row gets a placeholder slugged from the owner name, unique per person.
   - A blank owner falls back to `generalCounsel`.
   - Do not loosen `CompanySchema`.
5. **Area keys.** The key is the trimmed area name. Duplicate names show an inline error
   and block Run; cover this with a constructed-input test. In the Test Plan, read the
   empty-areas input as form rows `[]` → profile `areas` `{general: …}` (amendment 2).
6. **maxWindowDays.** `config/app.yaml` wins (route.ts already reads it).
   `experiment.yaml` stays byte-identical. The server page passes the value as a prop.
   The client's window check uses the same inclusive count as `request.ts`: share one
   helper, or pin both at the boundary with tests.
7. **DEMO_RUN.** Remove the hard-coded demo run: delete `demo.ts` and update every
   importer, including `src/app/runs/[id]/page.tsx`. Run reuses `StartRunButton`/
   `startRun`; add a `disabled` prop for an invalid window.
8. **Sidebar.** Add `GcSidebar` to T006. Links:
   - New run → `/runs/new`;
   - Company profiles → `/runs/new` with the profile picker focused;
   - All runs stays at `/#recent-runs`.
9. **Store.** Bump `store.ts` to version 2. `onupgradeneeded` creates a store only if
   `objectStoreNames` lacks it. Profiles get the same memory fallback. Add a v1→v2 test
   that keeps the existing runs.
10. **suggest-areas seams.**
    - Reuse `languageModel` and `setModelsForTests` (gateway.ts), `render()`
      (config.ts) and `withRetry` with `maxRetries: 0`, as in context.ts.
    - Tests pass a zero-delay retry policy.
    - Prompt building lives in a sibling module.
    - A missing key becomes a plain message, with no env-var name and no model name.
    - The gate curls it keyless to prove there's no spend.
11. **No `/api/presets` route.** `/runs/new` is a server page that passes `presets()` as
    props (KISS). Replace T003 with a gate that greps the `/runs/new` HTML: it must hold no
    eval company id (brightside, cornercare, skyhop) and must contain `ledgerly`.
12. **Weeks.** A week counts as full once its Friday is before "today". The server passes
    today's date computed in America/New_York (the Federal Register's timezone) as a
    prop, so there's no hydration mismatch.
13. **shadcn.** Run `pnpm exec shadcn add select popover input textarea` (+ `command` if
    you choose it), and add a Stack row.
14. **Cost note.** Drop the design's typed "about $0.20", or source it from `setups.yaml`
    `estUsd` for the live setup.
15. **No spend.** The implementer and the reviewer never call the Gateway with a real key.

## Acceptance Criteria

- Given the screen, When it loads, Then the profile picker lists exactly the demo presets
  (Ledgerly, Hearth) plus any saved profiles plus "New company…". The first preset is
  selected and its fields are filled.
- Given I edit any profile field, When I look at the picker, Then it shows
  "<Name> (edited)", and Run sends a custom profile, not the preset id.
- Given I switch preset with unsaved edits, Then an inline confirm offers "Discard edits"
  or "Keep editing".
- Given the week buttons, Then they show the last three full Mon–Fri weeks relative to
  today, with the newest selected. "Custom" shows two date inputs, and any range longer
  than `maxWindowDays` or reversed shows an inline error and disables Run.
- Given an owners table with no areas, When I run, Then the run still starts, and every
  item routes to the GC. Say so under the table.
- Given "Suggest from description", When pressed, Then the server returns a proposed
  areas list (area, covers, owner left blank for the user). It is filled into the table
  for review and never auto-run. The model and prompt come from config.
- Given Run, Then the browser navigates to `/runs/<id>` and chunk 04's screens take over.
- At 390 px width, Then the panes stack and nothing scrolls sideways.

## What To Do

### Tasks

- [ ] T001 — write failing tests:
  - `src/lib/runs/weeks.test.ts`: `lastFullWeeks(today, 3)` returns Mon–Fri windows. Use
    constructed dates: a Monday, a Saturday, a Sunday, and Jan 1 crossing a year.
  - `src/lib/runs/profileForm.test.ts`: `formToProfile(form)` produces a value that
    `CompanySchema` (chunk 02) accepts, with an empty areas table, with one area, and with
    a blank owner.
  - `src/app/api/suggest-areas/route.test.ts`: 400 on an empty description.
- [ ] T002 — create `src/lib/runs/weeks.ts` and `src/lib/runs/profileForm.ts`, as pure
  functions.
- [ ] T003 — ~~create `src/app/api/presets/route.ts`~~. `/runs/new` passes `presets()` as
  props instead (amendment 11).
- [ ] T004 — create `src/app/api/suggest-areas/route.ts`:
  - `POST {description}` → `generateText` with structured output →
    `{areas:[{id,description}]}`;
  - the model ID and prompt come from config. Add `suggestAreas: {model, prompt}` to
    `config/app.yaml` and its schema. Do **not** add it to `config/prompts.yaml` or
    `config/experiment.yaml`: both are on the decision path and must stay byte-identical
    to the POC;
  - wrap the call in chunk 03's `withRetry`.
- [ ] T005 — create `src/components/gc/ProfilePicker.tsx`, `WeekPicker.tsx`,
  `ProfileEditor.tsx` and `OwnersTable.tsx`, using shadcn `Select`/`Popover`, `Button`,
  `Input`, `Textarea`, `Table` and `Collapsible`. Every control has a `<label>`, and every
  icon-only button has an `aria-label` that names its area.
- [ ] T006 — create `src/app/runs/new/page.tsx`, which composes the above in `AppShell`
  with `GcSidebar`. Edit `GcSidebar` links (amendment 8) and remove `DEMO_RUN` (amendment 7). Edit `src/app/page.tsx` to redirect to `/runs/new`, replacing chunk
  04's hard-coded button.
- [ ] T007 — edit `src/lib/runs/store.ts`: add the `profiles` store (save, list, get), and
  add tests for it in `store.test.ts`.

Judgement calls (explain each in the report):

- `CompanySchema` requires an owner email. See amendment 4 for the rule. Do not loosen the schema in
  `src/lib/config.ts`, because it is on the decision path.
- The profile picker may be a shadcn `Select` or a `Popover` + `Command` list.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `weeks.test.ts` | week toggles | a naive `today - 7` gives a Sun–Sat or partial week |
| `profileForm.test.ts` | edited form is a valid profile | a direct object copy misses `generalCounsel`/`areas` shape and `CompanySchema` rejects it |
| `suggest-areas/route.test.ts` | input guard | a route that forwards an empty description to the model returns 200 |
| `store.test.ts` › profiles | saved profiles list | without the store, `listProfiles()` is undefined |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| window length | 8 days | `weeks.test.ts` (a `validateWindow` helper) |
| year boundary | today = 2027-01-02 | `weeks.test.ts` |
| empty areas | `areas: []` | `profileForm.test.ts` |

## Reuse Audit

Reuse: chunk 02's `presets()` and `CompanySchema`; chunk 03's `withRetry`; chunk 04's
store, `GcSidebar` and run start in `useRun`. The POC's `TryForm.tsx` (`git show
poc:poc/src/components/TryForm.tsx`) shows the custom-profile field mapping; reuse its
mapping, not its UI. New: week helpers and the suggest-areas route.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiSettings.dc.html` | The screen to build |
| `plans/2026-11-22-demo-build/design/gcai-ui-notes.md` | Automation-form pattern: toggle buttons, stone note, bottom bar |
| `.claude/resources/bibles/swe/testing.md` | Constructed inputs for each guard |
| `git show poc:poc/src/app/api/try/route.ts` | How the POC built a custom `CompanySchema` profile |

## External Dependencies

- `ai` v7 structured output via the Gateway, for "Suggest from description". This is one
  call and doesn't touch the pipeline.

## Verification Gates

Per amendment 1, these live in `05-new-run-screen/gates.sh`. Gate 2 greps the `/runs/new`
HTML (amendment 11) from a keyless server on `PORT` (3501–3509):

```bash
set -e
bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh
bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh
bash scripts/verify-eval-bundle.sh

# Gate 2: eval companies never offered as presets (keyless server, trap-killed)
body=$(curl -s localhost:$PORT/runs/new)
for id in brightside cornercare skyhop; do
  if echo "$body" | grep -q "\"$id\""; then echo "FAIL: eval company $id offered" >&2; exit 1; fi; done
echo "$body" | grep -q '"ledgerly"' || { echo "FAIL: ledgerly missing" >&2; exit 1; }

# (Gate 3 dropped: 04's gates already run parity.sh; amendment 1)
```

## Deliverables

- [ ] `completion-report.md`, committed, with screenshots: preset filled, edited state,
      switch-confirm, custom-week error, and 390 px width.

## Artifacts Checklist

- ☐ New tests
- ☐ Existing tests updated (`store.test.ts`)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout; Conventions: UI-only config,
  including UI-only prompts, lives in `config/app.yaml`, never in a decision-path file)
