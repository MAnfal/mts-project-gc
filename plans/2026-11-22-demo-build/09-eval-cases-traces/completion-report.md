# Chunk 09 — Completion Report

Branch `feat/demo-build--eval-cases-traces`, base `8222830` (`git merge-base HEAD feat/plan--demo-build`).
The plan's **Preflight amendment (2026-11-23)** is the contract. Where it overrides the older text, this report
follows the amendment.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/evals/cases.ts` | created | Per-case hits for each setup, graded the POC way (subset grading via `gradedFlags`). Rate-based `change` (Fixed/Regressed, flipped for Skip rows), the filters (`changed`/`stillMissed`/`trapsFlagged`/`all`), `setupTotals` (tp/fn/trapHit/tn/unlabeled, recall, precision), `liveIterationId`, `SPLIT_WORD`. Pure. |
| `src/lib/evals/runFacts.ts` | created | What one repeat did on one case. `filterWhy` covers llm / jev-screened / baseline / failed / none. `judgeView` covers judged / notJudged / nothingToJudge. `traceFacts` gives the event count and `filter.passages` per doc. Pure. |
| `src/lib/evals/traceIndex.ts` | created | Trace viewer logic: `indexTrace` (type counts + value-only haystacks computed once), `filterTrace`, `eventSummary` (POC `summary()` port plus `filter.passages`), `eventLabel`. Pure. |
| `src/lib/evals/runList.ts` | created | Runs page rows from `trace-checks.json`, with labels from run records. `checkSummary` is shared with the panel and the viewer. |
| `src/lib/evals/evalsetInfo.ts` | created | Server-only. Eval-set company name, week label and split, read from `config/` (`evalsets()`, `companies()`) and passed to client pages. |
| `src/lib/evals/loader.ts` | edited | Adds `loadSuiteReport`, `loadTraceChecks` (null for `user-view`, no fetch), `loadAnswerKey`, `loadWeekDocs` and `loadUserViewIndex`, each zod-validated. |
| `src/lib/evals/bundle-build.ts` | edited | Exports `keyedDocs` and a new `trapIds`; `keyTotals` now uses `trapIds`. This is the key normalisation amendment 3 asks to reuse. |
| `src/lib/evals/__fixtures__/shipped.ts` | created | Node reads of the shipped bundle (runs, traces, keys, report), plus `stubFetch`, which moved here from `loader.test.ts`. |
| `src/lib/evals/{cases,runFacts,traceIndex,runList,evalsetInfo}.test.ts`, `loader.test.ts` | created / edited | Tests against real shipped suites and traces (see Tests). |
| `src/components/evals/CasesView.tsx` | created | `/evals/cases` client view: loads the iteration's suite, keys and week titles; renders the header, iteration nav, filters, table and run panel in `AppShell`'s aside. Handles the empty states for 00 (no Before) and 07 (evidence only), and an unknown id. |
| `src/components/evals/CasesTable.tsx` | created | Cases table and filter buttons (≤ 4 choices, each with its count). At < 640 px "What happened" folds into the rule cell. |
| `src/components/evals/RunPanel.tsx` | created | Run 1/2/3 tabs (failed repeats marked), filter reason, collapsible passages, `ChecksBox`, judge votes with collapsible reasoning, and a raw-trace link for every repeat whose event count fills in as each trace streams. |
| `src/components/evals/RunsView.tsx` | created | `/evals/runs`: all 9 suites (newest first) and the 22 example runs. Links render from `trace-checks.json`; labels come from `runs.jsonl.gz`, loaded only for suites near the viewport. |
| `src/components/evals/TraceViewer.tsx` | created | Check summary first, type chips, "Decisions only" / "Show all", value search, fixed 34 px rows virtualized with `@tanstack/react-virtual`, and event JSON in a `<pre>` below the list. |
| `src/app/evals/{cases,runs}/page.tsx`, `src/app/evals/traces/[suiteId]/[runId]/page.tsx` | created | Server pages. They read YAML per request (`await connection()`) and pass names from `config/`. The bundle loads in the browser. |
| `src/components/evals/EvalSidebar.tsx` | edited | Adds a **Runs** item (`active="runs"`). |
| `src/components/evals/EvalSummary.tsx` | edited | Uses `liveIterationId(index) ?? index.iterations[0].id`. Behaviour is unchanged; this consolidates the one-liner the Cases page also needs. |
| `plans/.../08-eval-summary-iterations/no-typed-numbers.sh` | edited | Adds needles for this chunk's figures (`177`, `2,104`/`2104`, `439`, `n/3`, `n trace checks`). |
| `package.json`, `pnpm-lock.yaml` | edited | `@tanstack/react-virtual` `3.14.26`, pinned exactly (`pnpm add -E`). |
| `.claude/resources/project.md` | edited | Layout (routes, components, lib modules), the Convention Map eval row (tests run on shipped data), and two Conventions: per-case grading, and trace links / judges / user-view. Stack and Commands are untouched; the Stack row is left to the lead (see below). |
| `plans/.../09-eval-cases-traces/click-path.js`, `screenshots/` | created | Click-path check script (below) and the screenshots. |

**Stack row for the lead.** 04 owns Stack this wave. The row to add is ``Trace list virtualization (eval view) | `@tanstack/react-virtual` (pinned; pulls `@tanstack/virtual-core` 3.19.11) | 3.14.26``. Both versions were read from `node_modules/@tanstack/react-virtual/package.json` and `pnpm-lock.yaml`. `package.json` and `pnpm-lock.yaml` changed in commit `aa1eff4`, so they may conflict with 04 at merge.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `/evals/cases?iteration=06-passages` lists the cases whose hit rate differs between the setup and `comparedTo` (amendment 4), with columns Rule · company-week, Expected, After, Before, What happened | yes | `cases.test.ts` › "lists the power-bank case … as changed, fixed from 0/3 to 3/3" and › "After and Before equal a direct count over the run records". In the browser: 17 changed rows, headers `Rule · company-week / Expected / After / Before / What happened` (`screenshots/cases-06-desktop.jpeg`) |
| Filters "Changed in 06", "Still missed", "Traps flagged", each counted, plus "All N cases", ≤ 4 choices | yes | Live: `Changed in 06 17 · Still missed 4 · Traps flagged 9 · All 177 cases`. Counts come from `caseCounts` (test › "counts each filter as its definition says"). Iteration 00 hides "Changed" and leaves 3 choices |
| Panel has Run 1/2/3 tabs | yes | `RunPanel` tabs come from `row.after.repeats`; a failed repeat reads "Run 3 · failed" |
| Panel: "Why the filter flagged it", the LLM reason | yes | Taken from `decisions[].llm.reason` (amendment 7). `runFacts.test.ts` › "gives the LLM filter's reason …". Other states: Jev-screened, baseline (no filter step), failed, none. Each has a test |
| Panel: "The N passages it read" when recorded | yes | N comes from the data: `traceFacts` test shows power bank = 3 of 238 chunks and doc `2026-21960` = 2. For setups without passages: "No passages recorded…" (test › "has no passages for a setup that doesn't record them") |
| Panel: trace checks, "All N passed" or the failing ones named | yes | `ChecksBox` ← `checkSummary` (test). Live: "All 8 trace checks passed" (06) and "All 5 …" (00 baseline). The failed run `wqxz` shows 2 failing checks with detail |
| Panel: judge verdicts with votes, reasoning collapsed | yes | `judgeView` tests: judged (3 criteria, votes, 9 reasons), notJudged (repeat 1, amendment 8), and nothingToJudge (judged run that didn't flag the doc) |
| "Raw trace · N events" for every repeat (amendment 1) | yes | Live: `Run 1 · Raw trace · 1,965 events / Run 2 · … 1,926 / Run 3 · … 1,933` (power bank). The failed repeat reads `Run 3 · Raw trace · 453 events (failed run)` |
| Trace page: fetches one gz file, decompresses in the browser, virtualized list smooth at 2,104 events | yes | Measured on `k6tv` (2,104 events) under `pnpm start`: **25 rows in the DOM at the top and 25 at the bottom**. Scrolling in 200 rAF steps gave median frame 8.3 ms, p95 9.0 ms, max 9.8 ms. The last row reached was `#2103 Verdict …` |
| Trace page shows the trace-check summary first | yes | `ChecksBox` renders above the chips (`screenshots/trace-decisions-desktop.jpeg`). User-view: "No trace checks recorded for this run." |
| Trace page: chips by type, search by doc number or word | yes | `traceIndex.test.ts`: type filter, doc-number search, value-only search (a key-only word finds 0), case-insensitive, combined. Live: "Decisions only" gives `Showing 466 of 2,104 events` |
| Trace page: any event's JSON opens on click | yes | Live: clicking `#1624` opens `Event #1624 · filter.decision` with pretty JSON (screenshot) |
| ~~Run report link~~ | moved | Moved to chunk 06 (amendment 2) |
| 390 px: side panel stacks under the table | yes | Cases at 390×844: `scrollWidth 390 = clientWidth 390`, aside top ≥ main bottom, table 340 px in a 340 px container, no element overflowing outside a scroller. Trace page (decisions + JSON open) and Runs page: `scrollWidth 390 = clientWidth 390`. Screenshots `cases-06-390.jpeg`, `runs-390.jpeg` |
| Amendment 11: bare `/evals/cases` → 06; 00 shows its setup alone; 07 has an empty state | yes | Bare URL opens "Cases that changed in 06". `?iteration=00-baseline`: "Cases in 00", filters `Still missed 8 · Traps flagged 5 · All 93 cases`, no Before column. `?iteration=07-next`: "Iteration 07 has no cases … evidence only …", with 0 `runs.jsonl` fetches |
| Amendment 10: loader extensions, user-view = no trace checks | yes | `loader.test.ts` (12 new tests), including › "is null for the example runs … without fetching anything" (`requested` = `[]`) |

