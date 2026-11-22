# Chunk 05 — Completion Report

Branch `feat/demo-build--new-run-screen`, base `a7fbf1c` (`git merge-base HEAD feat/plan--demo-build`).
Evidence files sit under the scratch directory
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-05/`
(written `$S/` below). No Gateway call was made with a real key at any point. Every server ran with
`AI_GATEWAY_API_KEY=` empty, and every model in the tests is the AI SDK's `MockLanguageModelV4`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/runs/weeks.ts` (+ test) | created | `lastFullWeeks` (a week is full once its Friday is before today), `windowDays` (inclusive), `validateWindow`, `todayInNewYork`, `weekLabel`, `scanNote`. Pure, client-safe. |
| `src/app/api/run/request.ts` | edited | Uses `validateWindow` for the day count, so the screen and the route share one helper (amendment 6). Messages unchanged; 04's tests pass as they were. |
| `src/lib/runs/profileForm.ts` (+ test) | created | Form ⇄ `CompanyProfile`. The area key is the trimmed name; an empty table becomes `general`, owned by the GC. Also: owner emails, `formErrors`, `isEdited` (an untouched form is never edited), `blankProfile` (POC defaults), `mergeSuggested`. |
| `src/lib/runs/new-run.ts` (+ test) | created | The screen's decisions: `orderPresets`, `pickerOptions`, the pick / discard / keep reducer, `pickerLabel` ("(edited)") and `runFor` (what Run sends, and whether to save the profile). Also every sentence on the screen: `runSummary`, `caresAboutTitle`, `ownersDetail`, `switchPrompt`, `areasNote`. |
| `src/lib/runs/suggest-client.ts` (+ test) | created | The browser's suggest-areas request with an injected `fetch`. A plain-text refusal is shown as sent. Any other failure becomes one fixed sentence: an HTML error page, an empty body, a network error, or a 200 without an `areas` list. |
| `src/lib/runs/types.ts` | edited | `SavedProfile {key, savedAt, profile}`. |
| `src/lib/runs/store.ts` (+ test) | edited | Version 2. `onupgradeneeded` creates only missing stores. New `profiles` store with `saveProfile` / `getProfile` / `listProfiles` and the same memory fallback. |
| `src/lib/runs/report.ts` | edited | `stop` exported, reused for "Ledgerly Inc." at a sentence end. |
| `src/lib/config/schemas.ts` | edited | `NewRunConfigSchema {defaultPreset}`, `SuggestAreasConfigSchema {suggestAreas: {model, prompt ∋ {{description}}}}`. |
| `config/app.yaml` | edited | `defaultPreset: ledgerly`. `suggestAreas.model` is the live setup's model id, taken from `setups.yaml`; `suggestAreas.prompt` is the template. |
| `src/app/api/suggest-areas/route.ts`, `suggest.ts` (+ tests) | created | `POST {description}` → `{areas:[{id, description}]}`. `route.ts` is wiring and fixed failure sentences. `suggest.ts` holds the body guard (empty, or over 4000 characters) and `render()` of the configured prompt. It makes one `generateText` + `Output.object` call through `withRetry` with `maxRetries: 0`, and resolves the model before the retry loop. |
| `src/app/runs/new/page.tsx` | created | Server page. Props: `presets()` ordered by `defaultPreset`, `maxWindowDays`, New York's date and `?focus=profile`. |
| `src/app/page.tsx` | edited | Redirects to `/runs/new`. |
| `src/app/runs/[id]/page.tsx` | edited | The sidebar user comes from `defaultPreset` instead of `DEMO_RUN`. |
| `src/lib/runs/demo.ts` | deleted | Amendment 7. |
| `src/components/gc/NewRunForm.tsx`, `ProfilePicker.tsx`, `WeekPicker.tsx`, `ProfileEditor.tsx`, `OwnersTable.tsx` | created | Render and wire only. |
| `src/components/gc/StartRunButton.tsx` | edited | `disabled` and `beforeStart` props. `request` and `profile` may be null, which disables the button. |
| `src/components/gc/useRun.ts` | edited | `useSavedProfiles()` and `saveProfile()` over the runner's store. |
| `src/components/gc/GcSidebar.tsx` | edited | New run → `/runs/new`. Company profiles → `/runs/new?focus=profile`. All runs unchanged. |
| `src/components/ui/{select,popover,input,textarea}.tsx` | created | `pnpm exec shadcn add select popover input textarea` (shadcn 4.23.0), unedited. |
| `plans/.../05-new-run-screen/gates.sh` | created | This chunk's gates (below). |
| `.claude/resources/project.md` | edited | See "project.md" below. |

