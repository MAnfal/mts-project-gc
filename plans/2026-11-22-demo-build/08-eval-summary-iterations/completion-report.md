# Chunk 08 — Completion Report

Branch `feat/demo-build--eval-summary-iterations`, base `ee5d13c`. Evidence files sit under `evidence/`
in this directory. Every path below is relative to that directory unless it starts with `src/`, `config/`,
`scripts/` or `public/`.

## Computed headline and key numbers

All of these are read from the regenerated `public/evals/index.json`. None is typed anywhere. The
raw figures are emitted by a command, not transcribed: `node evidence/key-numbers.mjs` writes
`evidence/key-numbers.txt`. The table below rounds that output.

| What | Value | Basis (split · runs · suites) |
| ---- | ----- | ----------------------------- |
| Verdict heading | "Beats a single-prompt baseline on every measure, and meets 5 of 6 targets" | `computeVerdict` × `config/app.yaml` evalTargets. Pinned on the real data in `story-schema.test.ts` |
| Live recall | 0.898 (yellow: 0.2 pts short of 0.9) | all · 69 graded · l92 + du8. Held-out 0.882 over 35 runs (red) |
| Live precision | 0.815 (met) | all · 69 · l92 + du8. Held-out 0.726 over 35 runs (red) |
| Dates match the answer key | 1.0 (met). Baseline 0.789 | all · 69 / 36 |
| Same tier across repeats (new) | 40/40 = 1.0 (met). Baseline 7/10 | docs flagged in every repeat · 69 / 36 runs |
| Same relevance across repeats (new) | **335/354 = 0.946** (met). Held-out 167/176. Baseline 160/177 = 0.904 | keyed docs · 69 / 36 runs |
| Cost per run | $0.192 vs baseline $0.520, so live costs 37% of the baseline | all runs · 72 / 36 |
| Beats baseline | 6 of 6 compared measures won, 0 excluded | recall, precision, dates, tier agreement, relevance agreement, cost |
| Noise band | control `jev-sonnet-strict`, l92 vs du8: recall 0.8833 vs 0.8421 (**4.1 pts**), precision 0.7794 vs 0.8000 (**2.1 pts**) | all · 35 / 35 runs |
| 06 vs control, l92 | recall +0.95 pts → **within noise** (band 4.12); precision +2.70 pts → **beyond noise** (band 2.06); dates no change; cost +57.7%, shown as +58% | all · 35 / 35 |
| Eval set | 3 companies × 4 weeks (2 dev, 2 test), 12 company-weeks, 20 relevant, 157 traps | manifest + keys |

