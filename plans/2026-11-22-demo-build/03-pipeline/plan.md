---
chunk: 03
title: Port the pipeline with public step events and retries
branch: feat/demo-build--pipeline
base: main
execution: sequential
depends: [02]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 03 — Port the pipeline with public step events and retries

## Context

Chunk 02 ported config and the deterministic libraries. This chunk ports the pipeline
itself from `poc:poc/src/lib/pipeline/` (`context.ts`, `stages.ts`, `run.ts`,
`excerpts.ts`), plus the model layer from `poc:poc/src/lib/gateway.ts` and `models.ts`.
It ports only the live setup `jev-sonnet-strict-passages`; the baseline and arena paths
stay on `poc`. The sequence is:

1. scan
2. Jev relevance scores
3. Jev-picked passages for the top 20
4. strict LLM filter
5. re-fetch and verify dates
6. tier and route (code)
7. write actions (LLM)

Three changes, none of which may alter a decision:

1. **Public step events instead of server-side files.**
   - The POC's `RunCtx` writes run JSON and a JSONL trace to disk (`store.ts`,
     `trace.ts`). Here it instead emits typed events to a callback, which chunk 04 streams
     to the browser.
   - A **single table** maps each internal stage ID to a GC-facing label, e.g.
     `filter:jev` → "Ranked them by relevance to <company>".
   - **No event payload may contain** an internal model or component name: no "Jev", no
     `typesafe-ai/jev`, no model IDs, no prompt text.
   - The spend ledger (`store.ts` `spentUsd`/`budgetUsd`) is **not** ported (no spend
     guard, by user decision).
2. **Retries.** Every external call is tried at most 3 times in total, waiting 2 s before
   the second try and 4 s before the third. External calls are Federal Register/govinfo
   fetches, LLM calls and Jev calls. The longest added wait is 6 s per call; the POC's
   87 s worst case stays far inside Vercel's 300 s limit. After the third failure, the run emits `step.failed` with
   a plain-English timeout message and ends with `run.failed`. A retry re-issues the same
   request and never changes its inputs.
3. **The reason-text leak is fixed.** The POC's `stages.ts` (around line 281) falls back to
   `` `Jev p=${…} (no LLM reason)` `` for an item's reason. Replace it with a neutral
   fallback: "Flagged as relevant to your profile". The internal probability may still go
   to the server log, but never into the item.

**Parity is the contract.** This is a port, so prove it is identical on a recorded run.
Copy one recorded `jev-sonnet-strict-passages` trace from the suite
`poc:poc/data/evals/arena-2026-11-21-23-16-du8/traces/`; pick one whose run finished with
at least 1 item on a frozen week. Then replay it:

- Stub the model layer so each `jev.call` returns the recorded `probability` for its
  document number and passage index.
- Stub each `llm.call` to return its recorded `output`, keyed by stage.
- Run the ported pipeline on the same frozen week.
- Assert that the filter decisions, `tier.assign`, `owner.assign` and the final items equal
  the trace's, **ignoring only the `reason` text the leak fix changed**.

## Acceptance Criteria

- Given the replay fixture, When the ported pipeline runs with the stubbed model layer,
  Then every `filter.decision.relevant`, every tier, every owner and every item's
  `document_number`, `deadline` and `citation` equals the recorded trace.
- Given any emitted event, When serialized, Then it contains none of `jev`, `Jev`,
  `typesafe-ai`, `claude-`, `anthropic/`, `openai/`, `google/`, `moonshotai/` (checked
  case-insensitively by a test over every event of the replay run).
- Given a model call that throws twice and then succeeds, When the step runs, Then it
  succeeds, and the events show 2 `step.retry` events with delays 2000 and 4000 ms.
- Given a call that throws 3 times, When the step runs, Then the run ends with
  `step.failed` (stage label + timeout message) and `run.failed`, and no later stage
  runs.
- Given an item whose LLM reason is missing, When the item is built, Then its reason is
  "Flagged as relevant to your profile".

## What To Do

### Tasks

- [ ] T001 — copy the replay fixture:
  `git show poc:poc/data/evals/arena-2026-11-21-23-16-du8/traces/<id>.jsonl.gz > src/lib/pipeline/__fixtures__/replay-06.jsonl.gz`.
  Write the chosen `<id>` and why you chose it in the report.
- [ ] T002 — write failing tests:
  - `src/lib/pipeline/replay.test.ts`: the parity contract above. It fails until the
    stages are ported, because stub stages produce no decisions to compare.
  - `src/lib/pipeline/retry.test.ts`: a counting stub, with fake timers for the delays.
  - `src/lib/pipeline/events.test.ts`: the no-internal-names scan over the replay run's
    events, plus a constructed event carrying `model:"typesafe-ai/jev"` that must make the
    sanitizer throw.
- [ ] T003 — create `src/lib/pipeline/events.ts`:
  - the `RunEvent` union: `run.start`, `step.start`, `step.progress` (count, current
    item title), `step.retry`, `step.done` (count, ms), `step.failed`, `item.confirmed`,
    `run.done`, `run.failed`;
  - `run.done` carries:
    - `items`;
    - `dropped` (document number, title, plain reason: verification failures, shown to the
      GC as "held back");
    - `screenedOut`: every document the LLM filter rejected, as `{document_number, title,
      reason}` with the filter's one-line reason, in relevance-rank order, **without** any
      probability;
    - `notReviewedCount`: documents below the relevance cut, never sent to the filter;
    - `scanned`;
    - `markdown`;
  - the `STEP_LABELS` table (internal stage ID → label template);
  - `assertPublic(event)`, which throws on any internal name. The tests above are its
    contract.
