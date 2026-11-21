# Regulatory Monitoring — POC (reference only)

Scrappy proof of concept that validates the RFC before the real build. Lives on the `poc`
branch and is never merged. The real build cites what this proves.

Three questions it answers:

1. **Does the workflow work?** Config → Scan (Federal Register API + optional Exa leads) →
   Filter (Jev decision model and/or LLM) → Verify + Tier (code) → Output (LLM).
2. **What do the evals look like?** Code graders on the outcome, transcript checks as a
   secondary signal, a 3-judge LLM panel only for action-item quality (`scripts/suite.mts` runs it all).
3. **Does it beat a baseline?** One prompt + the same model's native web search, graded by the
   same code.

## Run it

```bash
pnpm install
# key is read from ../.env (VERCEL_AI_GATEWAY_API_KEY)
pnpm dev                 # http://localhost:3000 (PORT=3457 in the POC session) — Run · Label · Evals
pnpm test                # unit tests: tier rules, date verification, scoring
pnpm run run -- --filter jev+llm --threshold 0.1 --runs 3 --group my-group   # CLI run
npx tsx scripts/suite.mts --setups jev-sonnet-strict --repeat 3   # eval suite: setups × eval sets × repeats (spends money)
```

Spend is capped by `config/experiment.yaml → budgetUsd` ($120 for this POC). It is the sum of every saved run's
Gateway-reported cost, and runs refuse to start past it.

## Where things are

| Path | What |
|---|---|
| `config/` | **everything the code executes**: companies, prompts, setups, judge panel, knobs, eval sets + answer keys (`config/README.md`) |
| `SCHEMA.md` | every file format (config, keys, runs, traces, export bundle) — the contract the real build loads |
| `src/lib/pipeline/` | the workflow: scan → Jev/LLM filter → verify + tier → actions; baseline |
| `src/lib/grade.ts` · `suite.ts` | code graders vs the answer key (found / missed / trap / dates / tier / owner, pass^k) and the dashboard numbers |
| `src/lib/panel.ts` | 3-vendor judge panel, 2-of-3 vote |
| `src/lib/trace.ts` · `trace-checks.ts` | full JSONL execution trace per run + deterministic checks on it |
| `data/evals/<arenaId>/` | the canonical eval suite: `runs/<id>.json` + `traces/<id>.jsonl` |
| `data/user-view/` | user-view runs (pre-runs + fresh ones), same shape |
| `data/exports/<arenaId>/` | portable bundle for the real build (static files; traces gzipped) |
| `data/iterations/<NN-slug>/` | one improvement iteration each: spec (hypothesis → change → decision), error analysis, results, `system.diff`, `config.diff`, config snapshot |
| `scripts/` | `suite` (run evals), `error-analysis`, `iteration`, `split-report`, `step-report`, `prerun`, `judge-panel`, `export`, `cleanup`, `freeze-week`, `validate-config`, `report` |

Pages: `/` start an eval · `/arena/<id>` interviewer dashboard · `/progress` iterations · `/runs/<id>/trace` trace viewer · `/try` user view.

## The improvement loop

1. `scripts/error-analysis.mts <prev suite> <live setup> data/iterations/<NN>/ --llm`: dev weeks only (test weeks are
   refused), every failure signal (code vs key, trace checks, judge verdicts) plus per-step scores, grouped into root
   causes, each marked system or eval.
2. Write `spec.yaml` with `targets` naming the buckets / root causes the change addresses; add the candidate setup.
3. `scripts/suite.mts --setups <live>,<candidate>`: the control re-runs in the same suite.
4. `scripts/iteration.mts data/iterations/<NN>/spec.yaml`: refuses without step 1's evidence (written before the
   suite) and targets. Decide on dev; a gap counts only if it exceeds the control's A/A swing between identical suites.

## Findings (2026-11-22, after iterations 00–06)

**Eval set:** 3 everyday companies (food, pharmacy, airline) × 4 frozen weeks = 12 company-weeks; 2 weeks are dev
(we look and tune), 2 are held-out test (scored, never analysed). Keys: two blind drafts (Opus + Sonnet) per
company-week, reconciled by a third blind agent: 20 should-flag rules, 157 traps. Grading: code vs the key (subset
logic: key flags found = right, traps flagged = wrong, anything else is reported but not penalised), deterministic
trace checks, per-step scores, and a 3-vendor judge panel (2 of 3) for action wording. Total spend $125 of $130.

**Live setup `jev-sonnet-strict-passages` vs the RFC targets** (69 runs pooled over two identical suites):

