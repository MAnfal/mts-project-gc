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

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against the shipped bundle and the merged code. Where the
text below conflicts with these points, these win:

1. **Only two models ran in the pipeline arena: Sonnet and GPT.**
   - Gemini and Kimi appear in `setups.yaml` `models:` with no setup and no run.
   - Gemini appears only on the judge panel.
   - There is no jev-only method; the methods are jev+llm, llm and baseline.

   Name only what ran.
2. **One comparison suite:** `arena-2026-11-21-18-40-w0i`. It ran jev-sonnet-strict,
   llm-sonnet, jev-sonnet, jev-gpt and baseline-sonnet: 18 runs each, over 2 weeks (1 dev,
   1 test). Every other suite is Sonnet-only, so expect one table. A Sonnet-only suite
   renders "single model, no comparison". The Test Plan's "6-week vs 12-week suites" means
   6 vs 12 evalsets (2 vs 4 weeks).
3. **The live choice.** The live setup (`jev-sonnet-strict-passages`) never ran in w0i, so
   highlight the live **model's** rows and state that rule on the page.
4. **Rows are setups.**
   - Name each row by its setup key, plus a prompt-set/label column.
   - The like-for-like model pair is `jev-sonnet` vs `jev-gpt` (both default prompt).
   - T001 asserts on named setup keys.
5. **Data source.** `modelComparisons(index)` reads `index.json` `suiteResults` (already
   labelled with split, runs and suite), `suites[].weeks` and `setups[]` (modelLabel,
   method). `report.json` serves only as a test cross-check. No server read of
   `public/evals`.
6. **Labels.**
   - The "Dates" column uses the `measures` labels from `eval-story.yaml` ("dates match
     the answer key"), never "verified".
   - Judges pass is labelled with its judged-run count.
7. **Story prose.**
   - The `Prose` schema forbids typed digits, so model labels come in through placeholders
     (`index.setups[].modelLabel`). Add `story.ts` (`storyContext`) to the tasks.
   - Price parity is worded without numbers, and the page shows the computed per-run
     costs.
8. **Caveats are computed.** A ranking claim (e.g. the lowest recall among pipeline setups)
   is computed from data and names its comparison set. In w0i, baseline-sonnet's recall is
   below jev-gpt's, so "the only non-Claude setup ranked lowest" is true only among
   pipeline setups.
9. **"Why the live model" rests on the data.**
   - In w0i, on the default prompt, Sonnet has higher recall, similar precision, and a
     higher cost per run than GPT.
   - Render the rationale as computed comparisons with placeholders: recall advantage,
     precision difference and cost difference, each labelled with runs and suite.
   - No recorded decision prose mentions GPT, so don't invent a quote.
10. **Cases drill-down.**
    - Extend `src/lib/evals/casesState.ts` and its test, not `cases/page.tsx` logic.
    - Add `?suite=`, and define the precedence:
      - when both `iteration` and `suite` are given, `iteration` wins and the page says so;
      - an unknown suite gets its own state;
      - a setup not in the suite gets its own state.
11. **Housekeeping.**
    - `judges.yaml`: reuse `judges()` from `src/lib/config.ts`; don't add a second schema.
    - Chunks 05 and 09 have merged.
    - The sidebar has Summary, Iterations, Cases and Runs. Add Models, and add an
      `active: "models"` value.
    - The style source is `design/HiEvalSummary.dc.html`; there is no Models mock.
12. **Gates** are replaced; see Verification Gates.

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
  `modelComparisons(index)` (amendment 5) run on the **real** shipped bundle returns one group
  per multi-model suite, and each group's rows share one suite. Assert that the Sonnet
  jev+llm row's recall equals `report.json`'s value for that setup.
- [ ] T002 — create `src/lib/evals/models.ts` (pure).
- [ ] T003 — edit `config/eval-story.yaml`: add the `models` section, with its schema in
  `src/lib/evals/story-schema.ts` (chunk 08's file). Do **not** edit
  `src/lib/config/schemas.ts`; chunk 05 edits it in the same wave.
- [ ] T004 — extend `src/lib/evals/casesState.ts` + test and `CasesView` (amendment 10): accept
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
AI_GATEWAY_API_KEY= PORT=3701 bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh  # 04/03 gates, Gate 5, parity, no-fs-writes, no-typed-numbers, verify
bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh
bash scripts/verify-eval-bundle.sh
t=$(git ls-tree -r --name-only HEAD | grep -c '^poc/' || true); h=$(git log --name-only --format= feat/plan--demo-build..HEAD | grep -c '^poc/' || true)
[ "$t" = 0 ] && [ "$h" = 0 ] || { echo "FAIL: poc/ paths (tree $t, history $h)" >&2; exit 1; }
```

Add needles for this page's figures to `no-typed-numbers.sh` and canary them.

## Deliverables

- [ ] `completion-report.md`, committed, with a screenshot, the list of multi-model suites
      found, and their run counts.

## Artifacts Checklist

- ☐ New tests
- — Existing tests: none affected
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout)