### Click paths from `/evals` (amendment 1; SPEC "≤ 3 clicks")

`click-path.js` runs in the page through chrome-devtools `evaluate_script`. Each step is a real `.click()` on a
rendered link or button, and the script counts the clicks and waits for `Raw trace · N events` to render. Results
under `pnpm start -p 3901`:

| Run | Path | Clicks | Landed on / heading |
| --- | ---- | ------ | ------------------- |
| Run 1 (l92, 06 setup, SkyHop Oct 26–30, repeat 0) `…3ou2` | sidebar Runs → "Raw trace" | **2** | `/evals/traces/arena-…-l92/…3ou2` · "Raw trace · 1,965 events" |
| Later repeat (same case, repeat 2) `…8kdc` | sidebar Runs → "Raw trace" | **2** | "Raw trace · 1,933 events" |
| Later repeat via Cases `…8kdc` | sidebar Cases → row 2026-21922 → "Run 3 · Raw trace · 1,933 events" | **3** | same page |
| Failed repeat `…wqxz` (l92, CornerCare Nov 9–13, repeat 2) | sidebar Runs → "Raw trace" | **2** | "Raw trace · 453 events" |
| Failed repeat via Cases `…wqxz` | sidebar Cases → row 2026-22842 → "Run 3 · Raw trace · 453 events (failed run)" | **3** | same page |
| Outside the iteration's setups: w0i `llm-sonnet`, Brightside Nov 9–13, repeat 0 `…cost` | sidebar Runs → "Raw trace" | **2** | `/evals/traces/arena-…-w0i/…cost` · "Raw trace · 598 events" |
| User-view run `…xzrc` (hearth) | sidebar Runs → "Raw trace" | **2** | `/evals/traces/user-view/…xzrc` · "Raw trace · 920 events" |

