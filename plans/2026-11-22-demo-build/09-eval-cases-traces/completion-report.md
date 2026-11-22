# Chunk 09 — Completion Report

Branch `feat/demo-build--eval-cases-traces`, base `8222830` (`git merge-base HEAD feat/plan--demo-build`).
The plan's **Preflight amendment (2026-11-23)** is the contract. Where it overrides the older text, this report
follows the amendment.

**Where the evidence is.**
- Browser measurements were saved by chrome-devtools `evaluate_script` straight to files in `evidence/` (in this
  chunk dir), not copied by hand. That covers click paths, frame times, the 390 px widths, iterations 00–07, the
  run panel, the failed-run checks box and the missing-key state.
- The final gate output is `evidence/final-gates.txt`.
- Red runs, mutation outputs, canaries and the baseline are in the scratch dir `/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-09/` (`red/`, `mut/`,
  `canaries*.txt`, `baseline/`, `basegates/`, `routes/`).

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/evals/cases.ts` | created | Per-case hits for each setup, graded the POC way (subset grading via `gradedFlags`). Rate-based `change` (Fixed/Regressed, flipped for Skip rows), the filters (`changed`/`stillMissed`/`trapsFlagged`/`all`), `setupTotals` (tp/fn/trapHit/tn/unlabeled, recall, precision), `liveIterationId`, `SPLIT_WORD`. Pure. |
| `src/lib/evals/runFacts.ts` | created | What one repeat did on one case. `filterWhy` covers llm / jev-screened / baseline / failed / none. `judgeView` covers judged / notJudged / nothingToJudge. `traceFacts` gives the event count and `filter.passages` per doc. Pure. |
| `src/lib/evals/traceIndex.ts` | created | Trace viewer logic: `indexTrace` (type counts + value-only haystacks computed once), `filterTrace`, `eventSummary` (POC `summary()` port plus `filter.passages`), `eventLabel`. Pure. |
| `src/lib/evals/runList.ts` | created | Runs page rows from the `runs-index.json` listings plus each run's trace-check summary; `evalsetOfRun` maps a listed run to its eval set for naming. `checkSummary` is shared with the panel and the viewer. |
| `src/lib/evals/evalsetInfo.ts` | created | Server-only. Eval-set company name, week label and split, read from `config/` (`evalsets()`, `companies()`) and passed to client pages. |
| `src/lib/evals/loader.ts` | edited | Adds `loadSuiteReport`, `loadTraceChecks` (null for `user-view`, no fetch), `loadAnswerKey`, `loadWeekDocs` and `loadRunsIndex` (suite or `user-view`), each zod-validated. |
| `src/lib/evals/bundle-build.ts` | edited | Exports `keyedDocs` and a new `trapIds`; `keyTotals` now uses `trapIds`. This is the key normalisation amendment 3 asks to reuse. Adds `runsIndex()`, the pure shaping of the run listings (lead decision, below). |
| `src/lib/evals/index-schema.ts` | edited | `RunsIndexSchema` (strict rows: runId, setup, profileId, window, repeat, status, superseded). |
| `scripts/build-eval-index.mts`, `scripts/verify-eval-bundle.sh` | edited | The index build writes `suites/<id>/runs-index.json` and `user-view/runs-index.json`. `--check` (run by verify) recomputes them byte for byte. |
| `public/evals/suites/*/runs-index.json`, `public/evals/user-view/runs-index.json` | generated | 10 listings, 124 KB in all, from `bash scripts/build-eval-bundle.sh` (commit `cb6d93a`, data only). |
| `src/lib/evals/__fixtures__/shipped.ts` | created | Node reads of the shipped bundle (runs, traces, keys, report), plus `stubFetch`, which moved here from `loader.test.ts`. |
| `src/lib/evals/{cases,runFacts,traceIndex,runList,evalsetInfo}.test.ts`, `loader.test.ts` | created / edited | Tests against real shipped suites and traces (see Tests). |
| `src/components/evals/CasesView.tsx` | created | `/evals/cases` client view: loads the iteration's suite, keys and week titles; renders the header, iteration nav, filters, table and run panel in `AppShell`'s aside. Handles the empty states for 00 (no Before) and 07 (evidence only), and an unknown id. |
| `src/components/evals/CasesTable.tsx` | created | Cases table and filter buttons (≤ 4 choices, each with its count). At < 640 px "What happened" folds into the rule cell. |
| `src/components/evals/RunPanel.tsx` | created | Run 1/2/3 tabs (failed repeats marked), filter reason, collapsible passages, `ChecksBox`, judge votes with collapsible reasoning, and a raw-trace link for every repeat whose event count fills in as each trace streams. |
| `src/components/evals/RunsView.tsx` | created | `/evals/runs`: all 9 suites (newest first) and the 22 example runs. Every row, label and link comes from the `runs-index.json` listings, with check counts from `trace-checks.json`. It never downloads `runs.jsonl.gz`, and the 461 links don't prefetch. |
| `src/components/evals/TraceViewer.tsx` | created | Check summary first, type chips, "Decisions only" / "Show all", value search, fixed 34 px rows virtualized with `@tanstack/react-virtual`, and event JSON in a `<pre>` below the list. |
| `src/app/evals/{cases,runs}/page.tsx`, `src/app/evals/traces/[suiteId]/[runId]/page.tsx` | created | Server pages. They read YAML per request (`await connection()`) and pass names from `config/`. The bundle loads in the browser. |
| `src/components/evals/EvalSidebar.tsx` | edited | Adds a **Runs** item (`active="runs"`). |
| `src/components/evals/EvalSummary.tsx` | edited | Uses `liveIterationId(index) ?? index.iterations[0].id`. Behaviour is unchanged; this consolidates the one-liner the Cases page also needs. |
| `plans/.../04-run-and-report/gates.sh` | edited (lead request, after merging chunk 04) | Gate 5 (Decision 9) used to grep all of `.next/static`, so it failed on the eval view's own chunks, which legitimately contain `jevProbability`. It now scans only the chunks GC routes load. That list is `build-manifest.json` rootMain/polyfill files, plus each GC route's `page_client-reference-manifest.js` (`entryJSFiles` and client-module `chunks`, read for Next 16.4.6), plus any chunk those name, transitively. The GC routes are `/`, `/runs/[id]` and, once it exists, `/runs/new`. The gate fails if a required route has no manifest, resolves to 0 chunks, or names a missing chunk. Proofs are in `evidence/gate5-proofs.txt`: the old gate fails on this tree and the new one passes it (13 chunks); `GC_ROUTES=runs/nope/page`, an empty manifest, or only an optional absent route each exit 1; a `typesafe-ai` canary planted in `RunView.tsx` fails the gate, and after the canary was removed and the app rebuilt it passes again |
| `plans/.../08-eval-summary-iterations/no-typed-numbers.sh` | edited | Adds needles for this chunk's figures (`177`, `2,104`/`2104`, `439`, `n/3`, `n trace checks`). |
| `package.json`, `pnpm-lock.yaml` | edited | `@tanstack/react-virtual` `3.14.26`, pinned exactly (`pnpm add -E`). |
| `.claude/resources/project.md` | edited | Layout (routes, components, lib modules, `runs-index.json`), the Convention Map eval row (tests run on shipped data), and three Conventions: per-case grading, list runs from `runs-index.json`, and rebuild under Node 24. Stack and Commands are untouched; the Stack row is left to the lead (see below). |
| `plans/.../09-eval-cases-traces/click-path.js`, `screenshots/`, `evidence/` | created | Click-path check script, screenshots, and the saved browser measurements. |

**Stack row for the lead.** 04 owns Stack this wave. The row to add is ``Trace list virtualization (eval view) | `@tanstack/react-virtual` (pinned; pulls `@tanstack/virtual-core` 3.19.11) | 3.14.26``. Both versions were read from `node_modules/@tanstack/react-virtual/package.json` and `pnpm-lock.yaml`. `package.json` and `pnpm-lock.yaml` changed in commit `aa1eff4`, so they may conflict with 04 at merge.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `/evals/cases?iteration=06-passages` lists the cases whose hit rate differs between the setup and `comparedTo` (amendment 4), with columns Rule · company-week, Expected, After, Before, What happened | yes | `cases.test.ts` › "lists the power-bank case … as changed, fixed from 0/3 to 3/3" and › "After and Before equal a direct count over the run records". In the browser: 17 changed rows, headers `Rule · company-week / Expected / After / Before / What happened` (`screenshots/cases-06-desktop.jpeg`) |
| Filters "Changed in 06", "Still missed", "Traps flagged", each counted, plus "All N cases", ≤ 4 choices | yes | Live: `Changed in 06 17 · Still missed 4 · Traps flagged 9 · All 177 cases`. Counts come from `caseCounts` (test › "counts each filter as its definition says"). Iteration 00 hides "Changed" and leaves 3 choices |
| Panel has Run 1/2/3 tabs | yes | `RunPanel` tabs come from `row.after.repeats`; a failed repeat reads "Run 3 · failed" |
| Panel: "Why the filter flagged it", the LLM reason | yes | Taken from `decisions[].llm.reason` (amendment 7). `runFacts.test.ts` › "gives the LLM filter's reason …". Other states: Jev-screened, baseline (no filter step), failed, none. Each has a test |
| Panel: "The N passages it read" when recorded | yes | N comes from the data: `traceFacts` test shows power bank = 3 of 238 chunks and doc `2026-21960` = 2. For setups without passages: "No passages recorded…" (test › "has no passages for a setup that doesn't record them") |
| Panel: trace checks, "All N passed" or the failing ones named | yes | `ChecksBox` ← `checkSummary` (test). Live: "All 8 trace checks passed" (06; `evidence/run-panel-power-bank.json`) and "All 5 …" (00 baseline). The failed run `wqxz` reads "2 of 8 trace checks failed", naming both checks with their detail (`evidence/trace-failed-run-wqxz.json`) |
| Panel: judge verdicts with votes, reasoning collapsed | yes | `judgeView` tests: judged (3 criteria, votes, 9 reasons), notJudged (repeat 1, amendment 8), and nothingToJudge (judged run that didn't flag the doc) |
| "Raw trace · N events" for every repeat (amendment 1) | yes | Live: `Run 1 · Raw trace · 1,965 events / Run 2 · … 1,926 / Run 3 · … 1,933` (power bank). The failed repeat reads `Run 3 · Raw trace · 453 events (failed run)` |
| Trace page: fetches one gz file, decompresses in the browser, virtualized list smooth at 2,104 events | yes | `evidence/trace-virtualization-k6tv.json`, measured on the final build. **28 rows in the DOM at the top and 28 at the bottom of 2,104.** Scrolling in 200 rAF steps gave median frame 8.3 ms, p95 9.2 ms, max 11.1 ms. The last row reached was `#2103 Verdict …` |
| Trace page shows the trace-check summary first | yes | `ChecksBox` renders above the chips (`screenshots/trace-decisions-desktop.jpeg`). User-view: "No trace checks recorded for this run." |
| Trace page: chips by type, search by doc number or word | yes | `traceIndex.test.ts`: type filter, doc-number search, value-only search (a key-only word finds 0), case-insensitive, combined. Live: "Decisions only" gives `Showing 466 of 2,104 events` |
| Trace page: any event's JSON opens on click | yes | Live: clicking `#1624` opens `Event #1624 · filter.decision` with pretty JSON (screenshot) |
| ~~Run report link~~ | moved | Moved to chunk 06 (amendment 2) |
| 390 px: side panel stacks under the table | yes | `evidence/width-390-cases.json`: `docScrollWidth 390 = docClientWidth 390`, aside top 4213 ≥ main bottom 4205, table 340 in a 340 container, 0 elements overflowing outside a scroller. `width-390-trace.json` (decisions filter + JSON open, `pre` doesn't scroll sideways) and `width-390-runs.json`: 390 = 390. Screenshots `cases-06-390.jpeg`, `runs-390.jpeg` |
| Amendment 11: bare `/evals/cases` → 06; 00 shows its setup alone; 07 has an empty state | yes | Bare URL opens "Cases that changed in 06". `evidence/iterations-00-07.json` renders all eight iterations: 00 is "Cases in 00" with filters `Still missed 8 · Traps flagged 5 · All 93 cases` and columns `Flagged`/What happened (no Before); 01–06 each show a table, "Changed in NN" counts 27/22/9/7/9/17, and no alert; 07 shows "Iteration 07 has no cases" (an earlier check saw 0 `runs.jsonl` fetches) |
| A case computation that throws shows an error, not a blank page | yes | `evidence/cases-missing-key-state.json`: with `index.json` patched in the page to drop one l92 eval set, the page shows "The recorded evaluation could not be loaded: no answer key for eval set brightside_2026-10-19_2026-10-23" and no table |
| No console errors | yes | `list_console_messages` was empty on the final build for Cases (bare URL), Runs and the trace page. An earlier "form field should have an id or name" issue was fixed (`name="q"` on the trace search) |
| Amendment 10: loader extensions, user-view = no trace checks | yes | `loader.test.ts` (14 new tests), including › "is null for the example runs … without fetching anything" (`requested` = `[]`) and the three `loadRunsIndex` tests |
| Runs page names and links every run from the listings, never `runs.jsonl.gz` (lead decision) | yes | `evidence/runs-page-listings.json`, measured after scrolling to the bottom: 461 "Raw trace" links, **0 rows without a label**, **0 `runs.jsonl.gz` requests**, and 0 `/evals/traces/*` prefetches. The `/evals/*` requests were `index.json`, 9 × (`runs-index.json` + `trace-checks.json`) and `user-view/runs-index.json`. `runList.test.ts` checks that each shipped listing equals `runsIndex(runs.jsonl.gz)` and matches the trace-checks keys, for all 9 suites and user-view, at < 30 KB each |

### Click paths from `/evals` (amendment 1; SPEC "≤ 3 clicks")

`click-path.js` runs in the page through chrome-devtools `evaluate_script`. Each step is a real `.click()` on a
rendered link or button, and the script counts the clicks and waits for `Raw trace · N events` to render. Results
under `pnpm start -p 3901` were saved by the tool to `evidence/click-1…7-*.json`.

After the Runs page moved to the listings, the five Runs-page paths (1, 2, 4, 6, 7) and the negative control
were re-recorded with the final script and the final build. Each file now carries `"ok":true`. The two Cases
paths (3, 5) are from the earlier run; the Cases page did not change.

| Run | Path | Clicks | Landed on / heading |
| --- | ---- | ------ | ------------------- |
| Run 1 (l92, 06 setup, SkyHop Oct 26–30, repeat 0) `…3ou2` | sidebar Runs → "Raw trace" | **2** | `/evals/traces/arena-…-l92/…3ou2` · "Raw trace · 1,965 events" |
| Later repeat (same case, repeat 2) `…8kdc` | sidebar Runs → "Raw trace" | **2** | "Raw trace · 1,933 events" |
| Later repeat via Cases `…8kdc` | sidebar Cases → row 2026-21922 → "Run 3 · Raw trace · 1,933 events" | **3** | same page |
| Failed repeat `…wqxz` (l92, CornerCare Nov 9–13, repeat 2) | sidebar Runs → "Raw trace" | **2** | "Raw trace · 453 events" |
| Failed repeat via Cases `…wqxz` | sidebar Cases → row 2026-22842 → "Run 3 · Raw trace · 453 events (failed run)" | **3** | same page |
| Outside the iteration's setups: w0i `llm-sonnet`, Brightside Nov 9–13, repeat 0 `…cost` | sidebar Runs → "Raw trace" | **2** | `/evals/traces/arena-…-w0i/…cost` · "Raw trace · 598 events" |
| User-view run `…xzrc` (hearth) | sidebar Runs → "Raw trace" | **2** | `/evals/traces/user-view/…xzrc` · "Raw trace · 920 events" |

Negative control (`evidence/click-negative-control.json`): for a non-existent id the script returned
`{"ok":false,"clicks":1,…,"error":"timed out waiting for trace link for 2026-01-01T00-00-00-000Z_pipeline_none"}`. The Runs page renders 461 trace
links (439 suite runs + 22 example runs, matching `index.counts`).

### Per-case sums vs `report.json`

`cases.test.ts` › "per-case sums reproduce each suite's report.json (subset grading)" runs once per shipped suite
(9 tests, all green). It covers every setup in each `report.json` (18 setup rows). Two assertions per setup:

- Summing the per-case tallies gives exactly `counts.tp / fn / trapHit / tn`.
- `setupTotals` gives the same counts plus `unlabeled`, and recall and precision equal `metrics` to 10 decimal places.

Example, l92: passages tp 50, fn 6, trapHit 12, tn 446, unlabeled 13 → recall 0.8929, precision 0.8065; strict
53/7/15/442/13 → 0.8833/0.7794. These are the figures amendment 3 quotes.

## Tests

The red runs are in the scratch dir named at the top (`red/`, `mut/`). The kind of red is stated for each.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `cases.test.ts` (36) | **Import red**: `Failed to resolve import "./cases"`, `Tests no tests` (`red/cases-import.txt`) | 36 passed |
| `traceIndex.test.ts` (14) | **Import red**: `FAIL … [ file ]` (`red/t001-before-impl.txt`) | 14 passed |
| `runList.test.ts` (17) | **Import red**: `FAIL … [ file ]` (`red/t001-before-impl.txt`). The rewrite for the listings went red on the `runRows`/`evalsetOfRun` imports and on the missing shipped `runs-index.json` (`red/runs-index-before.txt`) | 17 passed |
| `bundle-build.test.ts` › runsIndex (3) + RunsIndexSchema (1) | **Assertion-level red**: `TypeError: runsIndex is not a function` and `expected [Function] to throw … 'run r9 records no company or window'` (`red/runs-index-before.txt`; 21 failures across the three files) | 38 passed |
| `loader.test.ts`, 12 new | **Red in this worktree before `loader.ts` was touched** (not in the base worktree): `TypeError: loadSuiteReport is not a function`, and the same for each new loader. The 16 existing tests passed (`red/t001-before-impl.txt`) | 28 passed |
| `runFacts.test.ts` (12) | **Import red**: `Cannot find module './runFacts'` (`red/runFacts-import.txt`) | 12 passed |
| `evalsetInfo.test.ts` (4) | **Not seen red before the module.** I wrote the module first. Red is shown only through the mutations below. | 4 passed |

Contracts shown red against plausible wrong implementations (each mutation reverted with copy-aside/copy-back
and checked with `diff -q`):

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| **Subset grading** (plan's mutation check) | `gradedFlags` also keeps flags outside the key (`keyed.has(d) \|\| true`) | 9 tests, including all 7 multi-setup suites in › "per-case sums reproduce each suite's report.json". l92: `- "trapHit": 12, + "trapHit": 25`. Also › "keeps only the run's flags that the key labels" and › "counts unlabeled flags without penalising precision" |
| "Changed" = hit rate, not count | `rateOrder` compares `a.hits - b.hits` | › "does not call a case changed when only the number of finished repeats differs (2/2 vs 3/3)" (real l92 data) and › "2/2 vs 3/3 is not a change" |
| A side with 0 finished repeats is never a change | `rateOrder` compares rates with `/(finished \|\| 1)` and breaks ties by `finished` (`mut/zero-finished-changed.txt`) | 4 tests, including › "shows — for a setup with no repeats … never calls it changed". The earlier explicit `if (!a.finished \|\| !b.finished) return null` was **dead code**: the cross product is already 0. It was removed, and the comment now states why |
| Example runs have no trace checks | deleted `if (suiteId === USER_VIEW) return null` in `loadTraceChecks` (`mut/loader-user-view.txt`) | › loadTraceChecks "is null for the example runs … without fetching anything": `GET /evals/suites/user-view/trace-checks.json returned 404` |
| Skip rows flip direction | `better = 1` for every row | › "for a Skip (trap) row a hit means flagged: … Fixed … Regressed" |
| 0 repeats → "—", not 0/3 | `formatTally` → `${hits}/${finished \|\| 3}` | › "shows — for a setup with no repeats …", › "shows — for a setup whose every repeat failed" |
| Superseded runs excluded | dropped `!r.superseded` in `casesForIteration`; separately in `setupTotals` | › "leaves superseded runs out of every tally"; › setupTotals "leaves superseded runs out" |
| Guards: missing key / eval set | removed each `throw` | › "throws naming the eval set when it has no answer key" (both functions); › "throws naming the run when it records no eval set" |
| Search matches values, not keys | haystack = `JSON.stringify(e)` | › "matches values, not keys: a word that is only ever a key finds nothing" |
| Case-insensitive / trimmed / type filter | dropped `.toLowerCase()`; dropped `.trim()`; ignored `hidden` | the matching `filterTrace` test in each case (2 for `hidden`) |
| runFacts branches | removed failed / baseline branch; `none` → `jev`; `notJudged` → `nothingToJudge`; removed `nothingToJudge` | the one matching test each time (5 mutations, 5 reds) |
| runList guard | `checkSummary(null)` returns zeros | › "is null when no checks were recorded" |
| Listing guards and shape | removed the `runsIndex` company/window throw; `superseded: false` always; `loadRunsIndex` ignoring `USER_VIEW` (`mut/runs-index-mutations.txt`) | › "throws naming the run when it records no company or window"; › "keeps each run's … superseded flag"; › "reads the example runs' listing from user-view/" |
| Verify recomputes the listings | hand-edited `ly9/runs-index.json` (`"repeat": 0` → `1`), ran `verify-eval-bundle.sh`, restored, ran again | `FAIL: suites/arena-2026-11-21-21-04-ly9/runs-index.json differs from the recomputation over the shipped bundle` (exit 1), then `verify-eval-bundle: OK` (exit 0). Before the data was regenerated, verify failed with `runs-index.json is missing` for every suite (`basegates/verify-before-regen.txt`) |
| evalsetInfo | removed the unknown-company throw; one-month format only | › "throws naming the eval set whose company has no profile"; › "names both months across a month boundary" |
| No typed numbers (6 new needles) | four-step canary per needle (plant `Canary.tsx`, gate fires, remove, gate clean) | all 6 caught with exit 1 and clean after removal (`canaries.txt`). The `n/3` needle was then narrowed to `(^\|[^-])\b[0-9]/3\b`, so a Tailwind fraction can't trip it, and re-canaried (`canaries-2.txt`): `After 3/3` and `0/3` caught, `w-1/3 aspect-4/3` not caught, clean after each |

The first `keep-superseded` mutation **survived**, because `repeatsOf` filtered superseded runs a second time.
I removed the redundant filter, added the `setupTotals` superseded test, and re-ran: both mutations go red.

## Gates

The final block was run after the last code edit (`evidence/final-gates.txt`; type check is last inside
`gates.sh`). The poc check in that run uses the explicit form below:

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Standard set + parity + no-fs-writes | `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh` | `Test Files 30 passed (30) / Tests 386 passed (386)`, build OK, `parity: OK`, `no-fs-writes: OK (64 … files)`, `gates: OK` | **No, it passes on base** (exit 0; 285 tests). It is a regression gate and cannot show this chunk's work. The chunk's own tests run on base fail: 5 files `Cannot find module './cases'` etc. (`basegates/new-tests-on-base.txt`). The 12 loader tests failed with `TypeError … is not a function` in this worktree before `loader.ts` was touched, not in the base worktree |
| No typed numbers | `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` | `OK (18 component/page files …)` | **No, it passes on base** (it is an absence gate). It was proven per needle by the canaries above |
| Bundle verify | `bash scripts/verify-eval-bundle.sh` | `OK (9 suites, 22 user-view runs, 8 iterations)`; it now also recomputes the 10 listings | It passes on base, which has no listing check. On this branch it fails without the regenerated data (`runs-index.json is missing` × 10) and on a hand edit (above) |
| Rebuild idempotence | `bash scripts/build-eval-bundle.sh` on the committed tree (Node 24.13.0) | exit 0, then `git status` empty (`rebuild-idempotence.txt` in the scratch dir) | — |
| No `poc/` paths | the plan's block, fixed to explicit counts (`a=$(git ls-tree … \| grep -c '^poc/' \|\| true)`, same for `git log`, `if [ "$a" -ne 0 ] …; exit 1`) | tree 0, history 0 | It passes on base (no `poc/` paths there either). The new form can fail: fed a listing containing `poc/y`, it printed `FAIL: poc/ paths (tree 1, history 0)` and exited 1. The old `! … \| grep -q` form kept running after a match under `set -e` |
| New routes exist | `curl -w '%{http_code}'` on base (`pnpm start -p 3902`) and branch (`-p 3901`) | branch: `/evals/cases 200`, `/evals/runs 200`, `/evals/traces/…/k6tv 200` | **Yes**: base `404 / 404 / 404` (`routes/status.txt`) |

Baseline before this chunk, captured in the scratch dir's `baseline/`: lint exit 0, 0 warnings; tests 25
files / 285 passed; typecheck exit 0. After: lint 0 errors and 0 warnings, 30 files / 386 tests, typecheck 0. The
delta is +5 test files and +101 tests, with no new diagnostics.

The base tree was a detached worktree at `8222830` in the scratch dir with its own `pnpm install`. The first
attempt symlinked `node_modules`, and Turbopack refused to resolve `next` outside the root, which was not a tree
failure. The worktree was removed afterwards.

## Judgment calls

- **Runs page data source (lead decision).** The first version rendered links from `trace-checks.json` and lazily
  loaded labels from `runs.jsonl.gz` (~19 MB in all). The lead chose the cleaner option: the index build writes a
  small `runs-index.json` per suite and one for user-view. The pure shaping lives in `bundle-build.ts`, verify
  recomputes it, and the data was committed separately. The Runs page now reads only the listings and
  `trace-checks.json`. I added a `superseded` flag to the lead's six fields, because `runs.jsonl.gz` keeps
  superseded runs and the page should mark them. The example runs now come from `user-view/runs-index.json`, so
  `loadUserViewIndex` was removed and the page no longer shows their item counts.
- **Rebuild under Node 24.13.0.** My first rebuild ran under Node 26.5.0 (homebrew first on a hand-set `PATH`). It
  changed all 9 `runs.jsonl.gz` files: gunzipped content identical (same md5), deflate bytes different. Under the
  project's Node 24.13.0 the rebuild touches only the 10 new listings, and a second rebuild leaves the tree clean.
  This is recorded in `project.md` Conventions.
- **Rule titles come from the frozen weeks** (`loadWeekDocs`, a loader the amendment does not list). Answer keys
  carry no titles, and run items carry titles only for flagged docs, so a trap that was never flagged would have
  no name. The cost is 4 week files (about 115 KB each gzipped on the wire).
- **"Still missed"** means a Flag row the iteration's setup missed in at least one finished repeat. **"Traps
  flagged"** means a Skip row flagged in at least one repeat. The sum of the per-row misses is `fn`.
- **Tags.** A Fixed or Regressed tag, plus Trap (Skip rows) or Indirect (indirect Flag rows), then the key's
  reason, clamped to 2 lines.
- **Trace counts** for every repeat link come from reading each repeat's trace (3 gz files for each case selected,
  cached per session). Trace-check detail text ("957 events…") was not reliable as a count. Links render at once
  and the count fills in.
- **Virtualization**: `@tanstack/react-virtual` with fixed 34 px rows and the opened JSON in a separate panel
  below. No row is ever measured. I picked it over hand-rolled windowing because it is maintained and small, and
  the amendment asked for it. It needs the `react-hooks/incompatible-library` lint suppression (without it, lint
  warns 1×).
- **Trace chips start with every type shown.** The POC hid `jev.call` and `stage.start` by default. Showing all
  2,104 events is the stress case the AC names. "Decisions only" is one click.
- **Case computation errors are caught.** `casesForIteration` throws for a missing key, and `CasesView` shows that
  message in the load state instead of crashing the render (see AC table).
- **`liveIterationId` returns null, not a throw**, so `EvalSummary` keeps its `?? iterations[0]` fallback
  exactly as before.

## Deviations from the plan

- **The plan's gate block lines `! … | grep -q '^poc/'` cannot fail under `set -e`.** I report the explicit
  check above. On the lead's request, this chunk's `plan.md` gate block now uses the explicit-count form.
- **The `evalsetInfo` module was not seen red before it existed.** I wrote it before its test, and its tests were
  shown red only by mutation.
- The plan's Test Plan row for `grade.test.ts` is replaced by the per-suite sums test in `cases.test.ts`
  (amendment 3), which covers all 9 suites, not just l92.

## Left alone

- `AppShell` (chunk 01) puts the whole sidebar above the content at 390 px, so the Cases table starts below the
  fold on a phone. On a narrow screen, picking a case scrolls the stacked panel into view. The shell itself is not
  mine to change.
- The iteration page (chunk 08) does not link to its Cases view. That could be a one-line follow-up.
