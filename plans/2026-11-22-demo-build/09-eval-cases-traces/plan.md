---
chunk: 09
title: Eval view — Cases, run side panel, and gz trace viewer
branch: feat/demo-build--eval-cases-traces
base: feat/plan--demo-build
execution: parallel
depends: [08]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 09 — Eval view: Cases, run panel, and trace viewer

## Context

Chunk 08 built the Summary and Iterations pages. This chunk builds the deepest drill-down
levels from `design/HiEvalCases.dc.html`:

- **Cases:** company-week × rule rows with hits per setup.
- **Run side panel:** what one repeat did on one case.
- **Trace viewer:** a run's full JSONL trace.

The design rule is "summary first, raw transcript only when clicked". A reviewer must
reach any run's raw trace in at most 3 clicks from `/evals`.

Data comes from chunk 07's bundle (`src/lib/evals/loader.ts`):

- `suites/<id>/runs.jsonl.gz`: run records with `decisions`, `items`, `config`;
- `suites/<id>/report.json`: the POC `suiteReport`;
- `suites/<id>/trace-checks.json`: per-run deterministic checks;
- `suites/<id>/traces/<runId>.jsonl.gz`: event types are listed in `git show
  poc:poc/SCHEMA.md`, e.g. `filter.decision`, `jev.call`, `llm.call`, `verify.doc`,
  `tier.assign`, `owner.assign`, `action.write`, `judge.verdict`;
- `config/evalsets/keys/*.json`: the answer keys, with `relevant[]` and `details{}` per
  document.

The eval view is for reviewers, so internal names (Jev, model IDs) are allowed here. This
is the opposite of the GC view.