Negative control: the same script run for a non-existent id (`2026-01-01T00-00-00-000Z_pipeline_none`) threw
`timed out waiting for trace link for 2026-01-01T00-00-00-000Z_pipeline_none`. The Runs page renders 461 trace
links (439 suite runs + 22 example runs, matching `index.counts`).

### Per-case sums vs `report.json`

`cases.test.ts` › "per-case sums reproduce each suite's report.json (subset grading)" runs once per shipped suite
(9 tests, all green). It covers every setup in each `report.json` (18 setup rows). Two assertions per setup:

- Summing the per-case tallies gives exactly `counts.tp / fn / trapHit / tn`.
- `setupTotals` gives the same counts plus `unlabeled`, and recall and precision equal `metrics` to 10 decimal places.

Example, l92: passages tp 50, fn 6, trapHit 12, tn 446, unlabeled 13 → recall 0.8929, precision 0.8065; strict
53/7/15/442/13 → 0.8833/0.7794. These are the figures amendment 3 quotes.

## Tests

The red runs are saved under the chunk-09 scratch dir (`red/`, `mut/`). Kind of red is stated for each.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `cases.test.ts` (36) | **Import red**: `Failed to resolve import "./cases"`, `Tests no tests` (`red/cases-import.txt`) | 36 passed |
| `traceIndex.test.ts` (14), `runList.test.ts` (17) | **Import red**: both files `FAIL … [ file ]` (`red/t001-before-impl.txt`) | 14 / 17 passed |
| `loader.test.ts`, 12 new | **Assertion-level red**: `TypeError: loadSuiteReport is not a function` (and the same for each new loader); the 16 existing tests passed (`red/t001-before-impl.txt`) | 28 passed |
| `runFacts.test.ts` (12) | **Import red**: `Cannot find module './runFacts'` (`red/runFacts-import.txt`) | 12 passed |
| `evalsetInfo.test.ts` (4) | **Not seen red before the module.** I wrote the module first. Red is shown only through the mutations below. | 4 passed |

