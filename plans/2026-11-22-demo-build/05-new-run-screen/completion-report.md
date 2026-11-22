# Chunk 05 — Completion Report

Branch `feat/demo-build--new-run-screen`, base `a7fbf1c` (`git merge-base HEAD feat/plan--demo-build`).
Evidence files sit under the scratch directory
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-05/`
(written `$S/` below). No Gateway call was made with a real key at any point: every server ran with
`AI_GATEWAY_API_KEY=` empty, and every model in the tests is the AI SDK's `MockLanguageModelV4`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/runs/weeks.ts` (+ test) | created | `lastFullWeeks` (a week is full once its Friday is before today), `windowDays` (inclusive), `validateWindow`, `todayInNewYork`, `weekLabel`, `scanNote`. Pure, client-safe. |
| `src/app/api/run/request.ts` | edited | Uses `validateWindow` for the day count: one helper for the screen and the route (amendment 6). Messages unchanged; 04's tests pass as they were. |
| `src/lib/runs/profileForm.ts` (+ test) | created | Form ⇄ `CompanyProfile`: area key = trimmed name, empty table → `general` owned by the GC, owner emails (amendment 4), `formErrors`, `isEdited`, `blankProfile` (POC defaults), `mergeSuggested`. |
| `src/lib/runs/new-run.ts` (+ test) | created | The screen's decisions: `orderPresets`, `pickerOptions`, the pick / discard / keep reducer, `pickerLabel` ("(edited)"), `runFor` (what Run sends and whether to save), and every sentence (`runSummary`, `caresAboutTitle`, `ownersDetail`, `switchPrompt`, `areasNote`). |
| `src/lib/runs/types.ts` | edited | `SavedProfile {key, savedAt, profile}`. |
| `src/lib/runs/store.ts` (+ test) | edited | Version 2; `onupgradeneeded` creates only missing stores; `profiles` store with `saveProfile` / `getProfile` / `listProfiles` and the same memory fallback. |
| `src/lib/runs/report.ts` | edited | `stop` exported (reused for "Ledgerly Inc." at a sentence end). |
| `src/lib/config/schemas.ts` | edited | `NewRunConfigSchema {defaultPreset}`, `SuggestAreasConfigSchema {suggestAreas: {model, prompt ∋ {{description}}}}`. |
| `config/app.yaml` | edited | `defaultPreset: ledgerly`; `suggestAreas.model` (the live setup's model id, from `setups.yaml`) and `.prompt`. |
| `src/app/api/suggest-areas/route.ts`, `suggest.ts` (+ tests) | created | `POST {description}` → `{areas:[{id, description}]}`. Route = wiring and fixed failure sentences; `suggest.ts` = body guard (empty / >4000 chars), `render()` of the configured prompt, one `generateText` + `Output.object` through `withRetry`, `maxRetries: 0`, model resolved before the retry loop. |
| `src/app/runs/new/page.tsx` | created | Server page: `presets()` ordered by `defaultPreset`, `maxWindowDays`, New York's date, `?focus=profile` as props. |
| `src/app/page.tsx` | edited | Redirects to `/runs/new`. |
| `src/app/runs/[id]/page.tsx` | edited | Sidebar user from `defaultPreset` instead of `DEMO_RUN`. |
| `src/lib/runs/demo.ts` | deleted | Amendment 7. |
| `src/components/gc/NewRunForm.tsx`, `ProfilePicker.tsx`, `WeekPicker.tsx`, `ProfileEditor.tsx`, `OwnersTable.tsx` | created | Render and wire only. |
| `src/components/gc/StartRunButton.tsx` | edited | `disabled` and `beforeStart` props; `request` / `profile` may be null (disabled). |
| `src/components/gc/useRun.ts` | edited | `useSavedProfiles()`, `saveProfile()` over the runner's store. |
| `src/components/gc/GcSidebar.tsx` | edited | New run → `/runs/new`; Company profiles → `/runs/new?focus=profile`; All runs unchanged. |
| `src/components/ui/{select,popover,input,textarea}.tsx` | created | `pnpm exec shadcn add select popover input textarea` (shadcn 4.23.0), unedited. |
| `plans/.../05-new-run-screen/gates.sh` | created | This chunk's gates (below). |
| `.claude/resources/project.md` | edited | See "project.md" below. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Picker lists exactly the demo presets (Ledgerly, Hearth) + saved profiles + "New company…"; first preset selected and filled | yes | `new-run.test.ts` › "lists the presets, then this browser's saved profiles, then 'New company…'", "starts on the first preset with every field filled from it", `orderPresets` tests; gate 2 (no eval id in `/runs/new`); live: options read from the DOM were `["Ledgerly Inc.Preset","Hearth Home AppliancesPreset","Hearth Home AppliancesSaved","New company…"]` after one run; `$S/screens/01-preset-filled-desktop.png`, `08-saved-profile-listed.png` |
| Editing shows "<Name> (edited)"; Run sends a custom profile, not the preset id | yes | `new-run.test.ts` › "an edited field shows '<Name> (edited)' and Run sends a custom profile, not the preset id"; live trigger text `"Ledgerly Inc. (edited) · 6 owners"`; `$S/screens/02-edited-owner.png`; the live run's stored request had keys `["customProfile","windowStart","windowEnd"]`. The preset YAML is untouched: `parity.sh` passes (`parity: OK` in `$S/gates-head-1.txt`). |
| Switching with unsaved edits asks inline: "Discard edits" / "Keep editing" | yes | reducer tests ("switching with unsaved edits asks first…", "'Discard edits' switches…; 'Keep editing' stays…"), `switchPrompt` tests; `$S/screens/03-switch-confirm.png` (no `window.confirm`) |
| Last three full Mon–Fri weeks, newest selected; Custom shows two date inputs; >maxWindowDays or reversed → inline error, Run disabled | yes | `weeks.test.ts` (Monday, Saturday, Sunday, Friday, Jan 2 2027); `validateWindow` tests at 7/8 days and reversed; live: Nov 16 → Nov 25 showed `"Pick a window of at most 7 days."` with `role="alert"` and Run `disabled: true`; `$S/screens/04-custom-week-error.png` |
| No areas → run still starts, items route to the GC, said under the table | yes | `profileForm.test.ts` › "an empty owners table becomes the single catch-all area 'general'…"; `areasNote` tests; live: removed all Hearth areas, Run navigated to `/runs/097e9e4f-…`, stored `customProfile.areas` = `{"general":{"description":"Everything","owner":{"name":"Robert Chen (General Counsel)","email":"gc@hearth.example"}}}`; the keyless run then failed at the ranking step as designed (no spend). `$S/screens/07-empty-areas.png` |
| "Suggest from description" returns proposed areas (owner blank), filled for review, never auto-run; model and prompt from config | yes, with stubbed models only | `suggest.test.ts` (config parse; rendered prompt and configured model id reach the model; cleaning), `profileForm.test.ts` › `mergeSuggested` (owner `""`); route test 200 with a mock. Keyless live click showed `"Suggestions aren't available right now. Add the areas yourself, or try again later."`. **A real model call was never made**, so the prompt's real-world output is unverified. |
| Run navigates to `/runs/<id>` and chunk 04's screens take over | yes | Live click → `Page navigated to http://localhost:3502/runs/097e9e4f-e972-4bc9-9b18-5d2c073e1358`, which rendered 04's Failed state ("Ranked them by relevance… failed", Retry). |
| 390 px: panes stack, nothing scrolls sideways | yes | At 390×844: `{"scrollWidth":390,"clientWidth":390,"overflowing":0}` (count of elements whose right edge passes the viewport); `$S/screens/05-390px.png` (owners rows stack into cards below 640 px) |

## Tests

Baseline (base tree, before any change): `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` 406 passed
(`$S/baseline/`). HEAD: 484 passed, typecheck 0 errors, lint 0 problems (`$S/gates-head-final.txt`; 483 in the
earlier `$S/gates-head-1.txt`, before the area-order test).

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `weeks.test.ts`, `profileForm.test.ts`, `new-run.test.ts`, `suggest-areas/route.test.ts`, `suggest.test.ts` | **Import red only**: `Error: Cannot find module './weeks'` (likewise `./profileForm`, `./new-run`, `./route`, `./suggest`) — `$S/red-1.txt` | 82 passed across the six new/extended files (`$S/green-1.txt`) |
| `store.test.ts` › profile store, v1→v2 upgrade (5 tests) | **Assertion red**: `TypeError: first.saveProfile is not a function` (5 failed, 10 existing passed) — `$S/red-1.txt` | green (`$S/green-1.txt`) |
| `new-run.test.ts` › `switchPrompt`, `areasNote` (5 tests) | `TypeError: switchPrompt is not a function`; then, after the first implementation, a **wrong-value red**: `Received: "You've edited Ledgerly Inc.. Switch…"` (double stop), fixed by reusing `report.ts` `stop` | 25 passed (`$S/green-2.txt`) |

Because tests-first red for new modules only proves absence, every guard was also shown red against a plausible wrong
implementation: `$S/mutate.py` breaks one line, runs the owning test file, restores from a copy (never git) and asserts
the restore. **40 of 40 went red** (`$S/mutations.txt`), plus the area-order check (`$S/mutation-area-order.txt`).

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| A Friday's own week isn't full | start at today instead of today − 1 | "on a Friday, that week is not full yet…" |
| Inclusive count, same as the route | drop the `+ 1` | "every window is five days…"; route: removing the shared check → `request.test.ts` "a window one day longer than maxWindowDays (8 days)" |
| Window guards | delete the date / reversed guard | "asks for both dates…", "rejects a reversed window" |
| New York's date | `timeZone: "UTC"` | "is still the previous day in New York when UTC has already rolled over" |
| Form guards | delete name / summary / blank-area / duplicate guards; delete `formToProfile`'s throw | the matching `formErrors` tests; "two areas with the same trimmed name…" |
| Empty areas → `general` | map to `{}` | "an empty owners table becomes the single catch-all area 'general'…" |
| Blank owner → GC; preset emails kept; one unique placeholder per person | each branch removed | "a blank owner falls back…", "an unedited preset round-trips deep-equal…", "two different people whose names slug alike…", "a name with no letters or digits…" |
| Edits never dropped silently | pick switches despite edits; discard with nothing pending; pick-same not a no-op | the three reducer tests |
| Edited preset never sent by id | drop `!isEdited` in `runFor` | "an edited field shows '<Name> (edited)' and Run sends a custom profile…" |
| Reordering areas is an edit | drop the key-order comparison | "is true when only the order of the areas changed…" |
| v1→v2 upgrade keeps runs | create `runs` unconditionally; leave `VERSION = 1` | "adds the profiles store and keeps every run saved under version 1" |
| Profiles fall back to memory, newest first | delete the memory write; drop the sort | the two profile-store tests |
| Suggest guards and retries | delete empty / length guards; call `generateText` without `withRetry`; delete dedupe | `parseSuggestBody` tests; "tries a failing call at most 3 times through withRetry"; "returns its areas, cleaned" |
| Config guards | drop the `{{description}}` refine; allow empty `defaultPreset` | the two schema tests |
| Route never leaks, never spends on bad input | delete the 400; return `error.message` on 503; let the config error throw | the 400, keyless-503 and settings-500 route tests |

## Gates

Command (after the last code edit, typecheck last):
`PORT=3503 bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` → exit 0, ends `chunk 05 gates: OK`
(`$S/gates-head-1.txt`). It was re-run after this report was committed; see "Final run" at the end.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 · 04's gates (03's lint, test, build, typecheck, parity, no-fs-writes, poc/; 04's route, imports, bundle names), 08's typed numbers, eval bundle | first three lines of `gates.sh` | `Tests 484 passed`, `parity: OK`, `no-fs-writes: OK (84 …)`, `chunk 04 gates: OK`, `no-typed-numbers: OK`, `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)` | Passes on base (`$S/gates-base.txt`, 406 tests): it is the regression set, not a chunk-05 assertion. |
| 2 · `/runs/new` offers `ledgerly`, never `brightside`/`cornercare`/`skyhop` | `gates.sh` Gate 2 | pass | **Yes**: base worktree at `a7fbf1c` with an offline install, exit 1, `FAIL: ledgerly missing from /runs/new` (on base `/runs/new` is 04's run page for id "new", so the preset props are absent). |
| 3 · no model id, `AI_GATEWAY`, `suggestAreas` in the page or keyless suggest answers; keyless → 503, empty → 400 | `gates.sh` Gate 3 | pass | **Yes**: Gate 3 alone on base, exit 1, `FAIL: no suggestAreas model found in config/app.yaml` (`$S/gates-base-g3.txt`). |
| 4 · `demo.ts` gone, no `DEMO_RUN` in `src` | `gates.sh` Gate 4 | pass | **Yes**: Gate 4 alone on base, exit 1, `FAIL: src/lib/runs/demo.ts still exists` (`$S/gates-base-g4.txt`). |
| Typecheck (last) | `pnpm typecheck` | exit 0 | — |

**Canaries, one per needle, four steps** (`$S/canaries.py`, output `$S/canaries.txt`; port 3505; each canary
rebuilt; files restored from a copy and compared; the restored tree then ran clean twice):

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

The canary run covered Gates 2–4 only (`$S/gates-2to4.sh`, generated from `gates.sh` by dropping the Gate 1 lines).
Gate 1 is the earlier chunks' gates, already proven in their own chunks. Only the eval-company canary planted
`brightside`, so the `cornercare` and `skyhop` needles were not probed one by one. All three go through the same loop
line.

## Judgment calls

- **Owner emails (amendment 4).** An email follows the person, not the row. A name that exists in the loaded profile
  (any area owner, or the GC) keeps that person's real email. Any other name gets
  `<slug>@owners.example`: `.example` is a reserved TLD, so a mailto draft can't reach a real mailbox. If two different
  names slug alike, the second gets `-2`. A blank owner is the GC. Following the person rather than the row means
  renaming a preset row's owner doesn't leave mail addressed to the old person. `CompanySchema` is unchanged.
- **Area key = trimmed area name (amendment 5).** Presets therefore show their YAML keys (`aml-bsa`, `consumer-payments`)
  where the design shows "AML / BSA". That is the price of an unedited preset round-tripping deep-equal (amendment 3,
  tested). Duplicates are matched case-insensitively ("Tax" vs " tax "), because they would read as one area to the GC
  and to routing. Fully blank rows (an "Add area" left empty) are ignored, not errors.
- **Saved-profile key.** Profiles are stored under their own `key`, not `profile.id`, because an edited preset keeps
  `id: ledgerly` (amendment 3). A saved profile run again replaces its own record; a freshly edited preset gets a new
  key. Saving happens on Run (`beforeStart`), only for profiles that aren't an unedited preset. Saving on every edit
  would list half-typed profiles.
- **`defaultPreset` in `app.yaml`.** `presets()` returns `hearth, ledgerly` (sorted by file name), but the criterion,
  the design and US1 all open on Ledgerly. Removing `DEMO_RUN` took away the only thing that named Ledgerly, so the
  choice moved to config (Decision 11) rather than code. It also picks the sidebar footer's GC on `/runs/new` and
  `/runs/[id]`.
- **Picker: shadcn `Select`, not `Popover` + `Command`.** There are at most a handful of entries, and `Select` gives a
  labelled combobox with keyboard support. `Popover` is used for the "Add" chip input; `command` was not added.
- **Cost note dropped (amendment 14).** The stone note reads only "Scans every federal document published Mon Nov 16 –
  Fri Nov 20." Sourcing `estUsd` would have put one more server-config value into the page for a figure the design
  only approximates.
- **Company name field added.** The design has no name input, but "New company…" needs one and `formErrors` requires
  it.
- **"Company profiles" link → `/runs/new?focus=profile`.** The server page passes `focusProfile`, and the picker focuses
  itself (measured: `document.activeElement.id === "profile"`). A `#profile` fragment would scroll there but not focus.
- **Suggest-areas model.** `anthropic/claude-sonnet-5.5`, the live setup's model in `setups.yaml`, so no model id
  enters config that the project hasn't already used. The description is capped at 4000 characters to bound one
  click's cost.

## Deviations from the plan

- **The plan's Gate 2 needle can't find `ledgerly` on a correct tree.** The props arrive in the HTML as an escaped RSC
  payload. Measured on `$S/runs-new.html`: `grep -c '"ledgerly"'` → `0`, while `grep -oE '\\?"ledgerly\\?"'` → one
  `\"ledgerly\"`. The quoted eval-id needles had the same blindness: an escaped `\"brightside\"` would slip past them.
  `gates.sh` matches either quoting for presence and uses bare, case-insensitive words for absence. Both were canaried
  above. Recorded as a convention in `project.md`.
- **Extra modules beyond T005's list.** `NewRunForm.tsx` exists because `page.tsx` must stay a server page.
  `new-run.ts` exists because vitest discovers only `*.test.ts`, and the Convention Map puts screen decisions and
  sentences in tested `src/lib/runs` code rather than in components.
- **Plan Test Plan row "`store.test.ts` › profiles … `listProfiles()` is undefined":** the red was
  `saveProfile is not a function` (the first call in each test), the same absence.

## project.md

I edited it under the prompt-engineering bible's `conventions/ai-optimized-writing.md` (bullets for rules, the why
stated, measurable wording). Changes:

- Stack: the shadcn row gains select, popover, input and textarea (chunk 05). Version 4.23.0 was read from
  `node_modules/shadcn/package.json`.
- Conventions:
  - the live-runs entry now names the v2 `profiles` store and why it is keyed apart from `profile.id`;
  - `withRetry` notes the suggest-areas call site and its policy parameter;
  - the config hash is now `36599b6308`, measured with a probe test that reads `configHash()`;
  - three new entries: UI-only config lives in `app.yaml` with slice schemas; one shared window check, with New York's
    "today"; RSC props are escaped in HTML (gate needles).
- Layout: the `/` redirect, `runs/new`, `api/suggest-areas`, the new GC components and ui primitives, the new
  `src/lib/runs` modules, and `app.yaml`'s new keys. `demo.ts` is removed from the list.
- Commands: unchanged. No command was added or changed.

## Left alone

- `RunView.tsx:191` still links "Start a new run" to `/`. The redirect makes it land on `/runs/new`, so I left 04's
  file as it was.
- "All runs" stays `/#recent-runs` (amendment 8). After the `/` redirect the fragment may not survive client
  navigation; not measured.
- The picker's detail line ("3 owners") describes the profile as loaded, not the live table. With every Hearth area
  removed it still read "3 owners" while the label said "(edited)".
- The custom range's `max={today}` is a browser hint only. `validateWindow` doesn't reject future dates, and neither did
  the route before this chunk.
- Screenshots were taken from two builds. 01 (retaken), 05, 06, 07 and 08 come from the final UI. 02, 03 and 04 come
  from the first build, which differs only in the editor header's mobile wrap and the owners inputs' screen-reader
  label wording ("Area name, area 1").
- Gotcha for later chunks: chrome-devtools `fill` on a `type="date"` input changed the DOM value without firing React's
  `onChange`. The custom-week check was driven with the native value setter plus an `input` event instead. A real
  user's typing fires the event.

## Screenshots

`$S/screens/`: `01-preset-filled-desktop.png`, `02-edited-owner.png`, `03-switch-confirm.png`,
`04-custom-week-error.png`, `05-390px.png` (+ `05-390px-top.png`), `06-picked-hearth.png`, `07-empty-areas.png`,
`08-saved-profile-listed.png`. All were taken against a keyless `next start` on port 3502, which was stopped
afterwards.

## Final run

After the report and the ticked plan were committed (commit `Chunk 05: completion report; tasks ticked`), with no
code change after it: `PORT=3503 bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` → exit 0; `Tests 484
passed`, `parity: OK`, `no-fs-writes: OK (84 non-test source files under src/ scanned)`, `chunk 04 gates: OK`,
`no-typed-numbers: OK`, `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)`, `tsc --noEmit` last,
`chunk 05 gates: OK` (`$S/gates-head-final.txt`).