- [ ] T004 — create `src/lib/pipeline/retry.ts`: `withRetry(fn, {attempts:3,
  delaysMs:[2000,4000]}, onRetry)`: 3 attempts, 2 waits. Each constant carries a one-line reason comment.
- [ ] T005 — create `src/lib/gateway.ts` and `src/lib/models.ts`, ported from the POC with
  only `languageModel`, `decisionModel` and `gatewayCost`. Read the key from the env var
  named in `project.md` Conventions.
- [ ] T006 — create `src/lib/pipeline/context.ts`, ported `RunCtx`:
  - `stage()`, `agent()`, `object()` and `jev()` wrap their external call in `withRetry`;
  - `trace.emit` becomes an internal no-op sink, or a debug log behind
    `process.env.DEBUG_PIPELINE`;
  - a separate `emit(event: RunEvent)` sends public events through `assertPublic`;
  - delete `saveRun`, `spentUsd`, `budgetUsd` and the `guard()` that read the ledger.
- [ ] T007 — create `src/lib/pipeline/stages.ts` and `src/lib/pipeline/excerpts.ts`,
  ported from the POC:
  - emit `step.*` events at each stage boundary, and `step.progress` per passage document
    with its title;
  - emit `item.confirmed` when an item passes verify and tier;
  - fix the reason fallback;
  - leave every decision expression untouched.
- [ ] T008 — create `src/lib/pipeline/run.ts`: `runPipeline(config, emit)`, which returns
  `{items, dropped, decisions, markdown}`. It covers the pipeline path only: no
  `baseline()`, no `saveRun`.
- [ ] T009 — edit `.claude/resources/project.md` Conventions: "GC-facing text comes only
  from `STEP_LABELS` and item fields; `assertPublic` guards every event".

Judgement calls (explain each choice in the report):

- You may keep the POC's internal `Tracer` event names as a debug sink or drop the tracer
  entirely.
- You may key the replay stubs by stage name plus order, or by document number.

Verify the AI SDK v7 `experimental_decide` and `generateText`/`Output` surfaces against the
installed package before relying on them; the POC used them at `ai@^7.0.179`.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `replay.test.ts` | decision parity on a recorded 06 run | a pipeline that, say, drops the passages stage changes which docs the filter sees, so the recorded filter outputs no longer line up and decisions differ |
| `events.test.ts` › replay events are public | no internal names reach the GC | a naive port emits `stage:"filter:jev"` labels and the `Jev p=` reason |
| `events.test.ts` › sanitizer throws | guard works | a no-op `assertPublic` doesn't throw on `typesafe-ai/jev` |
| `retry.test.ts` › 2 failures then success | back-off 2 s, 4 s | a no-retry wrapper rejects on the first throw |
| `retry.test.ts` › 3 failures | run fails, later stages skipped | a wrapper that swallows errors lets later stages run |
| `reason.test.ts` | neutral fallback reason | the POC fallback yields `Jev p=0.42 (no LLM reason)` |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| `assertPublic` | an event with `{label:"Jev scored 34"}` | `events.test.ts` |
| retry exhaustion | a stub that always throws `ETIMEDOUT` | `retry.test.ts` |
| missing LLM reason | a decision with `llm: undefined`, `jevProbability: 0.42` | `reason.test.ts` |

## Reuse Audit

Reuse: porting the POC's `pipeline/*.ts`, `gateway.ts` and `models.ts`; chunk 02's
`config`, `fr`, `verify`, `tier` and `prompts`. New: `events.ts` (public events and
labels) and `retry.ts`. Nothing equivalent exists in the POC, which never retried.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/bibles/swe/patterns/migration-verification.md` | A golden-fixture replay proves the port identical; any diff is a bug or a documented intentional change |
| `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md` | `run.ts` stays wiring: decisions live in stages, tier and verify, never in the orchestrator |
| `.claude/resources/bibles/swe/code-comments.md` | Comments explain why (e.g. retry constants), never reference the plan |
| `.claude/resources/project.md` | Principles 1–3; Conventions from chunk 02 |
| `git show poc:poc/SCHEMA.md` | The trace event formats the replay reads |
| `git show poc:poc/src/lib/pipeline/stages.ts` | The source of truth for every decision expression |

## External Dependencies

- `ai` v7 (`generateText`, `Output`, `experimental_decide`) and `@ai-sdk/gateway`: the
  replay test stubs them; no network in tests.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: the leak is gone from source
if grep -rn "Jev p=" src/; then echo "FAIL: internal reason text in src" >&2; exit 1; fi

# Gate 3: no ledger or persistence in the pipeline
if grep -rnE "saveRun|spentUsd|budgetUsd|spend-ledger" src/lib/pipeline; then
  echo "FAIL: POC persistence/ledger ported" >&2; exit 1; fi
```

Mutation check for the parity contract: change the Jev threshold comparison in
`stages.ts` from `>=` to `>`. Confirm `replay.test.ts` fails, revert, and confirm it
passes. Record both runs.

## Deliverables

- [ ] `completion-report.md`, committed. It includes the chosen replay trace id, the
      parity mutation runs, and both judgement-call choices.

## Artifacts Checklist

- ☐ New tests (replay, events, retry, reason)
- — Existing tests: chunk 02 owns the ported ones
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Conventions, Layout)
