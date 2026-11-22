---
chunk: 09
title: Eval view — Cases, run side panel, and gz trace viewer
branch: feat/demo-build--eval-cases-traces
base: main
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
  - "Open this run's report" and "Raw trace · N events".
- Given "Raw trace", When the page renders, Then `/evals/traces/<suiteId>/<runId>`:
  - fetches the one gz file, decompresses it in the browser, and renders a virtualized
    list (it must stay smooth at about 1,000 events);
  - shows the trace-check summary first;
  - has filter chips by event type and a search box (document number or word);
  - opens any event's JSON on click.
- Given the run report link, When the page renders, Then it renders the run's items, tiers, owners and dates for
  reviewers, reusing chunk 04's `ReportView` if it fits the recorded run shape. You may
  write a thin eval-side adapter instead; explain your choice.
- Given 390 px width, When the page renders, Then the side panel stacks under the table.

## What To Do

### Tasks

- [ ] T001 — write failing tests:
  - `src/lib/evals/cases.test.ts`: `casesForIteration(suite, iteration, keys)` on a
    **real** shipped suite, using the 06 suite `arena-2026-11-21-22-52-l92`. Assert that
    the power-bank case (`2026-21922`, SkyHop Oct 26–30) is listed as changed, and that
    each case's After/Before equals a direct count over the runs.
  - `src/lib/evals/grade.test.ts`, if you port `grade.ts`: per-setup recall and precision
    equal `report.json` for the same suite.
  - `src/lib/evals/traceIndex.test.ts`: filter and search over a real shipped trace.
- [ ] T002 — create `src/lib/evals/cases.ts` and `src/lib/evals/traceIndex.ts` (pure), and
  `src/lib/evals/grade.ts` if needed.
- [ ] T003 [P] — create `src/components/evals/CasesTable.tsx` and `RunPanel.tsx`.
- [ ] T004 [P] — create `src/components/evals/TraceViewer.tsx`. Virtualize with a small
  windowing approach or `@tanstack/react-virtual`; explain the choice. You may reuse
  parts of `git show poc:poc/src/components/TraceTimeline.tsx`.
- [ ] T005 — create `src/app/evals/cases/page.tsx` and
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
| empty trace | 0 events | `traceIndex.test.ts` |

## Reuse Audit

Reuse: chunk 07's loader; chunk 08's `EvalSidebar`; the POC's `grade.ts`, `RuleGrid.tsx`
and `TraceTimeline.tsx` as sources; chunk 04's `ReportView` where it fits. New: case
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
pnpm lint && pnpm test && pnpm build && pnpm typecheck
```

Mutation check: change the subset-grading rule in `grade.ts` (or in `cases.ts`) to also
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
