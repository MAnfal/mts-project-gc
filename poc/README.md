# Regulatory Monitoring — POC (reference only)

Scrappy proof of concept that validates the RFC before the real build. Lives on the `poc`
branch and is never merged. The real build cites what this proves.

Three questions it answers:

1. **Does the workflow work?** Config → Scan (Federal Register API + optional Exa leads) →
   Filter (Jev decision model and/or LLM) → Verify + Tier (code) → Output (LLM).
2. **What do the evals look like?** Code graders on the outcome, transcript checks as a
   secondary signal, an LLM judge only for action-item quality (`evals/triage.eval.ts`).
3. **Does it beat a baseline?** One prompt + the same model's native web search, graded by the
   same code.

## Run it

```bash
pnpm install
# key is read from ../.env (VERCEL_AI_GATEWAY_API_KEY)
pnpm dev                 # http://localhost:3000 (PORT=3457 in the POC session) — Run · Label · Evals
pnpm test                # unit tests: tier rules, date verification, scoring
pnpm run run -- --filter jev+llm --threshold 0.1 --runs 3 --group my-group   # CLI run
pnpm evals               # grade saved runs against your labels (free)
EVAL_MODE=live pnpm evals  # execute fresh runs, then grade (spends money)
pnpm evals:json && pnpm evals:ui   # vitest-evals report viewer
```

Spend is capped at $15 total (`config/experiment.yaml → budgetUsd`). It is the sum of every saved run's
Gateway-reported cost, and runs refuse to start past it.

## Where things are

| Path | What |
|---|---|
| `src/lib/pipeline/stages.ts` | scan, web leads, Jev/LLM filter, verify + tier, output |
| `src/lib/pipeline/run.ts` | pipeline orchestration + baseline |
| `src/lib/tier.ts` | deterministic tiering (tested) |
| `src/lib/verify.ts` | quote-based date verification, FR URL → doc number (tested) |
| `src/lib/score.ts` | recall/precision, consistency, Jev threshold sweep (tested) |
| `evals/triage.eval.ts` | vitest-evals suite: 3 configs × code graders + LLM judge |
| `config/` | **everything the code executes**: setups, prompts, knobs, companies, eval sets (see `config/README.md`) |
| `data/runs/*.json` | every run: config, config hash, stages, full model transcript, items, cost |

## Findings so far (week 2026-11-09 → 13, Ledgerly profile, Sonnet 5.5)

- **Data:** 448 docs/week, ~54K tokens of title+abstract. One week fits in one context;
  Brian's 5M-token concern doesn't arise at weekly scale.
- **Structured dates:** 46/54 rules have `effective_on` and 32/36 proposed rules have
  `comments_close_on`. The rest live in prose, so dates are extracted with a verbatim quote and
  code checks the quote against the source text.
- **Jev (`typesafe-ai/jev`):** ~$0.014 per 448 docs, ~13s at concurrency 16. Scores are
  bimodal: 432/448 below 0.2.
- **Profile ambiguity, not just batch effect (hypothesis):** the LLM-on-every-doc run dropped
  the 4 OFAC general licenses, citing the profile line "sanctions actions only matter via the
  screening program". The Jev-prefiltered runs kept them, calling them changes to authorized
  activity. The same rule is read two ways, so the label decision has to be made explicitly.
- **Date kinds drift:** "GL W was issued on May 1, 2026" was tagged `effective` in the pilot
  and `other` later. The quote check proves the date is in the text, not that it is the right
  deadline kind. Tier stability depends on kind classification, so expected deadlines belong
  in the labels.
- **Baseline:** the same 2 items in 3/3 runs, $0.47–0.66/run, ~20s. **Pipeline:**
  $0.09–0.13/run, ~33s, 6–7 items, tiers identical across 3 runs.
- **Recall/precision:** pending hand labels (Label page). This week has 2–7 positives, so one
  doc moves recall 14–50 points. Report raw counts; one week can't test the 0.9/0.8 targets.
- **Gates that can't fail yet:** "grounded on FR" is true by construction, and "dates verified"
  is always 100% for the pipeline (tiering only uses verified dates). They need labeled
  expected deadline + tier per relevant doc to mean anything.
- **Tooling:** `vitest-evals` 0.18 declares a peer of `ai < 7`. The core `createHarness` works
  with AI SDK 7; the `harness-ai-sdk` package was not needed.
