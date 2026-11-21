# Data formats (schema version 1)

These files carry over into the real build: it loads them as-is, so treat every shape here as a contract. If a
shape changes, bump `schemaVersion` in the export manifest and record the change here.

## Inputs: `config/` (see `config/README.md`)

| File | Shape | Validated by |
|---|---|---|
| `experiment.yaml` | budget, Jev model, arena concurrency, user-view setup, eval gates, score weights | `ExperimentSchema` in `src/lib/config.ts` |
| `setups.yaml` | `models[]` (id, label, vendor, search), `methods[]`, `setups[]` (id, label, model, method, promptSet?, filterVotes? (odd; LLM filter passes, majority vote), filterExcerpts? {topN, chunkChars, perDoc, maxChunks} (Jev-picked full-text passages for the filter), estUsd) | `SetupsSchema` |
| `judges.yaml` | `minAgree`, `judges[]` (model), `criteria[]` (id, question, needsRubric?) | `JudgesSchema` |
| `pipeline.yaml` | tier rules, batch sizes, concurrency, text limits | `PipelineSchema` |
| `prompts.yaml` | every prompt template with `{{placeholders}}` | `PromptsSchema` + `render()` (missing or unused vars throw) |
| `prompt-sets/<name>.yaml` | partial overrides of `prompts.yaml` for setups that name the set | `PromptOverridesSchema` |
| `companies/<id>.yaml` | `use` (eval or demo), name, summary, applies[], doesNotApply[], areas → owner, generalCounsel | `CompanySchema` |
| `evalsets/manifest.yaml` | `weeks[]` (id, window, asOf, split dev or test), `evalsets[]` (company + week) | `ManifestSchema` |
| `evalsets/weeks/<start>_<end>.json` | `FrDoc[]`: every Federal Register document published that week, frozen | `types.ts` `FrDoc` |
| `evalsets/keys/<company>_<start>_<end>.json` | answer key, see below | `validateAll()` cross-checks |

### Answer key

```jsonc
{
  "profileId": "brightside", "windowStart": "2026-11-09", "windowEnd": "2026-11-13",
  "relevant": ["2026-23112", ...],                       // should-flag cases
  "details": { "<doc>": {
      "kind": "direct | indirect", "docType": "Rule | Proposed Rule | Notice | ...", "area": "<company area>",
      "reason": "plain English", "confidence": "high | medium | low",
      "deadline": { "date": "YYYY-MM-DD", "kind": "comment | effective | compliance | other", "quote": "verbatim" } | null,
      "acceptDates": ["YYYY-MM-DD"],                     // other dates graded as right
      "rubric": { "mustMention": [...], "mustNotClaim": [...] } } },   // for the judge panel
  "traps": { "<doc>": { "trapType": "other-industry | other-product | closed-or-expired | withdrawn | no-obligation | minor-correction | meeting-or-admin | other", "docType", "reason", "confidence" } },
  "provenance": "who made it, frozen when",              // present = frozen (the Label page refuses to overwrite)
  "agreement": { ... }                                  // how the two blind drafts agreed, and the tie-break decisions
}
```

## Outputs: `data/`

### `data/runs/<runId>.json`: run summary (`RunRecord` in `src/lib/types.ts`)

The run's `config` (incl. `arena`, `cell` = setup id, `evalset`, `repeatIndex`, `promptSet`, `filterVotes?`, `filterExcerpts?`), `configHash`, `status`,
`stages[]` (name, ms, costUsd, in/out counts), `calls[]` (per LLM call: stage, model, prompt, output, tokens, cost),
`decisions[]` (per document: Jev probability, LLM verdict and reason, `llm.votes` {yes, no, passes} when filterVotes > 1), `items[]` (the action items), `dropped[]`,
`claimed[]` (baseline only), `markdown`, `panel` (judge-panel votes and verdicts), `totalCostUsd`, `totalMs`.

### `data/traces/<runId>.jsonl`: full execution trace, one event per line

Every event has `seq` (0, 1, 2… with no gaps), `ts`, `runId`, `type`, plus:

