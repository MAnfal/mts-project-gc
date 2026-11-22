---
chunk: 08
title: Eval view — Summary (verdict, CARL, scoreboard, chart) and Iterations
branch: feat/demo-build--eval-summary-iterations
base: feat/plan--demo-build
execution: parallel
depends: [07]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 08 — Eval view: Summary and Iterations

## Context

Chunk 07 shipped the recorded evaluation as static files under `public/evals/`, read
through `src/lib/evals/loader.ts`. Every number in `index.json` is `{value, split, runs,
suite}`. This chunk builds the reviewer-facing eval view's top two levels, from
`design/HiEvalSummary.dc.html` and `design/HiEvalIteration.dc.html`. The user's brief:
**the big picture first, detail only on demand**, told in CARL order (Context, Action,
Result, Learning).

**Numbers come from data, never from the mockups.** The mockup copy is layout and tone.
Its baseline appears as 63/69 in the scoreboard but 71/81 at chart point 00. Both are real,
but they come from different eval-set sizes (12 weeks vs 6). Label every number with its
split and run count, and break the chart line where the eval set changed size.

The CARL prose is narrative the user owns. Put it in `config/eval-story.yaml` as short
templates with `{{placeholders}}` filled from `index.json` (e.g. "Recall
{{baseline.recall}} → {{live.recall}}"). The page renders it, so the user can reword it
without touching code, and the numbers can't drift. Seed the file from the hi-fi's copy.

Targets come from config too. Add an `evalTargets` block to `config/app.yaml`:

- recall ≥ 0.9;
- precision ≥ 0.8;
- dates verified = 1.0;
- same tier across 3 runs = 1.0;
- same relevance across 3 runs ≥ 0.9;
- beats the baseline.

These are the RFC targets. `config/experiment.yaml` is decision-path and stays untouched.

The headline verdict, e.g. "Beats a single-prompt baseline on every measure, and meets 5
of 6 targets", is **computed**: count the targets met by `live` on all weeks, and test
"beats baseline" per measure. If the data says 4 of 6, the page says 4 of 6.

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunk 07 actually shipped. Where the text
below conflicts with these points, these win:

1. **Extend the bundle builder; don't compute in the browser.** Several numbers this
   chunk shows are not in `index.json`. Extend `scripts/build-eval-index.mts` and its
   pure helpers in `src/lib/evals/bundle-build.ts`, keeping POC grading code unmodified.
   Then rebuild with `bash scripts/build-eval-bundle.sh`, which must stay idempotent,
   and extend `src/lib/evals/index-schema.ts` with tests. Add:
   - **per iteration**: `candidate` and `comparedTo` results over that iteration's suite,
     each measure as `{value, split, runs, suite}` for all/dev/test, using the existing
     `setupResult` path (POC `suiteReport`). This replaces the bare
     `iterations[].results` numbers for display.
   - **per suite, per setup** results, so the noise band can be computed.
   - **noise band**: per measure, the spread of the control setup between the two
     iteration-06 suites (`l92` vs `du8`), with both suite ids named. The page words "within
     noise" or "beyond noise" from the computed comparison, never from the mockup. If 06's
     precision gap comes out beyond the band, the page says so.
   - **relevance agreement**: within each (suite, company-week), a keyed doc (relevant ∪
     traps) agrees when every finished, non-superseded repeat flags it, or none does;
     "flagged" means its `document_number` is in `run.items`. Expected for live:
     335/354 = 94.6%. Ship it as `{value, numerator, denominator, runs, suite}` and state
     the definition on the page. The baseline has no repeats, so this measure drops out of
     "beats baseline".
   - **tier agreement**: the RFC's "tier identical across 3 runs" is not `tierRight`.
     Compute real cross-repeat tier agreement over docs flagged in every repeat, ship it
     like relevance agreement, and label `tierRight` as "tier right vs answer key". Never
     show one under the other's name.
   - **evidence presence**: which of `system.diff`, `config.diff` and
     `error-analysis.json` exist per iteration.

   Run `bash scripts/verify-eval-bundle.sh` after the rebuild. The verify check must
   cover the new fields, or say exactly why a field can't be recomputed.
2. **Loader.** Add `loadIteration(id)`, which reads `iteration.json`, and
   `loadIterationFile(id, name)` to `src/lib/evals/loader.ts`. Add a per-suite report
   loader too if amendment 1 doesn't put the data in the index. Show evidence links only
   when the file exists.
3. **Iterations are 00–07.** `07-next` is evidence-only with null result fields; render it
   as "next, not run". `00` has `comparedTo: null`, so render it as the reference point.
   Live = the iteration whose `setup === index.live.setup`.
4. **Story copy.** Put a per-iteration map in `config/eval-story.yaml`: a short label, an
   outcome enum (kept / rejected / not promoted / promoted / reference), and `moved[]`
   with tags. Any number in a "moved" item is either rendered from structured data or
   quoted verbatim from the recorded `notes`, marked as quoted. The YAML holds **no typed
   metric numbers**. Gate 2 scans `config/eval-story.yaml` too, with a planted canary.
5. **Rendering model** (project.md Conventions). A server page reads `eval-story.yaml` and
   the targets per request (`await connection()`). A client component loads the index and
   iteration data through `loader.ts`. No server module reads `public/evals`. Drop
   `generateStaticParams`, and show a not-found state for unknown iteration ids on the
   client.
6. **Sidebar:** Summary, Iterations, Cases. The Cases link points at the route chunk 09
   builds. Models is added by chunk 10.
7. **Dependencies.**
   - Pin `recharts` to 3.8.0 (the POC's version).
   - Add the shadcn components with
     `pnpm exec shadcn add sheet table collapsible tooltip chart`.
   - Add an amber token and series tokens to `globals.css`.
   - Record all of these in project.md Stack.
8. **Two different live figures.** Chart point 06 (l92 only, 35 runs) differs from the
   scoreboard's pooled live (l92+du8, 69 graded). Label both with suite and run count.
9. **Docs.** Adding `config/eval-story.yaml` changes `configHash()`. Update the project.md
   line that names `a113914a72`. Gates also run
   `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh`, and run `parity.sh`
   if `config/` is touched.

## Acceptance Criteria

- Given `/evals`, When the page renders, Then the page shows, in this order:
  - a verdict heading and sub-line, computed;
  - the CARL table (Context | Action | Result | Learning, each with one link down);
  - the Scoreboard (Measure | Target | Live, all weeks | Held-out | Baseline), using
    status badges (met = green, within 1 pt = yellow, missed = red) and a footnote naming
    suites and run counts;
  - the "How it got here" chart.
- Given the chart:
  - one point per iteration 00–06 that has results (07-next is evidence-only; amendment 3), with recall and precision lines;
  - dashed target lines;
  - the line breaks where the eval set changed size (read the evalset count per
    iteration's suite from the index);
  - filled = kept, hollow = dropped, square = baseline;
  - a shaded noise band at the live point;
  - tooltips with exact values, split and runs;
  - clicking a point opens that iteration.
- Given the noise band, When the page renders, Then its size comes from data. It is the control setup's spread
  between the two identical 06 suites, e.g. the difference in recall between
  `jev-sonnet-strict` in `l92` and in `du8`. If the data can't give it, the band is
  omitted, never invented.
- Given `/evals/iterations/06-passages` (and every other iteration), When the page renders, Then it shows:
  - title and outcome badge;
  - Why (hypothesis) | Change;
  - Result against the setup it replaced, as a table of 4 headline measures with "within
    noise" marked when the gap is under the band, plus "All 9 measures, tuning vs
    held-out" in a collapsible;
  - What actually moved, from the iteration's notes and decision, with Fixed / Better /
    Worse tags;
  - Decision;
  - links to Cases (filtered to this iteration), Error analysis (renders
    `error-analysis.json` in a sheet) and Config diff (renders `config.diff` and
    `system.diff` as diffs in a sheet).
- Given the eval sidebar, When the page renders, Then it shows Summary, Iterations, Cases (Models arrives in chunk 10; amendment 6) and an
  ITERATIONS list with outcomes. It is visually distinct from the GC sidebar: the "Evals"
  badge. The GC sidebar does not link to the eval view (decision: separate audience).
- Given 390 px width, When the page renders, Then the tables scroll inside their own box and the page doesn't
  scroll sideways.

## What To Do

### Tasks

- [x] T001 — write failing tests:
  - `src/lib/evals/verdict.test.ts`: `computeVerdict(index, targets)` counts targets met.
    Build a constructed index where precision is 0.79, and check it returns 4 of 6.
  - `src/lib/evals/story.test.ts`: templates fill from the index, and a missing
    placeholder throws.
  - `src/lib/evals/chartSeries.test.ts`: the series breaks where the evalset count
    changes, and the noise band is null when the control isn't in both suites.
- [x] T002 — create `src/lib/evals/verdict.ts`, `story.ts` and `chartSeries.ts`, all pure.
- [x] T003 — create `config/eval-story.yaml` with its zod schema in
  `src/lib/evals/story-schema.ts`, which the eval track owns. Add `evalTargets` to
  `config/app.yaml`, with its schema in `src/lib/config/schemas.ts`. That is the only edit
  this chunk makes to `schemas.ts`.
- [x] T004 [P] — create `src/components/evals/EvalSidebar.tsx`. It composes chunk 01's
  `SidebarNav`; do not edit `src/components/shell/*`.
- [x] T005 [P] — create `src/components/evals/Scoreboard.tsx`, `CarlTable.tsx` and
  `ProgressChart.tsx`. The chart uses Recharts, as the POC did; port what helps from
  `git show poc:poc/src/components/ProgressChart.tsx`. Use GC AI palette tokens: recall
  navy `#173c51`, precision amber `#99652d`.
- [x] T006 — create `src/app/evals/page.tsx` (Summary) and
  `src/app/evals/iterations/[id]/page.tsx`. Rendering per amendment 5: server page reads
  config per request, a client component loads the bundle via `loader.ts`; no
  `generateStaticParams`.
- [x] T007 — create `src/components/evals/DiffSheet.tsx` and `ErrorAnalysisSheet.tsx`,
  using shadcn `Sheet`.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `verdict.test.ts` | verdict computed, not typed | a hard-coded "5 of 6" stays 5 when precision is 0.79 |
| `story.test.ts` | CARL prose filled from data | a template renderer that leaves `{{x}}` unreplaced passes silently |
| `chartSeries.test.ts` › break at evalset change | honest chart | one continuous series connects 03 (6 weeks) to 04 (12 weeks) |
| `chartSeries.test.ts` › no band without data | no invented noise | a constant band renders when the control is missing |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| target exactly met | recall 0.900 vs ≥ 0.9 | `verdict.test.ts` |
| baseline missing a measure | baseline without `datesRight` | `verdict.test.ts` (measure excluded from "beats baseline", not counted as a win) |

## Reuse Audit

Reuse: chunk 07's loader and index schema; chunk 01's `SidebarNav` and `AppShell`; the
POC's `ProgressChart.tsx` and `iterations.ts` (`git show poc:poc/src/lib/iterations.ts`)
for reading iteration files. It has no outcome parsing; outcomes come from
`eval-story.yaml` (amendment 4). New: verdict, story and series helpers.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiEvalSummary.dc.html` | Summary layout and tone |
| `plans/2026-11-22-demo-build/design/HiEvalIteration.dc.html` | Iteration layout |
| `plans/2026-11-22-demo-build/design/gcai-ui-notes.md` | Tokens; table header in stone; status pairs |
| `src/lib/evals/index-schema.ts` | The data contract |
| `git show poc:poc/README.md` | Findings and the meaning of each iteration (for seeding `eval-story.yaml`) |
| `.claude/resources/bibles/swe/testing.md` | Constructed inputs for each guard |

## External Dependencies

- Recharts 3 (as in the POC); shadcn `Sheet`, `Table`, `Badge`, `Collapsible`, `Tooltip`

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: no hard-coded headline numbers in eval components (they must come from data)
if grep -rnE "89\.8|81\.5|72\.6|63%|\\\$0\.52" src/components/evals src/app/evals; then
  echo "FAIL: hard-coded eval number" >&2; exit 1; fi

# Gate 3: decision-path config untouched
bash plans/2026-11-22-demo-build/02-core-libs/parity.sh
```

Gate 2 passes on the base commit because those directories don't exist yet. Plant a canary
(`"89.8%"` in a component), confirm the gate fires, then remove it.

## Deliverables

- [x] `completion-report.md`, committed, with screenshots of the Summary, iteration 06,
      iteration 03 (dropped), and the 390 px width view. It includes the computed verdict
      and noise band, with the data they came from.

## Artifacts Checklist

- ☐ New tests
- — Existing tests: none affected
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout; Conventions: eval prose lives in
  `config/eval-story.yaml`, numbers come only from `public/evals/index.json`)
