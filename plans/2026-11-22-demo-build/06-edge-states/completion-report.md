# Chunk 06 — Completion Report

Branch `feat/demo-build--edge-states`. Base `7870a84`, which is `git merge-base HEAD feat/plan--demo-build`.
Scratch evidence directory (named `$S` below): `/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-06/`

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/pipeline/events.ts` | edited (copy only) | Amendment 7. `TIMEOUT_MESSAGE` and `UNEXPECTED_MESSAGE` said "Retry runs this step again". Retry re-posts the whole run, so they now say "Retry starts the run again from the beginning, with the same settings." The hard-coded strings in `retry.test.ts`, `stages.test.ts` and `reduce.test.ts` were updated to match. |
| `src/lib/runs/recorded-view.ts` (+ test) | created | Amendment 8. This is the one browser-safe mapping (zod only) from a POC `RunRecord` to the report fields: items, tiers, owners, dates, held back, stages, failure. The reviewer report uses it, and so does `recorded.ts`. |
| `src/lib/pipeline/recorded.ts` (+ test) | created | Amendment 1. Server-only. `projectRecordedRun` turns a finished example run into public `RunEvent`s and the profile it ran with. Labels come from `stepOf`. Closest calls come from `screenedOut` over `frozenWeek`. The POC's leaked relevance-score reason becomes `NEUTRAL_REASON`. Every event goes through `assertPublic`, and the shipped profile through `assertPublicText`. `projectExamples` filters to finished runs and refuses an empty listing. `exampleIndex` builds the listing. |
| `src/lib/pipeline/events.ts` (+ test) | edited | Adds `assertPublicText(text, where)`: `assertPublic`'s check over any text. `assertPublic` now calls it, with the same message as before. |
| `scripts/build-examples.mts`, `scripts/build-examples.sh` | created | Writes `public/examples/{index.json,<id>.json}`. It runs under the `poc-src` checkout's tsx with `--conditions=react-server`, which is the same runner the eval-bundle scripts use. |
| `public/examples/**` | generated (own commit `2b9be2b`) | 9 finished example runs out of 22 recorded. |
| `src/lib/runs/types.ts` | edited | Adds `StoredRun.confirmed?: string[]` (amendment 5) and the `ExampleSummary` / `ExampleRun` file shapes. |
| `src/lib/runs/reduce.ts` (+ test) | edited | Adds `applyConfirmed`, `frDocUrl` and `CheckedRow`, plus the new `RunViewState.checkedByYou` field. A confirmed item has no tier and no deadline, and is owned by the GC. There is no new `RunEvent` type. |
| `src/lib/runs/report.ts` (+ test) | edited | Adds `isNothingToReport`, `emptySummary` and `closestCalls`. The heading and summary now count confirmed rows and stop saying "below matched the Federal Register" once one is present. With 0 items and something held back, the heading reads "No verified items for X, N held back" and the summary says none passed verification, instead of "nothing affects X". `reportJson` gains `addedAfterChecking`. |
| `src/lib/runs/memo.ts` (+ test) | created | `noActionMemo`, `heldBackSection` and `withHeldBack`. |
| `src/lib/runs/reader.ts` (+ test) | edited | `runner.confirmHeldBack(id, doc)` saves the confirmation, updates this page's copy and notifies listeners. It throws for a run that isn't done and for a document the run didn't hold back. |
| `src/lib/runs/new-run.ts` (+ test) | edited | Amendment 6. Adds `prefillState`, `prefillWeek` and the reducer action `load`. |
| `src/lib/runs/examples.ts` (+ test) | created | The browser reader for `/examples/*` and the sidebar labels, which number repeated company-weeks as "run 1" and "run 2". |
| `src/lib/evals/loader.ts` (+ test) | edited | Adds `loadRecordedRun`. For an example it reads the run's own file; for a suite it streams `runs.jsonl.gz` and stops at the match. The gzip line reader now cancels the body when its consumer stops early. |
| `src/components/gc/{EmptyReport,HeldBack,FailedStep,ExampleView}.tsx`, `download.ts` | created | The three edge states from `design/HiStates.dc.html`, the example page view, and the shared Blob download. |
| `src/components/gc/{ReportView,RunSteps,RunView,GcSidebar,NewRunForm,useRun}.tsx/ts` | edited | Wire in the empty and held-back states, confirmed rows, FailedStep with Retry and Edit settings, the Examples list, `?from=` prefill and `confirm`. `Problem` was folded into `FailedStep`. |
| `src/app/examples/[id]/page.tsx`, `src/app/runs/new/page.tsx` | created / edited | The example route, and the `from` search param. |
| `src/app/evals/reports/[suiteId]/[runId]/page.tsx`, `src/components/evals/RecordedReport.tsx` | created | Amendment 8: the reviewer's read-only run report. |
| `src/components/evals/{RunsView,RunPanel}.tsx` | edited | Add "Report" links (`reportHref`). |
| `plans/.../04-run-and-report/gates.sh` | edited | Amendment 9: `examples/[id]/page` added to Gate 5's default `GC_ROUTES` (required, not optional). |
| `plans/.../06-edge-states/gates.sh` | created | Amendment 10. |
| `.claude/resources/project.md` | edited | Adds a Commands row (examples rebuild), Convention Map rows (`public/examples/**`, the recorded mapping, GC code under 06's gates), two Conventions (held-back confirmation, examples read only from `public/examples`), and Layout entries. No new dependency. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| 0-item run → empty state with ≤3 closest calls; memo has the window, count checked and those calls | yes | `report.test.ts` › "the nothing-applies state"; `memo.test.ts` › "states the window, the count checked and the first 3 closest calls"; screenshots `$S/shots/01-empty-l14a-desktop.png` and `02-empty-l14a-390.png` (real example l14a, 448 docs, 3 calls) |
| 1 dropped item → block above the table, "Held back 1"; Add after checking → "Confirmed by you" row that survives a reload | yes | `reduce.test.ts` › `applyConfirmed`; `reader.test.ts` › "saves the confirmation … survives a reload (a new page over the same IndexedDB)". Seeded IndexedDB: `03-held-back-before-desktop.png`, then click and reload, then `04-held-back-after-confirm-reloaded-desktop.png`. After the reload the page read IndexedDB `confirmed: ["2026-22731"]`, heading "…, plus 1 you added", row badges `["Not tiered","Confirmed by you"]`, and no held-back block. |
| Failed run → finished steps done, failed step with message, Retry and Edit settings; Edit settings → `/runs/new?from=<id>` prefilled | yes | `new-run.test.ts` › prefillState and prefillWeek. Seeded failed run: `07-failed-desktop.png` and `06-failed-390.png`. Clicking Edit settings went to `/runs/new?from=seed-failed`, which shows the Hearth preset with "Custom" pressed and dates `2026-10-19`–`2026-10-23` (`08-edit-settings-prefilled-desktop.png`). |
| Sidebar "Examples" from `/examples/index.json`; each opens with no fetch beyond static files; no internal name in the report or any fetched file | yes | `examples.test.ts` (all 9 render done; every event passes `assertPublic`; only `/examples/*` requested). Browser network log on `/examples/<l14a>`: document, `/examples/index.json` and `/examples/<id>.json`, with nothing under `/evals`. Gate 3 scans every file and Gate 5 scans the served page HTML. `09-example-5udy-desktop.png`, `10-example-5udy-390.png`. |

More shots, all viewed:

- `05b-confirmed-row-390.png`: the "Not tiered · Confirmed by you" row at 390 px. The page is 390 wide; the table scrolls inside its own 332 px wrapper (680 px table, chunk 04's `min-w-[680px]`).
- `06-failed-390.png`: failed run at 390 px, `scrollWidth 390`.
- `14-edit-settings-prefilled-390.png`: Edit settings at 390 px, `scrollWidth 390`, Custom pressed, dates 2026-10-19–23.
- `17-held-only-desktop.png`: 0 items and 1 held back.
- `15-from-unknown-390.png`: `/runs/new?from=no-such-run` shows "That run isn't saved in this browser, so the form starts from the default profile."
- `/examples/no-such-example` renders "Example not found".
- `16-reviewer-not-found-390.png`: renders "The recorded evaluation could not be loaded: Run no-such-run is not in suite arena-2026-11-21-22-52-l92".
- `18-reviewer-error-desktop.png`: the reviewer error run at desktop.

Reviewer report: `11-reviewer-error-390.png` (failed run czeo, showing the recorded Gateway error), `12-reviewer-done-390.png` and `13-reviewer-done-desktop.png` (l92 suite run, 5 items). Page width at 390 px measured `scrollWidth 390` = `clientWidth 390` on the empty, held-back, example and reviewer pages.

## Tests

Totals: 606 tests in 46 files before (baseline `$S/baseline/`), 681 tests in 50 files after.

A second round (`$S/red-round2.txt`) added 7 tests that failed on assertions:

- held-back-only heading: `expected 'Nothing published Nov 2–6 affects Led…' to be …`
- held-back-only summary
- `assertPublicText`: not a function
- the profile check: `expected [Function] to throw an error`
- both `projectExamples` tests

Two more tests, the malformed custom profile and the non-OK index, passed when written because their code already existed. The mutations below show they discriminate.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| Retry copy (`retry.test.ts`, `stages.test.ts`, `reduce.test.ts`) | 4 failed, assertion: `expected { type: 'step.failed', …(3) } to deeply equal …` (`$S/red-copy.txt`) | 65 passed |
| `recorded-view.test.ts` | import error: `Cannot find module './recorded-view'` | 9 passed |
| `recorded.test.ts` | import error: `Cannot find module './recorded'` (`$S/red-recorded-import.txt`; the code was written before this red was captured, so the module was moved aside to record it) | 13 passed |
| `reduce`/`report`/`memo` additions | 13 failed: `TypeError: applyConfirmed is not a function`, `expected undefined to deeply equal []`, plus `Cannot find module './memo'` (`$S/red-confirm-report-memo.txt`) | all pass |
| `reader.test.ts` › confirmHeldBack | 6 failed: `TypeError: runner.confirmHeldBack is not a function` | 27 passed |
| `new-run.test.ts` › prefill | 8 failed: `TypeError: prefillState is not a function` | 34 passed |
| `loader.test.ts` › loadRecordedRun | 5 failed: `TypeError: loadRecordedRun is not a function` | 35 passed |
| `examples.test.ts` | import error: `Cannot find module './examples'` | 7 passed |

Most of those reds are import or "not a function" errors, which only prove the module was missing. Assertion-level reds come from mutations: `$S/mutate.sh` changes one line, runs the tests, restores the file by copy and diffs the restore. Logs are in `$S/mut/`.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| Leaked score becomes the neutral reason | pass the item through unchanged | "replaces the POC's leaked relevance score…" |
| Every event passes `assertPublic` | drop `events.forEach(assertPublic)` | "refuses a record whose text would leak…": expected to throw |
| Only finished runs become examples / known company / frozen week | guards disabled | the corresponding refuse test, each `expected [Function] to throw` |
| notReviewedCount uses the relevance cut | `docs.length` | `expected 466 to be 443` |
| Held-back title from the frozen week | keep the number as the title | `expected '2026-22246' not to be '2026-22246'` |
| recordedView keeps items / titles / custom name | `items: []`; title ignored; custom name ignored | the 3 tests in `recorded-view.test.ts` |
| Confirm moves the item, never tiers it | no-op filter; add `tier: "Low"` | `applyConfirmed` tests (`expected [ {…(6)} ] to deeply equal [ {…(5)} ]`) |
| Summary stops claiming "below" | `where = "below"` | "summary never says every row below matched…" |
| Empty state only when nothing at all | `!items.length` only | `expected true to be false` |
| Memo: closest calls, held-back section, only 3 | each removed or widened | the memo tests |
| confirmHeldBack: page copy, save, notify, dedupe, both guards | each line removed | 6 distinct reader tests |
| prefill: base, saved lookup, week match, load action | each broken | 4 distinct prefill tests |
| loader: cancel, early return, user-view path | each broken | "body is cancelled" (`expected false to be true`), and the others |
| examples: labels, missing file, bad shape (file and index) | each removed | the 4 tests; deleting a generated file made "each renders…" red |
| recordedView parse-failure throw | throw removed | both "rejects…" tests (`expected … to throw error matching /Recorded run …/ but got 'Cannot read properties of undefined'`) |
| loadRecordedRun "not in suite" throw | `return {}` | "throws naming the run and suite…": `promise resolved "{}" instead of rejecting` |
| confirmHeldBack null for an unknown run | throw instead | "answers null for a run this browser doesn't have" |
| Custom profile parsed with `CompanySchema` | cast instead of parse | "refuses a custom profile that isn't a company profile" |
| Shipped profile checked public | check removed | "refuses a custom profile that names an internal model" |
| projectExamples refuses an empty listing | guard removed | "refuses a listing with no finished run…" |
| loadExampleIndex non-OK throw | removed | "throws naming the index when it can't be loaded" (got `Unexpected token 'g'`) |
| Held-back-only heading / summary | branch disabled; " more" always | the 2 tests in "a run with no items but something held back" |

## Gates

Final run, after the last code edit: `AI_GATEWAY_API_KEY= PORT=3601 bash plans/2026-11-22-demo-build/06-edge-states/gates.sh` exited 0 (`$S/gates-final.txt`):

```
 Test Files  50 passed (50)
      Tests  681 passed (681)
parity: OK (decision-path config, brightside +1 line, golden fixture, tier/verify/prompts)
no-fs-writes: OK (112 non-test source files under src/ scanned)
Gate 5: 18 client chunks of the GC routes scanned (eval-view chunks excluded)
chunk 04 gates: OK
verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)
chunk 05 gates: OK
Gate 2: OK
public/examples: 9 examples of 22 recorded runs (13 failed, not listed)
Gate 3: 10 files under public/examples scanned
Gate 4: OK
Gate 5: examples, prefill and reviewer report pages answer 200 (keyless)
Gate 6: no poc/ path
chunk 06 gates: OK
```

The type check runs last. Baseline: 0 type errors, 0 lint problems, 606/606 tests (`$S/baseline/`). After: 0 type errors, 0 lint problems, 681/681 tests.

The base tree is a detached worktree at `7870a84` (`$S/base`, with a real `pnpm install`), with this chunk's gate scripts copied in:

| Gate | Fails on base? |
| ---- | -------------- |
| Whole `06/gates.sh` | exit 1: `FAIL: GC route examples/[id]/page has no .next/server/app/examples/[id]/page_client-reference-manifest.js` (04 Gate 5 with the new route) |
| Gate 2 `gate_gc_code` | exit 1: `FAIL: src/app/examples is missing`. Over the three directories that exist on base, `git grep -niE "jev\|typesafe-ai" 7870a84 -- src/components/gc src/lib/runs src/app/runs ':!*.test.*' ':!**/__fixtures__/**'` finds 0 hits. So the needle passes on base, as the plan expects, which makes it a regression guard; see the canary below. |
| Gate 3 rebuild / scan | `scripts/build-examples.sh` exit 127 (absent); `gate_examples_scan` exit 1: `FAIL: public/examples is missing` |
| Gate 4 `gate_gc_reads` | exit 1: `FAIL: src/app/examples is missing`. The same `git grep` with Gate 4's needle over the three base directories finds 0 hits (regression guard; canary below). |
| Gate 5 runtime | `/examples/index.json`, `/examples/<id>.json`, `/examples/<id>` and `/evals/reports/user-view/<id>` each answer 404 on base. `/runs/new?from=x` answers 200 on base too, so that probe is only a smoke check; the prefill itself is proved by the unit tests and screenshot 08. |
| Gate 6 poc count | exit 0 on base (regression guard) |

Canaries (`$S/canaries.sh`, output `$S/canaries.txt`, re-run after the last edit to `gates.sh`): 31 of 31 behaved as expected. Each gate function was fed a planted input and then the clean one:

- **Gate 2:** a missing dir and a planted `"Jev"` in `ExampleView.tsx` each fired, and the gate was green again after restore.
- **Gate 4:** a planted `fetch("/evals/index.json")` and a planted `@/lib/evals/loader` import each fired, and the gate was green after restore.
- **Gate 3 scan:** 21 probes, one for each alternative in `INTERNAL` (now including `google/`), each planted into a copy of one example file, and every one fired. A missing example file fired the count check.
- **Gate 6:** `poc/data/x.json` in the list fired; `pocket/x` did not.
- **Idempotence:** changing the projection (`items + 1`) and rebuilding left `public/examples` dirty, so the check fired (`$S/canary-idem.txt`). After restore and rebuild, `git status` was clean.
- **Runtime `cmp`:** with `public/examples/<id>.json` moved away, the server answered 500 and `cmp` was non-zero.
- **04 Gate 5 route:** `data-canary="filter:jev"` was planted in `ExampleView` only. The full 04 gates exited 1 with `FAIL: internal name in a chunk a GC page loads`. Gate 5 alone with the old route list exited 0 (16 chunks), and with only `examples/[id]/page` it exited 1. So the added route is what catches it. After restore and rebuild: exit 0, 18 chunks.

No transcript is quoted in this report beyond the gate output above, which is copied from `$S/gates-final.txt`.

## Judgment calls

- **Script runner.** The repo has no tsx, Node's type stripping can't resolve extensionless imports or `@/`, and `server-only` throws outside `react-server`. I chose the `poc-src` tsx with `--conditions=react-server` over adding a dependency, because `build-eval-index.mts` already runs this way and 05's gate chain already requires that checkout.
- **Leaked-reason literal.** Chunk 03's Gate 2 bans the POC's reason text anywhere in `src/`, tests included. `recorded.ts` therefore matches it by shape (`^\S+ p=\d… \(no LLM reason\)$`), and the test assembles it from the POC's template with the component name built from parts. A comment says so. I did not loosen chunk 03's gate.
- **Confirmed rows.** These are a separate `CheckedRow` type in `view.checkedByYou`, not a coerced `ActionItem`, because `Tier` has no "Not tiered" and Principle 1 forbids inventing one. Confirmations are written through `runner.confirmHeldBack` because `useRun` reads the runner's in-page snapshot first, so a direct `store.save` would leave it stale.
- **Empty state.** It shows only when items, held-back and confirmed lists are all empty. With anything held back, "None needs action" would overclaim.
- **One mapping.** The plan's T002 `fromRecordedRun.ts` is superseded by amendment 1/8: `recorded-view.ts` (shared) plus `recorded.ts` (Node, public side). No second mapping exists.
- **Prefill.** The run's profile opens under the entry with the same profile id: preset first, then saved profiles. An edited preset shows "(edited)", and a rerun of a saved profile replaces that saved profile. A company that is gone, or a preset since removed, opens as "New company…".
- **Example ids** are the full run id, with no collision handling needed. Sidebar labels number a repeated company-week ("run 1/2", oldest first). Example links don't prefetch, so every GC page doesn't request 9 dynamic route payloads.
- **Edit settings** is also offered on interrupted runs (the shared `FailedStep`); the AC only asks for it on failed runs.

## Deviations from the plan

- **T003's `confirmed` field** is on `StoredRun` in `src/lib/runs/types.ts`, where that type lives. `store.ts` stores whatever record it is given and needed no change.
- **T001's `fromRecordedRun.test.ts` and T002's `fromRecordedRun.ts`** are `recorded.test.ts` / `recorded-view.test.ts` and `recorded.ts` / `recorded-view.ts`, per amendments 1 and 8.
- **The HiStates copy "Retry verification" / "only the failed step reruns"** was not used. The button says "Retry", and the message says the run starts again from the beginning (amendment 7). The locked design file was not edited.
- **No shipped record has a leaked reason or a dropped item**, which `grep` over `public/evals/user-view/runs/*` confirmed. Those tests use constructed copies of the real record t6m4 and say so. The held-back and failed screenshots come from seeded IndexedDB.

## Left alone

- **`/examples/<missing>.json` answers 500.** When a generated file is deleted under a running `next start`, it answers 500, not 404, apparently because Next lists public files at boot. This doesn't happen with committed files.
- **The report table scrolls inside its own wrapper at 390 px** (chunk 04's `min-w-[680px]`). The page itself doesn't scroll sideways.
- **The `/runs/new` Gate 5 entry in 04 still carries `?` (optional)**, although the route now exists. It is not mine to tighten.
- **Example pages offer no .md/.json download.** The plan didn't ask for one.