| type | fields |
|---|---|
| `run.start` | `config`, `configHash`, resolved `profile`, `promptSet`, full `prompts` in effect, `pipeline` knobs, `setup`, `jevModel` |
| `stage.start` / `stage.end` | `stage`; end adds `ms`, `costUsd`, `inCount`, `outCount`, `note`, `runCostSoFar` |
| `scan.result` | `count`, `documents[]` (number, type, title) |
| `jev.call` | `document_number` (`<doc>#p<i>` when scoring passage i), `model`, `question`, `state` (exact input), `probability`, `costUsd`, `ms` |
| `filter.passages` | `document_number`, `chunks` (passages scored), `picked[]` (index, p, text): what the LLM filter was shown (stage `filter:passages`, filterExcerpts setups only) |
| `llm.call` | `stage`, `model`, `system`, `prompt`, `tools[]`, `output`, `toolCalls[]` (name, input, output), `sources`, `steps`, `usage`, `costUsd`, `ms`, `error?` |
| `filter.decision` | `document_number`, `jevProbability`, `jevThreshold`, `passedJev`, `llm` (relevant, reason, areas), `relevant` (one per scanned doc) |
| `verify.doc` | `document_number`, `refetched`, `fields` (from the re-fetch), `textSource` (cache, govinfo, federalregister, none), `textChars`, `fieldChecks[]`, `extracted[]` (date, kind, quote, verified, note), `extractedDuplicatesOfFields[]`, `citationVerified` |
| `tier.assign` | `document_number`, `docType`, `tier`, `reason`, `deadline`, `rules`, `asOf` |
| `owner.assign` | `document_number`, `areas`, `owner`, `rule` |
| `action.write` | `document_number`, `raw` (model text), `final` (after date stripping), `stripped`, `missingFromModel` |
| `baseline.resolve` | `claim` (as the model stated it), `document_number`, `outcome` (kept or dropped), `why`, `date` (claimed, verified), `owner` |
| `judge.call` | `panelHash`, `model`, `prompt`, `votes[]`, `usage`, `costUsd`, `ms`, `error?` |
| `judge.verdict` | `panelHash`, `document_number`, `criterion`, `votes` (judge → PASS, FAIL, UNKNOWN or MISSING), `minAgree`, `verdict` (PASS, FAIL or CONTESTED) |
| `run.end` | `status`, `error?`, `totalCostUsd`, `totalMs`, `scanned`, `items`, `dropped[]`, `itemsFinal[]` |

Trace checks (`src/lib/trace-checks.ts`) read only these events: completeness, every doc decided, every
Jev-passed doc judged, kept items fully processed, tier reproducible, shown dates verified, no dates in action
text, and costs adding up.

### `data/spend-ledger.json`

Spend of deleted runs (`entries[]`: date, reason, runs, usd), so cleanup never makes the budget forget money already spent.

### `data/exports/<arenaId>/`: the portable bundle for the real build

`manifest.json` (schemaVersion, arena, configHash, totals), `runs.jsonl` (one `RunRecord` per line),
`traces/<runId>.jsonl`, `report.json` (dashboard numbers from `suiteReport`), `trace-checks.json`, and
`config/` (a snapshot of the config the suite ran with, keys included).

### `data/iterations/<NN-slug>/`: one improvement iteration

`spec.yaml` (hand-written: id, title, date, suite, setup, comparedTo?, `targets[]` (error-analysis buckets or
`rootCause:<i>`), hypothesis, change, codeChanges?, evalChanges?, plan?, decision, notes?),
`error-analysis.json` (dev-only evidence of the previous suite: suite, setup, split, excludedTestRuns, runs,
generatedAt, bySignal, buckets, `steps` (per-step scores: jev, llm, verify), rows, llm root causes),
`iteration.yaml` (generated: spec + results + code commit + config changes), `system.diff`, `config.diff`, `config/`
(snapshot). `scripts/iteration.mts` refuses a new iteration without the evidence (see README, the improvement loop).