## Acceptance criteria

The quoted values come from the captured files listed in the self-check table.

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Picker lists exactly the demo presets (Ledgerly, Hearth), then saved profiles, then "New company…"; the first preset is selected and filled | yes | `new-run.test.ts` › "lists the presets, then this browser's saved profiles, then 'New company…'" and "starts on the first preset with every field filled from it"; the `orderPresets` tests; gate 2. Live, in a fresh browser context: before any run the options were `["Ledgerly Inc.Preset","Hearth Home AppliancesPreset","New company…"]` (`$S/evidence/pick-hearth.json`); after one run they were `[… ,"Hearth Home AppliancesSaved","New company…"]` (`saved-listed.json`). Screens `01`, `08`. |
| Editing any field shows "<Name> (edited)", and Run sends a custom profile rather than the preset id | yes | `new-run.test.ts` › "an edited field shows '<Name> (edited)' and Run sends a custom profile, not the preset id". Live trigger text `"Ledgerly Inc. (edited) · 6 owners…"` (`edited.json`). The stored run's request keys were `["customProfile","windowStart","windowEnd"]` (`run-and-indexeddb.json`). The preset YAML is untouched: `parity: OK` (`$S/gates-head-final.txt`). Screen `02`. |
| Switching preset after edits asks inline: "Discard edits" or "Keep editing" | yes | The reducer tests and the `switchPrompt` tests. Live: alert text "You've edited Ledgerly Inc. Switch to Hearth Home Appliances and lose those edits?", buttons `["Keep editing","Discard edits"]`, Run disabled while it waits (`switch-confirm.json`). No `window.confirm` is used. Screen `03`. |
| Week buttons show the last three full Mon–Fri weeks, newest selected; Custom shows two date inputs; a range over `maxWindowDays` or reversed shows an inline error and disables Run | yes | `weeks.test.ts` covers a Monday, a Saturday, a Sunday, a Friday and Jan 2, 2027; the `validateWindow` tests cover 7 and 8 days. Live (`custom-window.json`), with the alert role and Run state for each range: <br>• 9 days → "Pick a window of at most 7 days." (`role: alert`, Run disabled) <br>• reversed → "The window ends before it starts." (disabled) <br>• 7 days → the note again, Run enabled. <br>The buttons were `["Last full week · Nov 16–20 [pressed]","Nov 9–13","Nov 2–6","Custom"]` (`console.json`). Screen `04`. |
| With no areas, the run still starts, every item routes to the GC, and the screen says so under the table | yes | `profileForm.test.ts` › "an empty owners table becomes the single catch-all area 'general'…"; the `areasNote` tests. Live (`empty-areas.json`): 0 rows, note "No areas yet, so every item goes to Robert Chen, the general counsel.". Run then navigated to `/runs/dbf87ac7-…`, and the stored `customProfile.areas` was `{"general":{"description":"Everything","owner":{"name":"Robert Chen (General Counsel)","email":"gc@hearth.example"}}}` (`run-and-indexeddb.json`). The keyless run then failed at the ranking step, as designed, with no spend. Screen `07`. |
| "Suggest from description" returns proposed areas with the owner blank; they fill the table for review and nothing runs on its own; model and prompt come from config | yes, **stubbed models only** | `suggest.test.ts`: config parse; the rendered prompt and the configured model id reach the model; output cleaning. `suggest-client.test.ts` covers all six outcomes; `mergeSuggested` leaves the owner `""`; a route test returns 200 with a mock model. Live keyless: `suggestError` read "Suggestions aren't available right now. …" (`empty-areas.json`). **No real model call was ever made**, so what the prompt produces in practice is unverified. |
| Run navigates to `/runs/<id>` and chunk 04's screens take over | yes | `run-and-indexeddb.json`: `path` `/runs/dbf87ac7-38f3-43dc-a69f-8c368a144bcb`; the screen begins "Hearth · Nov 2–6, 2026 … The run stopped before it finished.", which is 04's Failed view. |
| At 390 px the panes stack and nothing scrolls sideways | yes | `390.json`: `scrollWidth 390`, `clientWidth 390`, `elementsPastRightEdge 0`, `panesStacked true`. The same probe with a 600 px canary gave `scrollWidth 608`, `elementsPastRightEdge 1` (`390-canary.json`). Screen `05`. |
| Hydration: server-passed "today" causes no mismatch (amendment 12) | yes | `/runs/new` was loaded with an init script that records `console.error`, `console.warn` and window `error` events: `consoleErrorsAndWarnings: []` (`console.json`). The same hook captured a deliberate `console.error` (`console-hook-probe.json`). |

