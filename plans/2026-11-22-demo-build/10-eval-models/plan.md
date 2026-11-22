---
chunk: 10
title: Eval view — Models page (multi-vendor comparison and why Sonnet)
branch: feat/demo-build--eval-models
base: feat/plan--demo-build
execution: parallel
depends: [08, 09]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 10 — Eval view: Models page

## Context

The assignment requires evaluating more than one model and choosing one. The POC did this
in its model arena, where the setups are models × methods (`git show
poc:poc/config/setups.yaml`). The models were Sonnet 5.5, GPT-6.2 Sol, Gemini 4 Carbon and
Kimi K3.1 Pro, run "at price parity", with methods jev+llm, llm-only, jev-only and the
single-prompt baseline. The first suites (`arena-2026-11-21-18-40-w0i` and later ones)
hold those runs. The user decided the comparison gets **its own page**, "Models", next to
Summary, Iterations and Cases.

Data comes only from chunk 07's bundle: each suite's `report.json` has per-setup metrics,
and `index.json` lists suites and setups. Find every suite that ran more than one model,
and compare models **within the same suite**, so they share the same eval set and keys.
Never mix suites in one comparison.

Two things the page must say honestly, both from the POC README findings:

- **Possible key bias.** The answer keys were drafted by Claude models, and the only
  non-Claude setup ranked lowest on recall.
- **The judge panel is a separate use of models.** Opus 5.5, GPT-6.2 Sol and Gemini 4
  Carbon, 2 of 3 must agree (`config/judges.yaml`). It is not part of the choice.

The "why Sonnet" rationale is narrative: add a `models` section to
`config/eval-story.yaml` (chunk 08's file) with placeholders filled from data.

## Acceptance Criteria

- Given `/evals/models`, Then for each multi-model suite there is a table: Model | Method
  | Recall | Precision | Dates verified | Judges pass | $ / run | s / run | Runs.
  - The live choice is highlighted.
  - The suite name, its eval-set weeks and the run counts are shown above the table.
- Given the page, Then a "Why Sonnet 5.5" block renders from `eval-story.yaml` with numbers
  filled from the data. A short caveats block covers key bias and price parity, with the
  date checked.
- Given the judge panel section, Then it lists the 3 judge models and the 2-of-3 rule from
  `config/judges.yaml`.
- Given a model row, When clicked, Then it opens Cases filtered to that suite and setup.
- Given 390 px width, Then each table scrolls inside its own box.

## What To Do

### Tasks

- [ ] T001 — write a failing test, `src/lib/evals/models.test.ts`.
  `modelComparisons(index, reports)` run on the **real** shipped bundle returns one group
  per multi-model suite, and each group's rows share one suite. Assert that the Sonnet
  jev+llm row's recall equals `report.json`'s value for that setup.
- [ ] T002 — create `src/lib/evals/models.ts` (pure).
- [ ] T003 — edit `config/eval-story.yaml`: add the `models` section, with its schema in
  `src/lib/evals/story-schema.ts` (chunk 08's file). Do **not** edit
  `src/lib/config/schemas.ts`; chunk 05 edits it in the same wave.
- [ ] T004 — edit `src/app/evals/cases/page.tsx` (chunk 09's page): accept
  `?suite=<arenaId>&setup=<setupId>` as an alternative to `?iteration=`, showing that
  setup's cases in that suite. Add a test for the filter in `src/lib/evals/cases.test.ts`.
- [ ] T005 — create `src/components/evals/ModelTable.tsx` and
  `src/app/evals/models/page.tsx`, and add "Models" to `EvalSidebar`. Coordinate with
  chunk 09, which also adds a sidebar entry. If both are open, the second to merge rebases
  and keeps both entries.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `models.test.ts` › one suite per group | no cross-suite mixing | a flat grouping by model mixes 6-week and 12-week suites |
| `models.test.ts` › Sonnet recall = report | numbers from data | a re-derivation with a different inclusion rule drifts from `report.json` |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| a suite with a single model | an index with only Sonnet setups | `models.test.ts` (excluded from comparisons) |

## Reuse Audit

Reuse: chunk 07's loader and index; chunk 08's `EvalSidebar`, `eval-story.yaml` and story
templating; chunk 09's cases route for the drill-down link. New: the model grouping
helper.

## Reference Files

| File | Why |
| ---- | --- |
| `git show poc:poc/config/setups.yaml` | Which setups are which model × method; price-parity note |
| `git show poc:poc/README.md` | Findings: key bias, baseline vs pipeline |
| `plans/2026-11-22-demo-build/design/HiEvalSummary.dc.html` | Table and sidebar styling to match |
| `.claude/resources/bibles/swe/testing.md` | Test on the real shipped data |

## External Dependencies

None new.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck
bash plans/2026-11-22-demo-build/02-core-libs/parity.sh
```

## Deliverables

- [ ] `completion-report.md`, committed, with a screenshot, the list of multi-model suites
      found, and their run counts.

## Artifacts Checklist

- ☐ New tests
- — Existing tests: none affected
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout)