| Target | Result | |
|---|---|---|
| Recall ≥ 90% | 89.8% (dev 91.2%, test 88.2%) | just short |
| Precision ≥ 80% | 81.5% (dev 91.2%, test 72.6%) | ✅ overall, short on held-out |
| Dates and citations verified | 100% dates (97/97), 100% trace checks (measured on both 06 suites) | ✅ |
| Tier identical across 3 runs | 100% right (97/97) | ✅ |
| Relevance agrees across 3 runs ≥ 90% | 94.6% of keyed docs (pooled); 82.5% on real flags alone, a regression from 89.5% with `strict` | ✅ overall, ❌ on flags |
| Beats single-prompt baseline | recall 90% vs 63%, precision 82% vs 69%, dates 100% vs 79%, $0.20 vs $0.52/run. Cross-suite: the baseline's old-week runs are from the first suite | ✅ |

The held-out weeks have now gated four decisions (02–06), so these test figures are slightly optimistic. The user
view's demo pre-runs are partly from the previous setup: a Gateway outage on Jev failed most re-runs (failed runs are
kept in `data/user-view/runs/` with status `error`; the user view hides them).

The previous live setup (`strict`) in the same two suites: recall 86.3%, precision 78.9%, $0.12/run. Flags outside
the key (not penalised under subset grading) ran at about 0.3 per run, mostly docs the key reviewers called 50/50.

**What the iterations showed** (`/progress`, `data/iterations/`):
- **02, the strict filter prompt (kept):** listing what does NOT count cut false flags sharply. It's the only prompt
  change that beat the noise.
- **03, strict-v2:** rejected on dev precision. Its one code fix, showing every verified date on the card, took
  dates right from 74% to 100% and was kept.
- **04, a 3-pass majority vote on the filter:** steadier on dev, no held-out gain, 2.2× cost. Not kept.
- **05, strict-v3 (exclusions from error analysis):** no measurable effect. The targeted docs were flagged identically
  by the unchanged control in the same suite.
- **06, Jev-picked passages (promoted):** for Jev's top 20 docs, Jev scores ~1,200-char passages of the full text
  and the filter also reads the best 3. The power-bank rule (2026-21922), missed in every earlier run, was found
  9 of 9 times. Test misses fell 5.3 → 3.1 and trap hits 10.6 → 8.7 per 18 runs (pooled, replicated). Trade-off:
  it sometimes drops the DEA quota rules (3 of 8 dev runs) when passages say the duty sits with manufacturers.
- **The noise band is wide.** The unchanged control swings 3 recall cases and 4 trap hits on the test weeks between
  two identical suites, and its old-week test recall was 14, 9, 12 and 15 of 15 across four suites. So single-suite
  gaps of that size are inconclusive. The decision rule now requires a gap
  larger than the control's own A/A swing.

**Per step** (dev): Jev keeps 100% of real flags and ranks every one in its top 20 (median 4th), so it's not the
bottleneck. The LLM filter loses ~9% of real flags and is where false alarms come from. Verify extracts and verifies
the key's date 100% of the time. Top-N on Jev would save cost but wouldn't remove the traps the filter falls for:
they rank 10–20.

**Eval-method findings (fixed or flagged):**
- *Judge saw only the action text* and penalised dates that live on the card. Fixed: judges see the card's dates.
- *Grader penalised flags outside the key*, including docs reviewers dropped as 50/50. Fixed: subset grading.
- *Judge "covers" FAIL rate tracks rubric style, not the system:* 0% on gist rubrics written that way, 36% on
  rewritten dev rubrics, 71% on the original detailed, date-bearing test rubrics (left untouched: test weeks are
  frozen). Judge pass is not comparable across week groups.
- *Held-out false alarms are real:* 19 of 20 are on high-confidence traps, so the test precision gap isn't key noise.
- *Text bug:* govinfo text with a literal "<" lost up to 113 KB (11 of 169 keyed docs). Fixed. It never changed a
  score: the filter reads abstracts, and the date extractor's input (first 7,000 chars) was identical before and
  after for every damaged doc that reached it. It would have mattered in production.
- *Error analysis disagreed with the grader on dates:* it still checked only the old headline date, so it reported
  date failures the grader didn't count. Fixed: both share one date check (`dateCorrect`).
- *Possible key bias:* keys were drafted by Claude models; the only non-Claude setup ranked lowest on recall.

**Next, for the real build** (evidence for iteration 07 is ready in `data/iterations/07-next/`):
- Keep indirect supply/demand rules when passages describe duties on other parties (the DEA quota drops).
- Judges read rubrics too literally (e.g. fail an informational action for not saying "nothing is required"):
  loosen the "covers" instruction for informational items.
- Grow the eval set before tuning further: 20 real flags can't resolve gains smaller than ~3 cases.
- Rewrite the held-out rubrics at gist level with a blind agent, so judge pass is comparable across weeks.

## For the real build

- Load `config/` and the export bundle (`scripts/export.mts`) as-is; formats are in `SCHEMA.md`.
- Serve eval results as static files (`public/evals/<suite>/`, traces `.jsonl.gz`); stream + window the trace
  viewer (fetch → DecompressionStream → line parse → virtualized list); split index vs heavy bodies.
- Scale: add a free rules-based prefilter (agency, CFR part, doc type) before Jev, prompt-cache the profile, and cache
  verdicts per (profile, doc).
