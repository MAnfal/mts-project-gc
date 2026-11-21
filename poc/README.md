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

Spend is capped at $15 total (`config/experiment.yaml → budgetUsd`). It is the sum of every saved run's
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
| `scripts/` | `suite` (run evals), `prerun`, `judge-panel`, `export`, `cleanup`, `freeze-week`, `validate-config`, `report` |

Pages: `/` start an eval · `/arena/<id>` interviewer dashboard · `/runs/<id>/trace` trace viewer · `/try` user view.

## Findings (eval suite arena-2026-11-21-18-40-w0i, 2026-11-21)

**Setup:** 3 everyday companies (food, pharmacy, airline) × 2 frozen weeks (Nov 9–13 = dev, Nov 2–6 = held-out
test) × 5 setups × 3 repeats = 90 runs, $27.65. Keys: two blind drafts (Opus + Sonnet) reconciled by a third blind
agent: 14 should-flag rules, 79 traps. Graded by code vs the key, deterministic trace checks, and a 3-vendor judge
panel (2 of 3).

| Setup | Score | Found | Flags right | Traps avoided | $/run |
|---|---|---|---|---|---|
| **Jev → Sonnet, strict prompt** | **89%** | 93% | 79.6% | 97% | $0.13 |
| Sonnet reads everything | 85% | 100% | 44% | 79% | $0.62 |
| Jev → Sonnet | 85% | 98% | 45% | 82% | $0.16 |
| Jev → GPT (cheap) | 84% | 86% | 44% | 85% | $0.10 |
| Baseline (Sonnet + web search) | 83% | 71% | 79% | 97% | $0.53 |

- **The prompt matters more than the model.** Spelling out what does NOT count (other models or industries,
  closed periods, paperwork) cut trap hits from 43 to 8 with almost no recall loss. On the held-out week the strict
  setup handled 124/132 cases vs 109/132 with the default prompt. Caveat: that claim is about traps; recall on the
  test week rests on very few rules.
- **The baseline is precise but misses real rules** (4 of 9 "directly affects us" rules), and it is the only setup
  failing trace checks: unverified dates and dates written into action text, i.e. no guardrails.
- **Recall rests on 14 distinct rules** (42 checks with repeats); the strict setup's 3 misses are 3 different rules,
  each missed in 1 of 3 runs.
- **Tier gap:** past-dated *notices* (e.g. SNAP candy bans already in force Nov 1) get no headline date and tier Low;
  the "recently effective" rule only covers final rules. Fix in the real build (`pipeline.yaml → tiering`).
- **Full text:** federalregister.gov serves a captcha to scripts; govinfo.gov has the same GPO text. Before the fix,
  15/22 "full texts" were block pages (dates still came out right via structured API fields).
- **Judges:** Opus was the lenient judge (it passed nearly everything); the 2-of-3 vote absorbs that.
- **Config pinning:** a suite must freeze config at start. An edit mid-suite crashed one attempt (`pinConfig()` now).
- **Possible key bias:** keys were drafted by Claude models; the only non-Claude setup ranks lowest on recall.

## For the real build

- Load `config/` and the export bundle (`scripts/export.mts`) as-is; formats are in `SCHEMA.md`.
- Serve eval results as static files (`public/evals/<suite>/`, traces `.jsonl.gz`); stream + window the trace
  viewer (fetch → DecompressionStream → line parse → virtualized list); split index vs heavy bodies.
- Scale: add a free rules-based prefilter (agency, CFR part, doc type) before Jev, prompt-cache the profile, and cache
  verdicts per (profile, doc).