## Tests

Baseline, on the base tree before any change: `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` 406 passed
(`$S/baseline/`). HEAD: 491 passed, typecheck 0 errors, lint 0 problems (`$S/gates-head-final.txt`).

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `weeks.test.ts`, `profileForm.test.ts`, `new-run.test.ts`, `suggest-areas/route.test.ts`, `suggest.test.ts` | **Import red only**: `Error: Cannot find module './weeks'` (and the same for `./profileForm`, `./new-run`, `./route`, `./suggest`) — `$S/red-1.txt` | 82 passed across the six new or extended files (`$S/green-1.txt`) |
| `store.test.ts` › profile store, v1→v2 upgrade (5 tests) | **Assertion red**: `TypeError: first.saveProfile is not a function`; 5 failed, 10 existing passed (`$S/red-1.txt`) | green (`$S/green-1.txt`) |
| `new-run.test.ts` › `switchPrompt`, `areasNote` (5 tests) | `TypeError: switchPrompt is not a function`. After the first implementation, a **wrong-value red**: `Received: "You've edited Ledgerly Inc.. Switch…"` (a double full stop), fixed by reusing `report.ts` `stop` | 25 passed (`$S/green-2.txt`) |
| `new-run.test.ts` › "an untouched 'New company…' … switches at once" | **Wrong-value red against the shipped code** (a real bug: an untouched blank form counted as edited because it has errors): `1 failed` (`$S/red-untouched-new.txt`) | green after `isEdited` compares fields as loaded first (`$S/green-3.txt`) |
| `suggest-client.test.ts` (6 tests) | Import red: `Cannot find module './suggest-client'` (`$S/red-suggest-client.txt`) | green (`$S/green-3.txt`: `src/lib/runs` 141 passed) |

Red runs for new modules only prove the module was missing, so I also turned every guard red against a plausible
wrong implementation. `$S/mutate.py` breaks one line, runs the owning test file, restores the file from a copy (never
git) and checks the restore. **45 of 45 went red** (`$S/mutations.txt`). The area-order check was run separately and
also went red (`$S/mutation-area-order.txt`).

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| A Friday's own week isn't full yet | start counting from today instead of today − 1 | "on a Friday, that week is not full yet…" |
| Inclusive day count, the same as the route | drop the `+ 1`; in `request.ts`, remove the shared check | "every window is five days…"; `request.test.ts` "a window one day longer than maxWindowDays (8 days)" |
| Window guards | delete the date guard; delete the reversed guard | "asks for both dates…"; "rejects a reversed window" |
| Today in New York | `timeZone: "UTC"` | "is still the previous day in New York when UTC has already rolled over" |
| Form guards | delete the name, summary, blank-area or duplicate guard; delete `formToProfile`'s throw | the matching `formErrors` tests; "two areas with the same trimmed name…" |
| An empty table becomes `general` | map it to `{}` | "an empty owners table becomes the single catch-all area 'general'…" |
| Owner emails: blank owner → GC; preset emails kept; one unique placeholder per person | remove each branch in turn | "a blank owner falls back…"; "an unedited preset round-trips deep-equal…"; "two different people whose names slug alike…"; "a name with no letters or digits…" |
| Edits are never dropped silently, and only real edits ask | switch despite edits; discard with nothing pending; picking the same entry is not a no-op; treat an untouched form as edited | the matching reducer tests; "has no edits to lose: picking a preset next switches at once" |
| An edited preset is never sent by id | drop `!isEdited` in `runFor` | "an edited field shows '<Name> (edited)' and Run sends a custom profile…" |
| Reordering areas counts as an edit | drop the key-order comparison | "is true when only the order of the areas changed…" |
| The v1→v2 upgrade keeps existing runs | create `runs` unconditionally; leave `VERSION = 1` | "adds the profiles store and keeps every run saved under version 1" |
| Profiles fall back to memory, newest first | delete the memory write; drop the sort | the two profile-store tests |
| Server-side suggest guards and retries | delete the empty or length guard; call `generateText` without `withRetry`; delete the dedupe | the `parseSuggestBody` tests; "tries a failing call at most 3 times through withRetry"; "returns its areas, cleaned" |
| The browser shows only route sentences | show any body as text; keep an empty text; let a network error throw; keep malformed entries | the four matching `suggest-client.test.ts` tests |
| Config guards | drop the `{{description}}` refine; allow an empty `defaultPreset` | the two schema tests |
| The route never leaks and never spends on bad input | delete the 400; return `error.message` on the 503; let the config error throw | the 400, keyless-503 and settings-500 route tests |