**Per-case hits.** Check whether `report.json` already carries rule-level results by
reading its keys: `setups`, `evalsets`, `totals`, `weights`, plus anything nested. Use it
if it does. Otherwise compute hits with a port of the POC's `grade.ts` (`git show
poc:poc/src/lib/grade.ts`) as a pure module, `src/lib/evals/grade.ts`. Its output must
match `report.json`'s per-setup totals for the same suite; a test asserts this.

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunks 07 and 08 actually merged. Where the
text below conflicts with these points, these win:

1. **The 3-click metric covers every run.** Add a **Runs** page, `/evals/runs`, linked
   from the eval sidebar. It lists every shipped run, grouped by suite (all 9 suites)
   plus the user-view runs, each row with a direct "Raw trace" link. The path is
   `/evals` → Runs (click 1) → that run's trace link (click 2). In the Cases panel, show
   a trace link for **every** repeat in the panel itself, so no extra tab click is needed.
   The completion report lists the click path for: Run 1, a later repeat, a failed
   repeat, a run outside the iteration's setups, and a user-view run.
2. **No "Open this run's report" in this chunk.** Chunk 04's `ReportView` isn't merged
   (same wave). The reviewer-facing report link moves to chunk 06, which builds the
   recorded-run adapter for example runs. Drop that AC bullet here; the trace link stays.
3. **Don't port `grade.ts`.** `report.json` has no per-case data, but item presence alone
   reproduces recall and precision exactly (l92: 0.8929/0.8065 and 0.8833/0.7794). Compute
   hits in `src/lib/evals/cases.ts`, reusing `bundle-build.ts`'s key normalisation
   (`keyedDocs`/trap handling), not a second copy. Test that per-case sums equal each
   suite's `report.json` counts (tp/fn/trapHit), so the subset-grading mutation has a test
   to fail.
4. **Definitions.**
   - A case "changed" when its **hit rate** (hits / finished repeats) differs between the
     two setups, not its hit count. l92 has failed repeats, so 2/2 vs 3/3 is not a change.
   - "Hit" for a Skip (trap) row means flagged.
   - Run tabs show the iteration's candidate setup.
5. **Guards.** Keep the constructed 0-repeat case ("—", not 0/3), and add an
   unequal-denominator case (2 vs 3 finished).
6. **Passages.** Render "the passages it read" from `filter.passages` (`{document_number,
   chunks, picked[{index,p,text}]}`) when recorded. There may be 2, or none (top-N only),
   not always 3.
7. **Filter reason** comes from `runs.jsonl.gz` `decisions[].llm.reason`. The trace is
   needed only for passages and the event count.
8. **Judges.** Only repeat 0 is judged (24 of 72 live runs carry `panel`). `judge.verdict`
   has votes but no reasoning; the "why" is in `run.panel.judges[].votes`. Show "not
   judged" for later repeats.
9. **Trace size.** The largest shipped trace has 2,104 events, so the virtualized list must
   stay smooth at that size, not ~1,000.
10. **Loader.** Extend `src/lib/evals/loader.ts`, with tests, with:
    - `loadSuiteReport(suiteId)`;
    - `loadTraceChecks(suiteId)`;
    - `loadAnswerKey(evalsetId)`, from `/evals/config/evalsets/keys/<evalset>.json`.

    Don't name it `loadKey`, which collides with `src/lib/config.ts`. The user-view runs
    have no `trace-checks.json`, so handle that as "no trace checks recorded".
11. **Routes and sidebar.** The eval sidebar already links `/evals/cases`; add Runs. Bare
    `/evals/cases` defaults to the live iteration (06). `00-baseline` (no comparedTo)
    shows its setup alone, and `07-next` (evidence-only) shows an explanatory empty
    state.
12. **TraceTimeline.** Port only the POC's `summary()` logic.
    - Don't add `react-json-view-lite`; render JSON in a `<pre>`, or another
      token-styled view.
    - No Tailwind palette classes; use theme tokens.
    - Add `@tanstack/react-virtual`, pinned exactly, with a Stack row.
13. **Gates** are replaced; see Verification Gates below.

## Acceptance Criteria

- Given `/evals/cases?iteration=06-passages`, When the page renders, Then the table lists the cases whose hit
  count differs between the iteration's setup and its `comparedTo` setup in that
  iteration's suite. Columns: Rule · company-week (tuning / held-out) | Expected
  (Flag/Skip) | After | Before | What happened (Fixed / Regressed / Trap / Indirect tag
  plus the key's short reason).
  - The filter buttons are "Changed in <iteration>", "Still missed" and "Traps flagged",
    each with a computed count, plus "All N cases". There are no more than 4 visible
    choices.
- Given a selected case, When the page renders, Then the right panel shows:
  - Run 1 | 2 | 3 tabs;
  - "Why the filter flagged it": the LLM reason from `filter.decision`;
  - "The 3 passages it read": the passages from the trace, when the setup used them;
  - trace checks: "All N passed" or the failing ones named;
  - the judge panel verdicts for this item, with votes and reasoning collapsed;
  - "Raw trace · N events" for every repeat (amendment 1; the report link moves to chunk 06, amendment 2).
- Given "Raw trace", When the page renders, Then `/evals/traces/<suiteId>/<runId>`:
  - fetches the one gz file, decompresses it in the browser, and renders a virtualized
    list (it must stay smooth at 2,104 events, the largest shipped trace; amendment 9);
  - shows the trace-check summary first;
  - has filter chips by event type and a search box (document number or word);
  - opens any event's JSON on click.
- ~~Given the run report link …~~ Moved to chunk 06 (amendment 2).
- Given 390 px width, When the page renders, Then the side panel stacks under the table.

## What To Do

### Tasks

- [x] T001 — write failing tests:
  - `src/lib/evals/cases.test.ts`: `casesForIteration(suite, iteration, keys)` on a
    **real** shipped suite, using the 06 suite `arena-2026-11-21-22-52-l92`. Assert that
    the power-bank case (`2026-21922`, SkyHop Oct 26–30) is listed as changed, and that
    each case's After/Before equals a direct count over the runs.
  - ~~`src/lib/evals/grade.test.ts`~~ (no port; amendment 3) — per-setup recall and precision
    equal `report.json` for the same suite.
  - `src/lib/evals/traceIndex.test.ts`: filter and search over a real shipped trace.
- [x] T002 — create `src/lib/evals/cases.ts` and `src/lib/evals/traceIndex.ts` (pure), and
  ~~`src/lib/evals/grade.ts`~~ (no port; amendment 3).
- [x] T003 [P] — create `src/components/evals/CasesTable.tsx` and `RunPanel.tsx`.
- [x] T004 [P] — create `src/components/evals/TraceViewer.tsx`. Virtualize with a small
  windowing approach or `@tanstack/react-virtual`; explain the choice. You may reuse
  parts of `git show poc:poc/src/components/TraceTimeline.tsx`.
- [x] T005 — create `src/app/evals/cases/page.tsx` and
  `src/app/evals/traces/[suiteId]/[runId]/page.tsx`, and add Cases to `EvalSidebar`.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `cases.test.ts` › power-bank listed as changed | changed-case filter on real data | a filter comparing totals rather than per-case hits misses it |
| `cases.test.ts` › After/Before = direct count | per-case counting | counting per run instead of per (case, repeat) double-counts |
| `grade.test.ts` | ported grader matches the POC's recorded report | any drift in the subset-grading rule (flags outside the key aren't penalised) changes precision |
| `traceIndex.test.ts` | filter and search | a search on `JSON.stringify` of the whole event matches keys, not values |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| case with 0 repeats for one setup | one setup missing for a week | `cases.test.ts` (shows "—", not 0/3) |
| unequal finished repeats | 2 vs 3 finished (l92 failed runs) | `cases.test.ts` (rate-based "changed"; amendment 4) |
| empty trace | 0 events | `traceIndex.test.ts` |

## Reuse Audit

Reuse: chunk 07's loader and `bundle-build.ts` key normalisation; chunk 08's
`EvalSidebar`; the POC's `RuleGrid.tsx` and `TraceTimeline.tsx` (`summary()` only) as
sources. No `grade.ts` port (amendment 3); no `ReportView` (amendment 2). New: case
selection and trace indexing.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiEvalCases.dc.html` | Cases + run panel layout |
| `git show poc:poc/SCHEMA.md` | Trace event formats |
| `git show poc:poc/src/lib/grade.ts` | Subset grading, the rules the counts must follow |
| `.claude/resources/bibles/swe/testing.md` | Tests run against real shipped suites and traces |
| `.claude/resources/bibles/swe/patterns/migration-verification.md` | A ported grader must reproduce the recorded report exactly |

## External Dependencies

- Browser `DecompressionStream("gzip")`, via chunk 07's loader; optionally
  `@tanstack/react-virtual`.

## Verification Gates

```bash
set -e
bash plans/2026-11-22-demo-build/03-pipeline/gates.sh   # lint, test, build, typecheck, parity, no-fs-writes
bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh
bash scripts/verify-eval-bundle.sh
# no poc/ paths
! git ls-tree -r --name-only HEAD | grep -q '^poc/'
! git log --name-only --format= feat/plan--demo-build..HEAD | grep -q '^poc/'
```

Add needles for this chunk's own visible figures (e.g. "177") to `no-typed-numbers.sh`
and canary them.

Mutation check: change the subset-grading rule in `cases.ts` to also
penalise flags outside the key. Confirm `grade.test.ts` or `cases.test.ts` fails, then
revert.

## Deliverables

- [ ] `completion-report.md`, committed, with screenshots of Cases (06), the run panel,
      the trace viewer filtered to `filter.decision`, and the 390 px width view. Report
      the click count from `/evals` to a raw trace.

## Artifacts Checklist

- ☐ New tests
- — Existing tests: none affected
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout)
