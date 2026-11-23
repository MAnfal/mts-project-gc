# Chunk 03 — Completion Report

Branch `feat/demo-build--pipeline`, base `6a02704` (`git merge-base HEAD feat/plan--demo-build`).
Evidence files are under `plans/2026-11-22-demo-build/03-pipeline/evidence/`; every block below names its file.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/pipeline/events.ts` | created | `RunEvent` union, `STEP_LABELS` (stage id → step key + label), `stepOf`, `assertPublic`, the two fixed failure messages, `screenedOut()` / `heldBack()` builders. Type-only imports, so the browser can import it. |
| `src/lib/pipeline/retry.ts` | created | `withRetry(fn, RETRY, onRetry, stopped)`: 3 tries, 2 s then 4 s, `RetriesExhausted` with the last error as `cause`. `withRetryScope` / `withScopedRetry`: per-run AsyncLocalStorage scope so `fr.ts` can report retries. |
| `src/lib/gateway.ts` | created | POC `gateway.ts` minus dotenv and the import-time throw: lazy `createGateway()`, key checked when a model is resolved. Keeps the POC's `setModelsForTests` seam (now accepts `null` to restore). |
| `src/lib/grade.ts` | created | `majority()` (and `Verdict`) only, verbatim from POC `grade.ts`; `combineFilterPasses` imports it. |
| `src/lib/pipeline/context.ts` | created | Ported `RunCtx`: `stage()` / `object()` / `jev()`, retries, `emit` (assertPublic + terminal gate), injectable internal trace sink (debug log behind `DEBUG_PIPELINE`). |
| `src/lib/pipeline/stages.ts` | created | Ported verbatim except: `step.progress`, `item.confirmed`, `itemReason` (neutral fallback), web leads removed. Diff: `evidence/poc-diffs.txt`. |
| `src/lib/pipeline/excerpts.ts` | created | Byte-identical to `poc:poc/src/lib/pipeline/excerpts.ts` (`diff exit 0` in `evidence/poc-diffs.txt`). |
| `src/lib/pipeline/run.ts` | created | `runPipeline(config, emit, {trace?})` → `{items, dropped, decisions, markdown}`; `plannedStages(config)`; `RunFailed`. `pipeline()` keeps the POC's cut and merge lines verbatim. |
| `src/lib/fr.ts` | edited | `fetchRetrying`: a thrown fetch, 5xx or 429 is retried through `withScopedRetry`; everything else unchanged. |
| `src/lib/fr.test.ts` | edited | The offline live-window test now uses fake timers and asserts 3 tries; 4 new retry tests. |
| `src/lib/pipeline/__fixtures__/replay-06.jsonl.gz` | created | `git show poc:…/traces/2026-11-21T23-16-59-591Z_pipeline_zxuc.jsonl.gz` (cmp-identical to the POC file). |
| `src/lib/pipeline/__fixtures__/replay-06-sources.json.gz` | created | The 23 FR/govinfo responses that run read (url → status, body), captured once from the free APIs. |
| `src/lib/pipeline/__fixtures__/replay-06-markdown.md` | created | The `markdown` field of the same run's `runs/*.json`. |
| `src/lib/pipeline/__fixtures__/harness.ts`, `replay.ts` | created | Test support: model stubs through the AI SDK's own mock models (`ai/test`), a synthetic live week, and the replay runner. |
| `src/lib/pipeline/{replay,events,retry,reason,stages,excerpts}.test.ts`, `src/lib/gateway.test.ts` | created | See Tests. |
| `package.json`, `pnpm-lock.yaml` | edited | `p-limit` 7.3.3, exact (POC lockfile resolves `^7.3.3` to 7.3.3; `node_modules/p-limit/package.json` reads 7.3.3). |
| `vitest.config.mts` | edited | `pool: "forks"` with a reason comment (chunk 02 review). Evidence: `evidence/pool-forks.txt` (threads: 8 failed, "process.chdir() is not supported in workers"; forks: 8 passed). |
| `.claude/resources/project.md` | edited | Stack (`p-limit`), Commands (unit-test pool), a Convention Map row for the pipeline, Conventions (decision-path replay, public events, retries, model-free tests), Layout. |
| `plans/…/03-pipeline/gates.sh`, `mutations.sh` | created | The gate block as a script; 37 mutation checks (red, restore, green). |
| `plans/…/03-pipeline/plan.md` | edited | T001–T009 ticked. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Replay: every `filter.decision.relevant`, tier, owner and item `document_number`/`deadline`/`citation` equals the trace | yes | `replay.test.ts`: all 466 `filter.decision` events deep-equal (every field: `jevProbability`, `jevThreshold`, `passedJev`, `llm`, `relevant`); `tier.assign`, `owner.assign`, `action.write` deep-equal (3 each); `result.items` deep-equals `run.end.itemsFinal` (all fields, `reason` included, since no reason in this run fell back); markdown byte-equal to the recorded report. Also: all 1,276 decision-model states and all 7 LLM system+prompt pairs byte-identical, once each; `unrecorded` is empty. |
| No event contains `jev`, `Jev`, `typesafe-ai`, `claude-`, `anthropic/`, `openai/`, `google/`, `moonshotai/` (case-insensitive, every replay event) | yes | `events.test.ts` › "contain none of the internal names, checked case-insensitively over every serialized event" (plain `toLowerCase().includes`, not the sanitizer's regexes). |
| Model call throws twice then succeeds → succeeds, 2 `step.retry` with 2000 and 4000 ms | yes | `retry.test.ts` › "a decision call that throws twice then succeeds…" asserts the exact two events `{step:"rank", attempt:2, delayMs:2000}`, `{…attempt:3, delayMs:4000}` and `run.done`. |
| Call throws 3 times → `step.failed` (label + timeout message), `run.failed`, no later stage runs | yes | `retry.test.ts` › "a call that fails 3 times…": last two events exact; 3 filter calls, 0 later LLM calls; steps started = scan, rank, read, screen; no `item.confirmed`/`run.done`. |
| Item with missing LLM reason → "Flagged as relevant to your profile" | yes | `reason.test.ts`: `itemReason({llm: undefined, jevProbability: 0.42})`, and end-to-end with a relevance-only filter (no `0.42`, no `p=` in any event). |

## Tests

Full suite on the final tree: **18 files, 174 tests passed** (baseline 11 files, 84 tests). `evidence/gates-final.txt`.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `replay.test.ts`, `events.test.ts`, `retry.test.ts`, `reason.test.ts` | Import red: "Cannot find module '../run'", "'./events'", "'./retry'", "'./stages'"; "Test Files 4 failed (4) / Tests no tests" (`evidence/red-01-modules-absent.txt`). This only proves absence; the discriminating reds are the mutations below. | pass (`gates-final.txt`) |
| `stages.test.ts`, `excerpts.test.ts`, `gateway.test.ts`, new `fr.test.ts` cases | Written after the port; each is shown red by deleting the branch it covers (mutations below). | pass |

**Mutations** (`mutations.sh`; output `evidence/mutations.txt`, per-mutation red/green logs in `evidence/mutations/`). Each copies the file aside, applies one substitution, checks it changed something, requires the test file to fail, restores with `cp` + `cmp`, and requires it to pass again. 37 of 37 went red→green, exit 0.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| Parity (the plan's check) | `run.ts` relevance cut `>=` → `>` | `replay.test.ts`: 466 decisions differ (4 docs sit at exactly 0.1); LLM prompts differ; `notReviewedCount` 411 vs 407 |
| Parity | drop the passages stage; drop the prompt set | `replay.test.ts`: jev states / passages / prompts differ |
| Reason leak fix | POC fallback `` `Jev p=…` `` restored | `reason.test.ts` (2 tests) |
| Sanitizer | `assertPublic` returns early; regex back to `\bjev\b/i` | `events.test.ts` (12 tests; the 2 camelCase cases) |
| Labels | step label = raw stage id | `events.test.ts` replay suite: the leak is caught by `assertPublic`, the run fails, `beforeAll` errors (4 tests skipped, file red) |
| Retry | never retry; delays swapped; exhaustion swallowed | `retry.test.ts` (7 / 4 / 5 tests) |
| 3 tries in total | SDK `maxRetries` 0 → 2 (LLM) and 0 → 3 (decide), the POC's values | `retry.test.ts`: a retryable `APICallError` is sent 9 times (LLM) and 12 times (decide) instead of 3 |
| Run's retry scope | `withRetryScope` removed from `runPipeline` | `retry.test.ts` › Federal Register 503 retries not reported |
| Terminal gate, fixed failure text, stop after failure | gate removed; `message = error.message`; queued calls not stopped | `retry.test.ts`, `stages.test.ts` |
| HTTP retry | 5xx not retried; 429 not retried (separately) | `fr.test.ts` |
| Key at call time | import-time throw added; call-time check removed | `gateway.test.ts` |
| Ported guards (POC decision expressions the replay can't reach) | each deleted: `!doc` drop, empty-chunks skip, snippet > 20, duplicate-date skip, field-pair check, `!!doc.citation`, general-counsel fallback, `want.has`, filter missing-answer retry, `!items.length`, `?? "Review."`, date strip | `stages.test.ts`, one named test each |
| New guards | unknown-profile catch, `stepOf` throw, debug trace switch, retry outside a step, `run.start` outside the try | `stages.test.ts`, `events.test.ts`, `retry.test.ts` |

## Gates

`bash plans/2026-11-22-demo-build/03-pipeline/gates.sh` runs the plan's block (lint, test, build, typecheck last; gate 2; gate 3), then `02-core-libs/parity.sh`, `02-core-libs/no-fs-writes.sh` and the no-`poc/` check. Run after the last source edit.

| Gate | Command | Result (final tree, `evidence/gates-final.txt`) | Fails on base? (`evidence/gates-base.txt`, base `6a02704` in a scratch worktree) |
| ---- | ------- | ------ | -------------- |
| Lint / test / build / typecheck | `pnpm lint && pnpm test && pnpm build && pnpm typecheck` | exit 0; 174 tests; "Compiled successfully" | Passes on base (84 tests): the standard set isn't chunk-specific. The chunk's tests fail without the chunk (`red-01`, mutations). |
| Gate 2: no `Jev p=` in `src/` | `if grep -rn "Jev p=" src/; then exit 1; fi` | clean | **Passes on base**: base never had the POC stages, so the needle is absent there too. Falsified by canary instead (`evidence/gate-canaries.txt`): planted → fires, removed → clean. |
| Gate 3: no `saveRun\|spentUsd\|budgetUsd\|spend-ledger` in `src/lib/pipeline` | as plan, plus `[ -d src/lib/pipeline ]` | clean | Exit 1 on base, "FAIL: src/lib/pipeline is missing" (the plan's grep alone passed vacuously there; I added the directory check). Each of the 4 needles canaried: fires, then clean. |
| Decision-path parity | `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh` | "parity: OK" | Passes on base too (`evidence/gates-base-02.txt`, run separately because `gates.sh` stops at gate 3 on base). It is chunk 02's gate, and this chunk changes no file it checks; its falsification is chunk 02's. |
| No fs writes | `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` | "OK (27 non-test source files under src/ scanned)" | Passes on base, "17 non-test source files" (`evidence/gates-base-02.txt`). Chunk 02's gate; the 10 new files are in its scan. |
| No `poc/` committed | `git ls-tree -r --name-only HEAD \| grep '^poc/'` | empty; also `git log --name-only feat/plan--demo-build..HEAD` has 0 `poc/` paths | n/a |

Baseline captured before any edit (`scratchpad/chunk-03/baseline/`): typecheck 0 errors, lint 0 problems, 84 tests passed. Final: typecheck 0, lint 0, 174 passed. The base tree has no `pnpm build` record in the baseline dir, but `gates-base.txt` shows build "Compiled successfully" on base.

## Judgment calls

- **Fixture: `zxuc`** (`2026-11-21T23-16-59-591Z_pipeline_zxuc`, Brightside, frozen week 2026-11-02..06, 3 items). Zero text drift measured (`evidence/capture-drift-zxuc.txt`): for all 20 passage documents the captured text gives the recorded chunk count and the recorded picked passages, and all 810 passage-level and 466 document-level decision-model states rebuild byte-identically; the 3 verified docs match `textChars` and the recorded FR fields. Over `vnem` (1 item): 3 tier/owner/action assignments instead of 1, 4 documents at exactly the threshold, and smaller fixtures (442 KB trace and 310 KB sources; vnem's trace is 604 KB and it has two 300-passage documents). Capture script: `evidence/capture-sources.test.ts.txt` (ran once, then removed from `src/`).
- **Tracer: kept as an internal sink, not dropped.** `RunCtx.trace.emit` keeps the POC's event names and fields. It is a no-op unless `DEBUG_PIPELINE` is set (then `console.debug`), and `runPipeline(config, emit, {trace})` lets a test collect it. This lets the replay compare the ported pipeline's own `filter.decision`, `tier.assign`, `owner.assign`, `verify.doc`, `filter.passages` and `action.write` events to the recorded ones field for field.
- **Replay stubs: keyed by request content, not by stage order.** Decision calls are keyed by their exact state (the fixture is checked to have no state with two probabilities); extraction and action calls by exact system + prompt; filter calls by the document numbers in the prompt. A request the trace never made gets an empty answer and is listed in `unrecorded`. Result: a drifted port fails on values (decisions, prompts) rather than on a stub throwing into the retry loop.
- **Stubs go through the real AI SDK.** `installModels` uses `MockLanguageModelV4` / `Experimental_DecisionMockModelV4` from `ai/test`, so `generateText` + `Output.object` and `experimental_decide` actually run (verified on `ai@7.0.179`: `decide` accepts `maxRetries`; mocks receive `responseFormat.schema`, which identifies the call kind).
- **What exhausting a Federal Register fetch does: unchanged from the POC.** `getDoc` still returns null (item held back with the POC's reason), and a failed govinfo read still falls back to the FR raw text. Only `listWindow` (scan) and model calls fail the run. Rationale: the `!doc` drop is a decision expression on the decision path; making transport failures throw instead would change it.
- **`assertPublic` matches the name as a word or a camelCase part.** `(?:\b[jJ]|(?<=[a-z])J)ev(?![a-z])`, `\bJEV\b`, plus the id prefixes. It catches `filter:jev`, `jevProbability`, `passedJev`, `JEV`, but lets "Sarajevo" and "Jevons" through, so a document title can't fail a live run by accident. The AC test over replay events uses the stricter plain substring check.
- **`run.start` carries the planned steps** (`plannedStages(config)`), so chunk 04 can show waiting steps. It repeats run.ts's branch conditions; `stages.test.ts` checks it against the steps actually started for all four filter modes.
- **`runPipeline` always emits exactly one terminal event** and rejects with `RunFailed` after `run.failed`, so the route never has to emit one itself.

## Deviations from the plan / POC

Decision expressions: `stages.ts` differs from the POC only in the lines listed in `evidence/poc-diffs.txt`, none in a decision. In `run.ts`, 29 of the 34 non-blank POC lines 56–90 appear verbatim. The 5 that don't are `ctx.run.decisions/dropped/items/markdown = …` assignments onto the POC's saved run record, now local values.

- **SDK retries off**: `generateText` `maxRetries: 2` → 0, `decide` `maxRetries: 3` → 0. Otherwise a call could be tried up to 9 times. Proven by the `sdk-retries-*` mutations.
- **Model resolved outside the retry** (`languageModel()`/`decisionModel()` run before `withRetry`), so a missing key fails at once with the generic message instead of after 6 s of retries.
- **Cut: `agent()`, the `tools` option, `toolCallsOf`, web leads, baseline, `newRun`/`execute`, `BudgetExceeded`/`init`/`guard`/`record`, `saveRun`.** T006 names `agent()`, but its only callers are web leads and the baseline. Web leads are a SPEC non-goal ("off in every evaluated setup") and never fed a decision. `agent()` would also need `gw`, which amendment 4's three-function gateway doesn't export.
- **`setModelsForTests` ported**, beyond amendment 4's `languageModel`/`decisionModel`/`gatewayCost`. It is the POC's own seam "so tests can run the real pipeline with fake models at no cost".
- **`fr.ts` edited** (chunk 02's file, not in this chunk's list): the plan requires Federal Register/govinfo fetches to be retried, and `getDoc`/`fetchText` swallow errors, so a wrapper at the call site could never fire.
- **`RunCtx.trace` no longer writes run JSON / JSONL**; `run.start`/`run.end` trace events are dropped (they described the saved record).
- **Gate 3 gained `[ -d src/lib/pipeline ]`**, so it can't pass by reading nothing.
- **Plan gates 2 and 3 matched my own comment and test literal** (`saveRun` in a run.ts comment, `"Jev p=…"` in an events test case) until I reworded/removed them. Both gates grep comments and tests too.

## Left alone (for the lead)

- **Worst-case time grew with Federal Register retries.** Passages are read one document at a time. If govinfo returns 5xx for every document, each costs 6 s of waits, plus another 6 s if the FR raw-text fallback also fails: up to about 20 × 12 s = 240 s on top of a normal run. That is no longer "far inside" 300 s. Options for a later chunk: a run-wide deadline, or no retry on the govinfo read since it already has a fallback.
- **For chunk 04:**
  - Import only types from `events.ts` in the browser. Its `STEP_LABELS` keys and regexes contain the internal name, which a bundle grep would hit.
  - A document the LLM filter never answered (even after its retry) appears in neither `screenedOut` nor `notReviewedCount`, so `items + dropped + screenedOut + notReviewed` can be less than `scanned`.
  - A downstream substring gate would flag a "Sarajevo" title that `assertPublic` lets through.
  - `runPipeline` takes the POC's `RunConfig`. Chunk 04 builds it from `{profileId, window}` and the `userView.setup` setup, as POC `api/try/route.ts` + `arena.cellConfig` did (`jevThreshold` 0.1 and `filter` come from `setups.yaml` `methods`).
- **Unreachable fallback, not tested:** `profile.areas[areas[0]]?.owner ?? profile.generalCounsel` in `stages.ts`. The filter schema restricts `areas` to the profile's own keys, so an unknown area can't arrive. It is POC code, kept verbatim.
- **History note:** commits `5fed2ec` and `7c5534b` have a type error in a test file (`omit`'s parameter type in `replay.test.ts`), because I typechecked before a late lint fix and committed without re-running it. Fixed in `2fac8ab`. The final tree typechecks clean.
- `parity.sh` could also cover `excerpts.ts` and `grade.ts`'s `majority` (both byte-identical to the POC). That's chunk 02's script, so I didn't edit it.