## Gates

Command, run after the last code edit with the type check last:
`PORT=3503 bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` → exit 0, ending `chunk 05 gates: OK`
(`$S/gates-head-final.txt`).

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 · 04's gates (03's lint, test, build, typecheck, parity, no-fs-writes, no poc/; 04's route, imports and bundle names), 08's typed numbers, the eval bundle | first three lines of `gates.sh` | `Tests 491 passed`, `parity: OK`, `no-fs-writes: OK (85 …)`, `chunk 04 gates: OK`, `no-typed-numbers: OK`, `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)` | Passes on base (`$S/gates-base.txt`, 406 tests). It is the regression set, not a chunk-05 assertion. |
| 2 · `/runs/new` offers `ledgerly` and never `brightside`, `cornercare` or `skyhop` | `gates.sh` Gate 2 | pass | **Yes.** Base worktree at `a7fbf1c`, offline install: exit 1, `FAIL: ledgerly missing from /runs/new`. On base, `/runs/new` is 04's run page for an id of "new", so no presets are passed. |
| 3 · no model id, `AI_GATEWAY` or `suggestAreas` in the page or the keyless suggest answers; keyless → 503, empty description → 400 | `gates.sh` Gate 3 | pass | **Yes.** Gate 3 alone on base: exit 1, `FAIL: no suggestAreas model found in config/app.yaml` (`$S/gates-base-g3.txt`). |
| 4 · `demo.ts` is gone and nothing in `src` names `DEMO_RUN` | `gates.sh` Gate 4 | pass | **Yes.** Gate 4 alone on base: exit 1, `FAIL: src/lib/runs/demo.ts still exists` (`$S/gates-base-g4.txt`). |
| Type check (last) | `pnpm typecheck` | exit 0 | — |

**Canaries, one per needle, all four steps.** `$S/canaries.py` wrote `$S/canaries.txt` on port 3505, rebuilding for
each canary and restoring each file from a copy, then checking it matched. The restored tree ran clean twice. The
block below is `$S/canaries.txt` verbatim; the self-check diffs it against that file.

```
FIRED | eval company offered | exit 1 | FAIL: eval company brightside offered on /runs/new
FIRED | ledgerly not offered | exit 1 | FAIL: ledgerly missing from /runs/new
FIRED | key variable leaks | exit 1 | FAIL: 'AI_GATEWAY' in suggest.txt
FIRED | model id leaks | exit 1 | FAIL: 'anthropic/claude-sonnet-5.5' in suggest.txt
FIRED | config key leaks | exit 1 | FAIL: 'suggestAreas' in suggest.txt
FIRED | keyless status not 503 | exit 1 | FAIL: keyless suggest-areas answered 502, not 503
FIRED | empty description reaches the model | exit 1 | FAIL: empty description answered 503, not 400
CLEAN | restored tree after server canaries | exit 0 | chunk 05 gates: OK
FIRED | demo.ts recreated | exit 1 | FAIL: src/lib/runs/demo.ts still exists
FIRED | DEMO_RUN referenced | exit 1 | FAIL: DEMO_RUN still referenced
CLEAN | final restored tree | exit 0 | chunk 05 gates: OK
```

The canaries covered Gates 2–4 only (`$S/gates-2to4.sh`, which is `gates.sh` with the Gate 1 lines dropped). Gate 1
is the earlier chunks' gates, already proven in those chunks. Only the eval-company canary planted `brightside`, so
the `cornercare` and `skyhop` needles were not probed one by one; all three go through the same loop line. The
canaries ran before the last two code commits (the untouched-form fix and `suggest-client.ts`). Neither commit touches
a file the gates grep, and the full gates passed again afterwards.

### Transcript self-check