Contracts shown red against plausible wrong implementations (each mutation reverted with copy-aside/copy-back
and checked with `diff -q`):

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| **Subset grading** (plan's mutation check) | `gradedFlags` also keeps flags outside the key (`keyed.has(d) \|\| true`) | 9 tests, including all 7 multi-setup suites in › "per-case sums reproduce each suite's report.json". l92: `- "trapHit": 12, + "trapHit": 25`. Also › "keeps only the run's flags that the key labels" and › "counts unlabeled flags without penalising precision" |
| "Changed" = hit rate, not count | `rateOrder` compares `a.hits - b.hits` | › "does not call a case changed when only the number of finished repeats differs (2/2 vs 3/3)" (real l92 data) and › "2/2 vs 3/3 is not a change" |
| Skip rows flip direction | `better = 1` for every row | › "for a Skip (trap) row a hit means flagged: … Fixed … Regressed" |
| 0 repeats → "—", not 0/3 | `formatTally` → `${hits}/${finished \|\| 3}` | › "shows — for a setup with no repeats …", › "shows — for a setup whose every repeat failed" |
| Superseded runs excluded | dropped `!r.superseded` in `casesForIteration`; separately in `setupTotals` | › "leaves superseded runs out of every tally"; › setupTotals "leaves superseded runs out" |
| Guards: missing key / eval set | removed each `throw` | › "throws naming the eval set when it has no answer key" (both functions); › "throws naming the run when it records no eval set" |
| Search matches values, not keys | haystack = `JSON.stringify(e)` | › "matches values, not keys: a word that is only ever a key finds nothing" |
| Case-insensitive / trimmed / type filter | dropped `.toLowerCase()`; dropped `.trim()`; ignored `hidden` | the matching `filterTrace` test in each case (2 for `hidden`) |
| runFacts branches | removed failed / baseline branch; `none` → `jev`; `notJudged` → `nothingToJudge`; removed `nothingToJudge` | the one matching test each time (5 mutations, 5 reds) |
| runList guards | removed `runLabel` throw; `checkSummary(null)` returns zeros | › "throws naming the run …"; › "is null when no checks were recorded" |
| evalsetInfo | removed the unknown-company throw; one-month format only | › "throws naming the eval set whose company has no profile"; › "names both months across a month boundary" |
| No typed numbers (6 new needles) | four-step canary per needle (plant `Canary.tsx`, gate fires, remove, gate clean) | all 6 caught with exit 1 and clean after removal (`canaries.txt`) |

The first `keep-superseded` mutation **survived**, because `repeatsOf` filtered superseded runs a second time.
I removed the redundant filter, added the `setupTotals` superseded test, and re-ran: both mutations go red.

## Gates

The final block was run after the last code edit (output saved as `final-gates.txt`; type check is last inside
`gates.sh`):

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Standard set + parity + no-fs-writes | `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh` | `Test Files 30 passed (30) / Tests 380 passed (380)`, build OK, `parity: OK`, `no-fs-writes: OK (64 … files)`, `gates: OK` | **No, it passes on base** (exit 0; 285 tests). It is a regression gate and cannot show this chunk's work. The chunk's own tests run on base fail: 5 files `Cannot find module './cases'` etc. (`basegates/new-tests-on-base.txt`), and the 12 loader tests fail with `TypeError … is not a function` |
| No typed numbers | `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` | `OK (18 component/page files …)` | **No, it passes on base** (it is an absence gate). It was proven per needle by the canaries above |
| Bundle verify | `bash scripts/verify-eval-bundle.sh` | `OK (9 suites, 22 user-view runs, 8 iterations)` | No, it passes on base. `public/evals/` is unchanged by this chunk |
| No `poc/` paths | the plan's `! git ls-tree … \| grep -q '^poc/'` and `! git log … \| grep -q '^poc/'` | passed | **The plan's form is vacuous under `set -e`**, because bash exempts negated pipelines. `bash -c 'set -e; ! echo poc/x \| grep -q "^poc/"; echo still running'` printed "still running". I re-ran it as explicit counts: `poc/ paths in tree: 0; in branch history: 0` |
| New routes exist | `curl -w '%{http_code}'` on base (`pnpm start -p 3902`) and branch (`-p 3901`) | branch: `/evals/cases 200`, `/evals/runs 200`, `/evals/traces/…/k6tv 200` | **Yes**: base `404 / 404 / 404` (`routes/status.txt`) |

Baseline before this chunk, captured in the chunk-09 scratch dir `baseline/`: lint exit 0, 0 warnings; tests 25
files / 285 passed; typecheck exit 0. After: lint 0 errors and 0 warnings, 30 files / 380 tests, typecheck 0. The
delta is +5 test files and +95 tests, with no new diagnostics.

The base tree was a detached worktree at `8222830` in the scratch dir with its own `pnpm install`. The first
attempt symlinked `node_modules`, and Turbopack refused to resolve `next` outside the root, which was not a tree
failure. The worktree was removed afterwards.

## Judgment calls

- **Runs page data source.** The links come from each suite's `trace-checks.json`, which the test shows lists
  exactly the runs in `runs.jsonl.gz` for all 9 suites (~100 KB each). Labels come from `runs.jsonl.gz` (~19 MB
  in total), loaded only for sections within 600 px of the viewport. All checks load before any section renders,
  so lazy loading isn't defeated by short sections. Measured: only `du8` was fetched at the top, and `w0i`/`gip`
  were fetched after scrolling to them. The cleaner fix would add a per-run listing to `index.json`, but that is
  chunk 07's generator, schema and verify, so I didn't do it here. The lead was told; this is a candidate for 07.
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
- **`liveIterationId` returns null, not a throw**, so `EvalSummary` keeps its `?? iterations[0]` fallback
  exactly as before.

## Deviations from the plan

- **The plan's gate block lines `! … | grep -q '^poc/'` cannot fail under `set -e`.** I report the explicit
  check above. The lead may want to fix the block for later chunks.
- **The `evalsetInfo` module was not seen red before it existed.** I wrote it before its test, and its tests were
  shown red only by mutation.
- The plan's Test Plan row for `grade.test.ts` is replaced by the per-suite sums test in `cases.test.ts`
  (amendment 3), which covers all 9 suites, not just l92.

## Left alone

- `AppShell` (chunk 01) puts the whole sidebar above the content at 390 px, so the Cases table starts below the
  fold on a phone. On a narrow screen, picking a case scrolls the stacked panel into view. The shell itself is not
  mine to change.
- `public/evals/index.json` has no per-run listing (see the Runs judgment call). This is a chunk 07 candidate.
- The iteration page (chunk 08) does not link to its Cases view. That could be a one-line follow-up.