Outcome of the noise band: 06's precision gap falls outside the band, and the page says "beyond noise"
(`screenshots/iteration-06-desktop.jpg`). Iterations 01–03 ran on 6-company-week suites. They show the gap with
no noise verdict, plus a note explaining why (`screenshots/iteration-03-desktop.jpg`).

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/evals/bundle-build.ts` | edited | Pure helpers: `metricOf`/`runCountsOf` (an empty split gives null over 0 runs), `repeatAgreement`, `noiseBand`, `keyTotals`, plus the build's lookups: `splitOfEvalset`, `iterationRuns`, `requireKeys`, `bandControl`. Each throw sits here with an off-fixture test. The `SetupReport` type moved here from the script |
| `scripts/build-eval-index.mts` | edited | `setupResult` takes the eval sets it must cover, handles dev-only splits and adds agreement. The index gains `iterations[].measured` and `.evidence`, `suiteResults`, `noiseBand` and `evalSet`. The script holds no new throw of its own: each decision it makes calls a tested `bundle-build.ts` helper. POC grading code is unmodified |
| `plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` | created | Gate 2 as a runnable script: the plan's grep over components, pages and `config/eval-story.yaml`. It fails if a path is missing, so it can't pass by scanning nothing. The project.md Convention Map row cites it |
| `src/lib/evals/index-schema.ts` | edited | `AgreementNumberSchema` (value must equal numerator/denominator), `SplitAgreementSchema`, the agreement fields on `SetupResultSchema`, `measured`/`evidence`, `NoiseBandSchema`, `suiteResults`, `evalSet` |
| `public/evals/index.json` | regenerated | Output of `bash scripts/build-eval-bundle.sh`, in its own commit (`976e62f`). Grew from 48 KB to 353 KB (19.7 KB gzipped) |
| `src/lib/evals/loader.ts` | edited | `loadIteration(id)` (a loose zod record) and `loadIterationFile(id, name)` |
| `src/lib/config/schemas.ts` | edited | `EvalTargetsSchema`, plus `EvalAppConfigSchema` for the slice of app.yaml the eval view reads. This is the only edit to this file |
| `config/app.yaml` | edited | `evalTargets` block holding the RFC targets and `nearMiss: 0.01` |
| `config/eval-story.yaml` | created | Verdict templates, CARL rows, measure labels, and per iteration a label, outcome and `moved[]` with number-free quote anchors |
| `src/lib/evals/story-schema.ts` | created | `EvalStorySchema`. `Prose` rejects any digit outside `{{…}}` |
| `src/lib/evals/verdict.ts` | created | `computeVerdict`, `targetStatus`, `measureOf`, and the scoreboard measure list |
| `src/lib/evals/story.ts` | created | `fillTemplate` (throws on an unknown or unclosed placeholder), `storyContext`, `verdictHeading`, `resolveQuote`, formatters |
| `src/lib/evals/chartSeries.ts` | created | `chartSeries` (segments, breaks, band at the live point), `noiseVerdict`, `bandApplies` |
| `src/lib/evals/__fixtures__/eval-index.ts` | created | Constructed index pieces for the tests |
| `src/components/evals/*` | created | EvalSidebar, EvalSummary (with `useEvalIndex`), CarlTable, Scoreboard, ProgressChart, IterationView, DiffSheet, ErrorAnalysisSheet. Chart markers are SVG `<a href>` links with an aria-label (keyboard-reachable). A story/data mismatch or a quote that won't resolve shows its message instead of crashing the page |
| `src/app/evals/page.tsx`, `src/app/evals/iterations/[id]/page.tsx` | created | Server pages: `await connection()` and readYaml per request. The bundle loads on the client. There is no `generateStaticParams` |
| `src/components/ui/{sheet,table,collapsible,tooltip,chart}.tsx` | generated | `pnpm exec shadcn add sheet table collapsible tooltip chart`. shadcn also added `card.tsx` as a registry dependency; it is unused and was deleted. shadcn skipped `button.tsx`, which is unchanged |
| `package.json`, `pnpm-lock.yaml` | edited | `recharts` pinned at `3.8.0`, read from `node_modules/recharts/package.json` |
| `src/app/globals.css` | edited | `--amber`, `--series-recall` (#173c51), `--series-precision` (#99652d) and their `--color-*` aliases |
| `.claude/resources/project.md` | edited | Layout, Convention Map (new row for the eval view), Conventions (eval prose/number rule, agreement/noise rule, configHash `c017e8bc89`). Stack and Commands were not touched (see "For the lead") |
| `plan.md` | edited | Ticked T001–T007 and the deliverable |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `/evals` shows, in order: computed verdict and sub-line, CARL table (one link each), Scoreboard with status badges and a footnote naming suites and runs, then the chart | yes | `screenshots/summary-desktop-1440.jpg`. Verdict pinned in `story-schema.test.ts` › "fills every template… heading reads off the data". Badge rule in `verdict.test.ts` › targetStatus. Prose numbers carry their run counts. Sub-line (from the final build): "…0.2 pts short of its 90% target over all weeks (69 runs). On the held-out weeks (35 runs), precision is 72.6%…". Result row: "All weeks, 36 baseline runs vs 69 live: recall 63.3% → 89.8%…" |
| Chart: one point per iteration 00–06, recall and precision, dashed targets, break at the eval-set change, filled/hollow/square markers, band at the live point, tooltips with value/split/runs, click opens the iteration | yes | `chartSeries.test.ts` (segments, rows, markers, band). `screenshots/summary-chart-tooltip-03.jpg` shows the tooltip "Recall 97.6% all weeks · 18 runs · arena-…-gip". On the final build the a11y snapshot lists 14 marker links, e.g. `link "03 Prompt fixes, rejected: Recall 97.6% (all weeks · 18 runs · arena-2026-11-21-20-41-gip). Open this iteration." url=…/evals/iterations/03-strict-v2`. Clicking it navigated to `/evals/iterations/03-strict-v2` |
| Noise band size comes from data; omitted if the data can't give it | yes | Builder `noiseBand` returns null without both suites (`bundle-build.test.ts`). `chartSeries` returns band null without `index.noiseBand`. A constant-band mutation goes red (see the mutation table below) |
| `/evals/iterations/<id>`: title, outcome badge, Why / Change, a 4-measure result table with within/beyond noise, a collapsible for all 9 measures, what moved with Fixed/Better/Worse, decision, and links to Cases, Error analysis (sheet) and Config diff (sheet) | yes | Final build: `screenshots/iteration-06-desktop.jpg`, `iteration-03-desktop.jpg`, `iteration-06-config-diff-sheet.jpg` (sheet 672 px wide), `iteration-06-error-analysis-sheet.jpg` (672 px), `iteration-07-next.jpg` ("Evidence for the next change (not run)", badge "Next, not run", only an Error analysis button, no Cases link). Evidence links render only when `index.iterations[].evidence` says the file exists. An unknown id shows a not-found state (`iteration-unknown-id.jpg`, build 4; that page hasn't changed since) |
| Eval sidebar: Summary, Iterations, Cases, the ITERATIONS list with outcomes, an "Evals" badge, and no link from the GC sidebar | yes | Screenshots. `src/app/page.tsx` is unchanged and has no `/evals` link: `git diff ee5d13c -- src/app/page.tsx` is empty |
| 390 px: tables scroll in their own box, no page scroll | yes | `evaluate_script` on `/evals` at 390×844: `{"scrollWidth":390,"clientWidth":390,"noHorizontalScroll":true,"scrollBoxes":[[560,340],[640,340],[620,300]]}`. `/evals/iterations/06-passages` gave scrollWidth 390 before and after opening the Config diff sheet (sheet 293 px; diff boxes scroll inside, 944/258). `screenshots/summary-390.jpg` and `iteration-06-config-diff-sheet-390.jpg` are from the final build. `iteration-06-390.jpg` is from build 3; it predates the quote-error wrapper, which doesn't change rendering |

## Tests

Baseline before this chunk: 14 files, 114 tests, lint and typecheck clean (`baseline/`). After chunk 08 alone:
18 files, 193 tests. The lead then merged `feat/plan--demo-build` (chunk 03) into this branch as `869c891`. The
final gate run on that merged tree passes 283 tests (`gates/final-gates.txt`); the extra 90 are chunk 03's.

| Test file | Red run (before implementation) | Green run |
| --------- | ------------------------------- | --------- |
| `bundle-build.test.ts` (13 new) | `red/bundle-build-1-import.txt`: 13 failed, each `TypeError: metricOf/repeatAgreement/noiseBand/keyTotals is not a function` (absence) | `red/bundle-build-2-green.txt`: 25 passed |
| `index-schema.test.ts` (6 new) | `red/index-schema-1.txt`: 6 failed. The 3 schema tests failed on the old schema's values; the 3 shipped-bundle tests failed against the pre-rebuild `index.json` (wrong value) | Green after the schema change and the rebuild |
| `loader.test.ts` (6 new) | `red/loader-1.txt`: 6 failed, `loadIteration is not a function` | `red/loader-2-green.txt`: 16 passed |
| `verdict.test.ts` | `red/verdict-1-import.txt`: cannot find module (import red) | `red/verdict-2-green.txt`: 10 passed |
| `story.test.ts` | `red/story-1-import.txt`: import red | `red/story-2-green.txt`: 14 passed |
| `chartSeries.test.ts` | `red/chartSeries-1-import.txt`: import red | `red/chartSeries-2-green.txt`: 12 passed |
| `bundle-build.test.ts` round 2 (`splitOfEvalset`, `iterationRuns`, `requireKeys`, `bandControl`) | `red/round2-builder-red.txt`: 9 failed, `… is not a function` | `red/round2-builder-green.txt`: 49 passed (with index-schema) |
| `story.test.ts` round 2 (run count in the miss sentence) | `red/round2-story-runs-red.txt`: 5 failed. `Unknown placeholder {{runs}}` hit the fixture template that now asks for it, so this is a wrong-value red, not an import red | Green after `storyContext` passes `runs` |
| `index-schema.test.ts` › dev-only suite null held-out split | Passed on first run, since the data was already rebuilt. Its guard is proved by the `metricOf` mutation below | — |
| `story-schema.test.ts` | Written after the YAML, so its first run was green (`red/story-schema-1.txt`). Its red evidence is the mutations below and the base-tree run (`gates/base-tests.txt`: cannot find `./story-schema`) | 8 passed |

An import red proves only that a module was absent. To show the tests discriminate, I applied one mutation
per contract and per guard, each to a plausible wrong implementation, and restored the file byte-for-byte
after each (`mutations/run.py`, `mutations/run-round2.py`). All 34 went red; the full list with the failing
test names is in `mutations/summary.md`, `mutations/summary-band.md` and `mutations/summary-round2.md`:

| Contract / guard | Mutation | What went red |
| ---------------- | -------- | ------------- |
| Verdict computed, not typed | `met: 5` | "counts 4 of 6 when precision drops to 0.79…" (+4 more) |
| Target hit exactly is met | `value > min` | "meets a target hit exactly (recall 0.900 vs >= 0.9)" (+6) |
| Measure the baseline lacks is not a win | push as `win` | "leaves a measure the baseline lacks out…" (+2) |
| Empty comparison doesn't beat the baseline | drop `length > 0` | "does not claim to beat a baseline it could not compare on anything" |
| Unknown placeholder throws | return `""` | "throws on a placeholder the index cannot fill" |
| Unclosed placeholder throws | delete the check | "throws on an unclosed placeholder" |
| Quote start must be unique / end must follow / field must exist | loosen each | the matching `resolveQuote` test |
| Break at the eval-set change | always the same segment | "starts a new segment…", "…no line joins 02 to 03" |
| No invented band | constant band when `noiseBand` is null | "is null when the index has no noise band" |
| Missing story entry / unknown suite throw | `continue` | "throws when an iteration has no story entry, or its suite is not in the index" |
| Gap equal to the band is beyond noise | `<=` | noiseVerdict test |
| Band only for same-size suites | drop the size check | "applies the band only to suites the same size…" |
| Single-repeat groups not counted; superseded runs left out | remove each filter | "leaves out failed and superseded runs, and groups left with fewer than two repeats" |
| "None flagged" agrees | `n === reps.length` only | "counts a keyed doc as agreeing…", "groups by suite…" |
| Missing key / missing arena-eval-set throw | `continue` | the two throw tests |
| Empty split → null over 0 runs | delete the guard | "gives null over 0 runs for a split the suite never ran" |
| Band null without both suites | delete the guard | "is null when the control did not run in both suites" |
| Agreement value = numerator/denominator | disable the refine | "rejects an agreement value that is not its numerator over its denominator" |
| No digits in YAML prose | refine always true | both digit tests in `story-schema.test.ts` |
| Story covers the shipped iterations | delete 07-next from the YAML | "has a story entry for exactly the iterations the bundle ships" |
| Quotes resolve against the real record | change an anchor | "resolves every moved item's quote verbatim…" |
| Heading follows the targets | precision target 0.82 | "fills every template… heading reads off the data" (it becomes 4 of 6) |
| Unknown eval set / iteration without setup or suite / missing keys throw (builder) | return or `continue` instead | each matching throw test in `bundle-build.test.ts` |
| Evidence-only iteration not measured | drop the guard | "is null for an evidence-only iteration" |
| Band control is the *last* live iteration's | `find` instead of `findLast` | "is what the last iteration that ran the live setup was compared to" |
| Miss sentence carries its run count | drop `runs` | 6 `story.test.ts` tests (Unknown placeholder `{{runs}}`) |

## Gates

All ran after the last code edit, in one `bash -s` block with typecheck last. Output is in
`gates/final-gates.txt`, which ends `ALL GATES PASSED`.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Lint / tests / build / typecheck | `pnpm lint && pnpm test && pnpm build && … pnpm typecheck` | Lint 0 problems; 283 passed on the merged tree; build routes `ƒ /evals`, `ƒ /evals/iterations/[id]`; tsc clean | Base tree (`git archive ee5d13c` plus this chunk's tests): `gates/base-tests.txt` shows 7 files failed, 25 tests, e.g. `Cannot find module './verdict'`, `loadIteration is not a function`, `expected undefined to be 'jev-sonnet-strict'` (no `noiseBand` in the base index) |
| Gate 2: no hard-coded numbers | `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` (the plan's grep, plus `config/eval-story.yaml` per amendment 4) | `no-typed-numbers: OK (10 component/page files + config/eval-story.yaml scanned)` | **Fails on base**: `FAIL: src/components/evals does not exist`, non-zero exit (`gates/no-typed-numbers-base.txt`). The plan's raw grep alone passes vacuously on base: grep exits 2 on missing paths (`gates/base-gate2.txt`), which is why the script checks paths first. Canaries: `gates/no-typed-numbers-canaries.txt` has 15 probes (5 needles × Scoreboard.tsx, page.tsx, eval-story.yaml); each fired, was restored and came back clean |
| Gate 3: parity | `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh` | `parity: OK` | `config/` changes are only `app.yaml` (not on the decision path) and the new `eval-story.yaml` |
| Bundle verify | `bash scripts/verify-eval-bundle.sh` | `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)` | Base passes, since its own bundle is consistent. Falsification by hand-editing new fields: relevance numerator 340 gives exit 1, `index.json differs from the recomputation` (`gates/verify-canary-agreement.txt`); noise-band precision 0.05 gives exit 1 (`gates/verify-canary-band.txt`); after restoring, clean (`gates/verify-after-canary.txt`). Every new field is in `index.json`, so `--check` recomputes it byte-for-byte |
| Idempotent rebuild | `bash scripts/build-eval-bundle.sh` | Rebuilt three times. Second: `git status --porcelain` empty (`gates/status-after-rebuild-2.txt`). Third, after the builder refactor: `public/` unchanged (`gates/status-after-rebuild-3.txt`, 0 lines), then verify OK (`gates/verify-2.txt`) | — |
| No fs writes | `bash plans/…/02-core-libs/no-fs-writes.sh` | `no-fs-writes: OK (40 non-test source files under src/ scanned)` | — |
| No `poc/` paths | `git ls-tree -r --name-only HEAD \| grep -c '^poc/'`; `git log --name-only --format= ee5d13c..HEAD \| grep -c '^poc/'` | 0 and 0 | — |
| Tracing | `.next/server/app/evals/**/page.js.nft.json` | Both include `config/eval-story.yaml`; neither names `public/evals` (count 0) | — |

## For the lead: Stack and Commands lines (not edited here, because chunk 03 owns them this wave)

- Stack, Charts: `recharts` `3.8.0` (pinned exactly; same as the POC's `package.json`; read from
  `node_modules/recharts/package.json`).
- Stack, Components: shadcn components added: `sheet`, `table`, `collapsible`, `tooltip`, `chart` (via
  `pnpm exec shadcn add sheet table collapsible tooltip chart`). No new runtime package besides recharts.
  The generated files import `cn` from the `cn` package, not `@/lib/utils`.
- Commands: no change.

## Judgment calls

- **The baseline is graded on agreement too.** The amendment said the baseline has no repeats. Measured: 3
  finished repeats in each of the 6 eval-set groups of both w0i and cb0. So the baseline gets agreement numbers
  (relevance 0.904, tier 0.70), and a measure leaves "beats baseline" only when its value is null. I told the
  lead mid-chunk.
- **Groups with fewer than two finished repeats are skipped.** One repeat has nothing to agree with. On the
  shipped data no group has fewer than two (live: 3 groups with 2 and 21 with 3), so 335/354 matches the
  preflight script exactly.
- **Tier agreement is computed over every doc flagged in every repeat, keyed or not.** A tier is shown for
  every surfaced item, so its stability matters for all of them.
- **Dates row is labelled "Dates match the answer key".** suiteReport's `datesRight` is `dateCorrect` in
  `grade.ts` (a shown date matches the key), not "verified against source". I mapped the "dates verified =
  1.0" target onto it and labelled it honestly.
- **Noise verdicts only for suites the same size as the band's.** The band comes from 12-company-week,
  35-run suites. 03's own notes record the control swinging 93% → 60% test recall between 6-week suites.
  So 01–03 show the gap with no verdict (`bandApplies`).
- **"Beats baseline" is strict.** Every compared measure must be a win: a tie or a loss fails it, and so does
  having nothing to compare. Cost counts as a measure where lower is better.
- **The `next` outcome added to the enum** for 07, rendered as "next, not run" (amendment 3).
- **CARL and measure labels carry no digits.** "Same tier across repeats", not "across 3 runs", because three
  live groups had only 2 finished repeats.
- **Recorded text shown verbatim.** Why, Change and Decision render `hypothesis`, `change` and `decision` from
  `iteration.json` rather than rewritten copy, so nothing in them can drift from the record. Notes sit in a
  collapsible.
- **Screenshots are committed** under `evidence/screenshots/` (JPEG, at most 1440 px wide), not kept
  scratch-only as the brief said. The plan's deliverable asks the committed report to include them.
- **The Iterations nav item links to the first iteration (00)**, since there is no iterations index route.
- **schemaVersion stays 1.** The bundle has no external consumers, and bumping it would break chunks 09 and
  10's fixtures for no gain.

## Deviations from the plan

**Corrections to the lead's preflight amendment** (lead confirmed both on 2026-11-23):

1. **Amendment 1 said "the baseline has no repeats".** It has 3 finished repeats in every company-week group of
   both w0i and cb0. So the baseline's relevance and tier agreement are computed from those repeats
   (0.904 and 0.70), and a measure is dropped from "beats baseline" only when its value is null.
2. **Amendment/mockup wording "dates verified".** suiteReport's `datesRight` checks a shown date against the
   answer key (`grade.ts` `dateCorrect`), not against the primary source. The row is labelled "Dates match the
   answer key", and the footnote says it is not a check against the source.


- **"The baseline has no repeats"**: it does (above). Measurement wins.
- **Noise band per measure, all-weeks split only.** It applies to the all-weeks result table and chart.
- **`suiteResults` grows the index to 353 KB** (19.7 KB gzipped), because the amendment asked for every
  setup in every suite. Iteration results duplicate those entries for the consumer's convenience.
- **`AppConfigSchema` was left unchanged.** `evalTargets` is read through a separate `EvalAppConfigSchema`.
  Making it required in `AppConfigSchema` would have broken chunk 01's `load.test.ts` fixtures, which write an
  app.yaml without it.
- **An evidence-only iteration has no "Cases that changed" link.** There are no results to filter by.

## Surprises

- The mockup's numbers mostly match the data, except two. Cost change is +58%, not +57% (0.195/0.124). The
  live cost is $0.192, not $0.20 (suiteReport divides by all 72 runs, as chunk 07 noted).
- 06's precision gap (+2.7 pts) is beyond the 2.1-pt band, while the recorded decision calls the overall gain
  "inside the control's A/A band". That decision used a different band: four suites, misses and trap hits per
  18 runs. The page shows the computed comparison and the recorded decision verbatim, side by side.
- `/evals/cases` returns 404 (Next prefetch, seen in network requests) until chunk 09 lands.
- `next start`'s process is `next-server`, so `pkill -f "next start"` doesn't stop it. Use
  `lsof -ti tcp:<port> | xargs kill`.

## Left alone

- The generated shadcn files import `cn` from the `cn` package and use `bg-black/10` on the sheet overlay
  (generated code, not edited).
- The `/evals/cases` route (chunk 09) and Models (chunk 10).