Every payload quoted above was captured to a file by a tool: curl `-o` plus `-w` into a `.meta` file, or
chrome-devtools `evaluate_script` with `filePath`. None was transcribed by hand. The captures came from one keyless
server on port 3507, running the final UI build, in a fresh isolated browser context.

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| `/runs/new` 200, `/` 307 → `/runs/new`, keyless suggest 503 and empty 400 (both `text/plain`) | `$S/evidence/{runs-new,root,suggest-keyless,suggest-empty}.{meta,txt,html}` | `cat` of each `.meta`: `200`, `307 http://localhost:3507/runs/new`, `503 text/plain; charset=utf-8`, `400 text/plain; charset=utf-8` |
| The plan's quoted needle finds no `"ledgerly"`; the escaped form appears once | `$S/evidence/ledgerly-needles.txt` | generated by `grep -c` and `grep -oE … \| wc -l` over `runs-new.html` |
| Picker options, edited label, switch confirm, custom-window errors, focus, empty areas, run and IndexedDB, saved listing, 390 px, console | `$S/evidence/*.json` | written by `evaluate_script` `filePath`, one file per state |
| The 390 px probe is not vacuous | `$S/evidence/390-canary.json` | the same probe with a 600 px div reported `scrollWidth 608`, `elementsPastRightEdge 1` |
| The console probe is not vacuous | `$S/evidence/console-hook-probe.json` | a deliberate `console.error` was captured |
| The canary block above | `$S/canaries.txt` | `diff <(sed -n '/^FIRED | eval company/,/^CLEAN | final/p' completion-report.md) $S/canaries.txt` → exit 0 (recorded in `$S/selfcheck.txt`). With one character changed it exits 1 (also in `selfcheck.txt`). |

## Judgment calls

- **Owner emails (amendment 4).** An email follows the person, not the row. A name that already exists in the loaded
  profile (any area owner, or the GC) keeps that person's real email. Any other name gets `<slug>@owners.example`;
  `.example` is a reserved TLD, so a mailto draft can't reach a real mailbox. When two different names produce the same
  slug, the second gets `-2`. A blank owner is the GC. `CompanySchema` is unchanged. See Deviations for how this
  differs from the amendment's wording.
- **Area key = trimmed area name (amendment 5).** Presets therefore show their YAML keys (`aml-bsa`,
  `consumer-payments`) where the design shows "AML / BSA". That is what lets an unedited preset round-trip deep-equal
  (amendment 3, tested). Duplicate names are matched case-insensitively ("Tax" and " tax "), because they would read as
  one area to the GC and to routing. Fully blank rows (an "Add area" left empty) are ignored rather than flagged.
- **"Edited" means the fields changed.** A form whose fields still equal the profile as loaded is never edited, even
  when it can't run yet: an untouched "New company…" switches away without asking. Any other invalid form counts as
  edited.
- **Saved-profile key.** Profiles are stored under their own `key`, not `profile.id`, because an edited preset keeps
  `id: ledgerly` (amendment 3). Running a saved profile again replaces its own record; a freshly edited preset gets a
  new key. A profile is saved on Run (`beforeStart`), and only if it isn't an unedited preset. Saving on every edit
  would list half-typed profiles.
- **`defaultPreset` in `app.yaml`.** `presets()` returns `hearth, ledgerly` (sorted by file name), but the criterion,
  the design and US1 all open on Ledgerly. With `DEMO_RUN` gone nothing else named Ledgerly, so the choice moved to
  config (Decision 11) rather than code. It also picks which GC the sidebar footer shows.
- **Picker: shadcn `Select`, not `Popover` + `Command`.** The list is a handful of entries, and `Select` gives a
  labelled combobox with keyboard support. `Popover` is used for the "Add" chip input. `command` was not added.
- **Cost note dropped (amendment 14).** The design's typed "about $0.20" is gone; sourcing `setups.yaml` `estUsd`
  would have added another server value to the page for a figure the design only approximates.
- **Company name field added.** The design has no name input, but "New company…" needs one, and `formErrors` requires
  a name.
- **"Company profiles" → `/runs/new?focus=profile`.** The picker focuses itself on arrival (`focus.json`:
  `activeElementId: "profile"`). A `#profile` fragment would scroll to it but not focus it.
- **Suggestion errors.** The route answers every refusal with one fixed plain sentence, and the browser shows that
  sentence. Any other body is replaced by the fixed sentence, so an HTML error page or a platform timeout text never
  reaches the GC.
