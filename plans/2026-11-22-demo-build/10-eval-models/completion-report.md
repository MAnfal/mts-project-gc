# Chunk 10 — Completion Report

Eval view: the Models page (`/evals/models`), the Cases drill-down by `?suite=&setup=`, and the `models`
prose in `config/eval-story.yaml`. Built against the plan's **Preflight amendment (lead, 2026-11-23)**.

Scratch evidence directory (outputs quoted below):
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-10/` (`$S` below).

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/evals/models.ts` | created | `modelComparisons(index)`: one group per suite that ran >1 model, built only from that suite's own `suiteResults` entry (a pooled result is ignored); single-model suites are named. `likeForLike` (same method and prompt set, live model vs another), `lowestRecall` (pipeline setups only, with `onlyOtherVendor`), `compareRows` (signed difference + direction + both run counts). Throws when the live setup or a suite's setup is missing from `index.setups`. |
| `src/lib/evals/models.test.ts` | created | Real shipped bundle + constructed indexes for each guard. |
| `src/lib/evals/story-schema.ts` | edited | `ModelsStorySchema` (all `Prose`, so no typed digits) added to `EvalStorySchema` as `models`. |
| `config/eval-story.yaml` | edited | `models` section: why-block, caveats (key bias with `holds`/`otherwise` variants, price parity, tuning), judge sentence, live-row rule, single-model label. Every number and model label is a placeholder. |
| `src/lib/evals/story.ts` | edited | `modelsContext` / `modelsStory` fill the models prose from `index.json` + the judge panel (`{{models.*}}`, `{{judges.*}}`, `{{measures.*}}`); `shortSuite` moved here from `Scoreboard.tsx` so lib code can use it. |
| `src/lib/evals/story.test.ts`, `story-schema.test.ts` | edited | Constructed branches (directions, unequal runs, key-bias variant, no pair → throws) and the real YAML filled from the real bundle and `config/judges.yaml`. |
| `src/lib/evals/casesState.ts` (+ test) | edited | `?suite=&setup=` → kind `setup`; `unknownSuite`, `unknownSetup` states; `?iteration=` wins with a `note`; `?setup=` alone is ignored with a `note`; `casesQuery` parses search params (repeated/empty → null). `computeCases` takes `{setup, comparedTo}`. |
| `src/lib/evals/cases.test.ts` | edited | Drill-down filter test on w0i / jev-gpt. |
| `src/components/evals/CasesView.tsx` | edited | Renders the new states, the note, "Back to Models"; takes `query` instead of `iterationId`. |
| `src/components/evals/RunPanel.tsx` | **untouched** (identical to base) | An optional `scope` prop was added, then restored to base on the lead's instruction (chunk 06 is editing it). CasesView passes `<case where> · jev-gpt in w0i` through `where` and `iteration="—"`; RunPanel renders "… · jev-gpt in w0i · iteration —". |
| `src/app/evals/cases/page.tsx` | edited | Passes `casesQuery(await searchParams)`; no logic. |
| `src/components/evals/ModelTable.tsx` | created | `ModelTable` (one suite) and `ModelsView` (the page body). Reuses `Value`/`provenance` (Scoreboard), `LoadState`/`useEvalIndex`, `SPLIT_WORD`, `formatWindow`. |
| `src/components/evals/Scoreboard.tsx` | edited | `Value` exported; `shortSuite` re-exported from `story.ts`. |
| `src/app/evals/models/page.tsx` | created | Server page: reads `app.yaml`, `eval-story.yaml`, `judges()` per request; numbers load client-side. |
| `src/components/evals/EvalSidebar.tsx` | edited | "Models" entry + `active: "models"`. |
| `plans/.../08-eval-summary-iterations/no-typed-numbers.sh` | edited | Needles for this page's figures, typed "<n> runs each", typed judge rule, typed model labels. |
| `.claude/resources/project.md` | edited | Layout (models route, cases `?suite=&setup=`, ModelTable, models.ts, eval-story `models`), a Conventions bullet on within-suite model comparison, configHash `fca03a3b9f`. Stack/Commands untouched (owned by chunk 06); no Stack line changed (no new dependency). |

## The computed comparison (shipped bundle)