- **Suggest-areas model.** `anthropic/claude-sonnet-5.5`, the live setup's model in `setups.yaml`, so the config names
  no model the project hasn't already used. Descriptions are capped at 4000 characters to bound what one click can
  spend.

## Deviations from the plan

- **Amendment 4 says "Preset rows keep their real emails".** Here a row keeps its email only while its owner's name is
  unchanged. If the GC types a new name into a preset row, that person gets a placeholder email, because the preset's
  email belongs to the old owner. Moving a preset owner's name to another row carries their real email with them
  (tested).
- **The plan's Gate 2 needle can't see `ledgerly` on a correct tree.** Props reach the HTML as an escaped RSC payload.
  Measured: `grep -c '"ledgerly"'` → `0`, while the escaped form `\"ledgerly\"` appears once
  (`$S/evidence/ledgerly-needles.txt`). The quoted eval-id needles were blind the same way. `gates.sh` therefore accepts
  either quoting for presence and uses bare, case-insensitive words for absence; both are canaried above and recorded
  as a convention in `project.md`.
- **Extra modules beyond T005's list:**
  - `NewRunForm.tsx`, because `page.tsx` must stay a server page;
  - `new-run.ts` and `suggest-client.ts`, because vitest discovers only `*.test.ts` and the Convention Map puts screen
    decisions in tested `src/lib/runs` code.
- **Test Plan row "`store.test.ts` › profiles … `listProfiles()` is undefined".** The red was
  `saveProfile is not a function`: the first call each test makes, and the same missing store.

## project.md

Edited per the prompt-engineering bible's `conventions/ai-optimized-writing.md`.

- **Stack:** the shadcn row adds select, popover, input and textarea (chunk 05). Version 4.23.0 was read from
  `node_modules/shadcn/package.json`.
- **Convention Map:** the `src/lib/runs`, `src/components/gc` row now runs 05's `gates.sh`, which runs 04's first.
- **Conventions:**
  - The live-runs entry names the v2 `profiles` store, and why it is keyed apart from `profile.id`.
  - The `withRetry` entry names the suggest-areas call site and its policy parameter.
  - The config hash is now `36599b6308`, measured with a probe test that reads `configHash()`.
  - Three new entries: UI-only config lives in `app.yaml` with slice schemas; the run window has one shared check, and
    "today" is New York's date; RSC props are escaped in the HTML, which matters for gate needles.
- **Layout:** the `/` redirect, `runs/new`, `api/suggest-areas`, the new GC components and ui primitives, the new
  `src/lib/runs` modules and `app.yaml`'s new keys. `demo.ts` is removed.
- **Commands:** unchanged; no command was added or changed.

## Left alone

- `RunView.tsx:191` still links "Start a new run" to `/`. The redirect lands it on `/runs/new`, so I left 04's file
  as it was.
- "All runs" stays at `/#recent-runs` (amendment 8). The fragment may not survive the `/` redirect on client
  navigation; I didn't measure it.
- The picker's detail line ("3 owners") describes the profile as loaded, not the live table. With every Hearth area
  removed it still read "3 owners" next to "(edited)" (`empty-areas.json`).
- `max={today}` on the custom range is only a browser hint. `validateWindow` doesn't reject future dates, and neither
  did the route before this chunk.
- A gotcha for later chunks: chrome-devtools `fill` on a `type="date"` input changed the DOM value without firing
  React's `onChange`. The custom-window checks used the native value setter plus an `input` event instead.

## Screenshots

All in `$S/screens/`, taken from the final UI build against a keyless `next start` on port 3507, which was then
stopped:

- `01-preset-filled-desktop.png`
- `02-edited-owner.png` (full page)
- `03-switch-confirm.png`
- `04-custom-week-error.png`
- `05-390px.png` (full page)
- `06-picked-hearth.png`
- `07-empty-areas.png`
- `08-saved-profile-listed.png`

## Final run

After the last code commit, `PORT=3503 bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` exited 0
(`$S/gates-head-final.txt`, `$S/gates-head-final.exit`). It reported:

- `Tests 491 passed`
- `parity: OK`
- `no-fs-writes: OK (85 non-test source files under src/ scanned)`
- `chunk 04 gates: OK`
- `no-typed-numbers: OK`
- `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)`
- `tsc --noEmit` last
- `chunk 05 gates: OK`

The commits after that change only this report.