Multi-model suites found: **one**, `arena-2026-11-21-18-40-w0i` (2 weeks: Nov 2–6 held out, Nov 9–13 tuning;
6 company-weeks; 90 runs, 18 per setup over 5 setups). Single-model (Sonnet 5.5 only): gip, ly9, 64r, cb0, jq4,
27v, l92, du8.

Like-for-like pair (jev+llm, default prompt), all weeks of w0i, 18 runs each:

| | jev-sonnet (Sonnet 5.5) | jev-gpt (GPT-6.2 Sol) | difference |
| --- | --- | --- | --- |
| Recall | 97.6% | 85.7% | 11.9 pts higher on Sonnet |
| Precision | 48.8% | 50.7% | 1.9 pts **lower** on Sonnet |
| Cost per run | $0.159 | $0.103 | $0.056 higher on Sonnet |

Key bias, among the 4 pipeline setups: lowest recall is jev-gpt (85.7%, 18 runs), the only non-Anthropic one;
baseline-sonnet (71.4%) is below it and is named as outside the ranking. All values come from the rendered page
(snapshot during the visual check) and `story-schema.test.ts`.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `/evals/models`: a table per multi-model suite with Model, Method, Recall, Precision, Dates, Judges pass, $/run, s/run, Runs; live highlighted; suite name, weeks and run counts above | yes | `models.test.ts` › "returns one group per multi-model suite…", "rows are w0i's setups…", "marks the live model's rows…"; screenshot `$S/shot-models-desktop.png`. Rows are setups (amendment 4): Setup · Model · Method · prompt columns. Dates column is labelled "Dates match the answer key" (amendment 6); judge pass shows "6 runs judged". |
| "Why Sonnet 5.5" from `eval-story.yaml`, numbers from data; caveats on key bias and price parity | yes, parity **without a date** (lead's ruling) | `story-schema.test.ts` › "states why the live model…", "words the key-bias caveat…", "words price parity as the arena config's list price per token, with no date…" (full sentence: "…list price per token, per the arena config used for suite w0i…"); the per-run costs are in the table and the why-block. |
| Judge panel lists 3 judges and the 2-of-3 rule from `judges.yaml` | yes | `story-schema.test.ts` › "states the judge rule…"; story.test 3-of-5 panel; page lists `judges()` model ids. |
| A model row opens Cases filtered to that suite and setup | yes | Clicked `jev-gpt` at 390 px → `/evals/cases?suite=arena-2026-11-21-18-40-w0i&setup=jev-gpt`, title "Cases for jev-gpt in w0i", filters Still missed 2 / Traps flagged 12 / All 93, run panel "… · jev-gpt in w0i · iteration —" (re-checked after RunPanel was restored) (`$S/shot-cases-drilldown-390.png`). `casesState.test.ts`, `cases.test.ts` drill-down tests. |
| 390 px: each table scrolls in its own box | yes | At 390×844: `documentElement.scrollWidth` 390, table 1091 in a 340 px `overflow-x: auto` box (`$S/shot-models-390.png`). Drill-down page scrollWidth 390. Desktop 1440: table 1145 = box 1145. |

Also checked live: unknown setup (`?suite=…l92&setup=jev-gpt`) → "Suite l92 did not run "jev-gpt"" with l92's two setups linked; `?iteration=06-passages&suite=…&setup=…` → iteration 06 with the note "Showing iteration 06: ?iteration= takes precedence over ?suite= and ?setup=."

## Tests

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `models.test.ts` (20) | Import error: `Cannot find module './models'` — `$S/red-models-import.txt`. Proves absence only; discrimination is shown by the mutations below. | 20 passed |
| `story.test.ts` › modelsContext / modelsStory (4); `story-schema.test.ts` › models (5) | `TypeError: modelsStory is not a function` and `Cannot read properties of undefined (reading 'why')` per test, the rest of each file green — `$S/red-story.txt` | passed |
| `casesState.test.ts` new (9) | Assertion-level: e.g. `expected { kind: 'iteration', …(6) } to deeply equal { kind: 'setup', …(4) }`, `… { kind: 'unknownSuite' }`, `casesQuery is not a function` — `$S/red-casesState.txt` | 23 passed |
| `cases.test.ts` drill-down (2) | Never red: no new code in `cases.ts` was needed (the setup filter already existed). Proven by mutation below. | passed |

Same tests copied onto the **base** source (temp worktree at the merge base): `18 failed | 76 passed` —
`$S/base-new-tests.txt` (all casesState/story/story-schema models tests fail on assertions or missing exports; models.test fails to import; cases.test passes, as expected).

Mutations (script `$S/mutate.sh`: copy aside, perl edit, run, copy back, `cmp` restore; outputs in `$S/mut/`):

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| No cross-suite mixing | filter `() => true` (flat, by model) | "one group per multi-model suite", "rows are w0i's setups", "single-model", "report.json" |
| A pooled result is not a suite's own | `r.suite.includes(s.id)` | "ignores a pooled (multi-suite) result" |
| Numbers equal report.json | each w0i setup takes its *latest* result across suites (`findLast` by setup key) — mutation `latest-result-per-setup` | "each row's numbers equal report.json's…", plus the grouping and ranking tests. (An earlier mutation, `by-setup-not-suite`, only turned constructed tests red, because on the shipped order it picks w0i's own results; it is not counted as evidence for this row.) |
| Single-model suites excluded | `models.length >= 1` | 4 tests incl. "leaves a single-model suite out" |
| Live = live *model* | `i.key === live.setup` | "marks the live model's rows", pair, ranking, direction |
| Guards | delete each throw | "throws when the live setup…", "throws when a suite result names a setup…" |
| Pair = same prompt | drop prompt-set condition | "finds the like-for-like pair", "has no pair when…" |
| Lowest = only other vendor | drop `lowest.length === others.length` | survived at first; added "says not only the other vendor when … a second one does not" → red |
| Ranking over pipelines only | include baseline | 2 ranking tests |
| Direction | swap higher/lower | 2 direction tests |
| Key-bias variant chosen by data | invert holds/otherwise | 3 tests (constructed + real YAML) |
| "the same", run phrasing, cost in $ | each broken | the phrasing tests + real-YAML points |
| Judge count from config | typed `"3"` | survived at first; added a 5-judge panel assertion → red |
| Empty ranking makes no claim | drop `others.length > 0` | "ranks nothing, and claims nothing, when no pipeline setup has a recall" |
| No live-model row in a group | replace the `?? ""` fallback with `!` | "works on a multi-model suite with no live-model row" (TypeError) |
| Seconds difference phrasing | drop the `secondsPerRun` branch | "phrases equal, lower and unmeasured differences…" (`3 s lower`) |
| Note when `?iteration=` names nothing | drop the unknown-iteration wording | "lets ?iteration= win over ?suite=, and says so" (full-string assertion) |
| No pair → loud failure | `cmp.groups[0]` with a fabricated pair | "throws naming a pair placeholder…" |
| casesState precedence/guards/query | iteration-loses, no unknownSuite, no setup-in-suite check, silent `?setup=`, arrays take first | one named test each |
| Drill-down counts only that setup | remove the setup filter in both `casesForIteration` and `repeatsOf` | both new `cases.test.ts` drill-down tests |

Equivalent mutants (survived, reported): removing either one of the two setup filters in `cases.ts` alone (each covers the other when `comparedTo` is null); the "no pair" fallback inside `modelsContext` after `find` already guarantees a pair (dead branch).

## Gates

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Amended gate block (plan › Verification Gates) | the block, fed to `bash -s` with `set -e` (05 `gates.sh` on PORT=3701 → 04/03 gates: lint, test, build, typecheck, parity, no-fs-writes, no-poc, route/bundle gates; then 08 no-typed-numbers, verify-eval-bundle, poc/ count) | exit 0; `Tests 646 passed (646)`, build lists `ƒ /evals/models`, `tsc --noEmit` last inside 05's gates, `no-typed-numbers: OK (20 files…)`, `verify-eval-bundle: OK`, `poc/ paths: tree 0, history 0`, `GATE BLOCK: PASS` — `$S/gates-final.txt`, run after the last code edit | **No — it passes on base** (exit 0, `Tests 606 passed`, `GATE BLOCK: PASS`, `$S/gates-base.txt`). The block as written checks regressions, not this chunk's work. Discriminating evidence instead: the new tests on base (18 failures above), and `/evals/models` answering **404** on a base build vs **200** on this branch (`$S/http/base-models.meta`, `$S/http/models.meta`). |
| New no-typed-numbers needles | `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` | OK | Each needle silent on base and on this tree before its canary; 4-step canary per needle (15 strings in a temp `Canary.tsx`, plus one in `eval-story.yaml`): every one "fired / after removal: clean" — `$S/canaries.txt`. |

Baseline (before any change, `$S/baseline/`): typecheck 0 errors, lint 0 problems, tests 46 files / 606 passed. After: 47 files / 646 passed, typecheck and lint clean (final gate run, after the last code edit, `$S/gates-final.txt`).

### Transcript self-check

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| `/evals/models` on base vs this branch (404 vs 200) | `$S/http/base-models.{html,meta}`, `$S/http/models.{html,meta}` (one `curl -o … -w '%{http_code}'` each) | `diff -q base-models.meta models.meta` exit 1; `diff -q base-models.html models.html` exit 1 (they differ, as claimed) |
| Page values, drill-down counts, 390 px widths | chrome-devtools snapshots / `evaluate_script` returns during the visual check; screenshots `$S/shot-models-desktop.png`, `$S/shot-models-390.png`, `$S/shot-cases-drilldown-390.png` (all three opened and inspected) | values also asserted by `story-schema.test.ts` / `models.test.ts` on the same data |

## Judgment calls

- **Price-parity date** — the only record of the check date is the comment in `config/setups.yaml` (byte-locked, not parsed), and `Prose` forbids digits. I first filled it from w0i's `createdAt`; the lead ruled that is a different fact, so the caveat now reads "…the same AI Gateway list price per token, per the arena config used for suite w0i" with no date, and the computed per-run costs stay. `models.suiteDate` and `ModelGroup.createdAt` were removed as unused.
- **No invented rationale** — the closing line says no recorded decision explains the choice in words; the "why" is only the three computed differences (amendment 9). Precision is stated as lower on Sonnet, because it is.
- **Key-bias sentence is conditional** on the computed `onlyOtherVendor` (vendor = model id prefix); the baseline is named as outside the ranking (amendment 8).
- **Highlight** — all rows on the live model's id (amendment 3), baseline-sonnet included, with the rule stated under the table.
- **Rationale picks the first suite with a like-for-like pair**; with none, `fillTemplate` throws and the page shows the error while still rendering the tables. Observed under `next start`: with `{{models.pair.live}}` changed to `{{models.pair.nope}}` in the YAML (copied aside, restored, `cmp` + `git diff --quiet` clean), the page showed the alert "…Unknown placeholder {{models.pair.nope}}…" with 1 table and the Suite / Single model / Judge panel sections (`$S/shot-models-story-error.png`).
- **`?setup=` without `?suite=`** opens the live iteration with a note; **`?suite=` without `?setup=`** lists the suite's setups. Repeated or empty params are ignored (`casesQuery`).
- **Noise band not applied** to w0i (different eval-set size from the live suites).
- **Judge models shown as ids** from `judges.yaml`: no shipped label source exists for the Opus judge.
- **ModelsView lives in `ModelTable.tsx`** to stay within the plan's file list (same pattern as `EvalSummary.tsx`).

## Deviations from the plan

- Plan text names four models and a jev-only method; per amendment 1 only Sonnet and GPT ran and only those are named.
- T001's "6-week vs 12-week" mutation is covered by the constructed two-suite test plus the flat-grouping mutation (amendment 2).
- `story.ts` holds the model placeholders in a separate `modelsContext` rather than inside `storyContext`: `storyContext` needs a verdict (targets) the Models page does not use.
- AC "price parity, with the date checked": shipped without a date, per the lead (no parsed source for the check date).
- RunPanel: the drill-down has no iteration number, so the panel shows "iteration —" after "jev-gpt in w0i" (passed through `where`) rather than RunPanel changing; lead's instruction.

## Left alone

- The Models page's prose-error alert reuses `LoadState`, whose prefix reads "The recorded evaluation could not be loaded:" (same as the Summary page's story-mismatch error).
- Cases footnote "After and Before count finished repeats…" also shows on the single-setup view (no Before column); pre-existing wording shared with the 00 view.
- `configHash` is `fca03a3b9f` as measured on this branch (base `36599b6308` re-measured to confirm the method); chunk 06's config edits, if any, will move it again at merge.
