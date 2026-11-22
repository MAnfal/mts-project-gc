---
chunk: 11
title: Follow-up chat on a finished report
branch: feat/demo-build--followup-chat
base: main
execution: sequential
depends: [06]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 11 — Follow-up chat on a finished report

## Context

Once a run finishes, the GC can ask about the result: "Summarize for the CEO in 3 lines",
"Did anything on crypto come close?". The composer and suggestion chips sit at the bottom
of the Report, as in `design/HiReport.dc.html`, the same pattern as GC AI's follow-up box.
**Until the run finishes, the chat is hidden.**

Grounding rule: answers use **only** this run's report. That means:

- the items, each with tier, deadline, owner, reason, action and citation;
- the sources (titles, FR citations, links);
- the held-back list;
- `screenedOut`: titles and one-line reasons of the rejected documents;
- the profile the run used.

No web search and no other runs. When the answer isn't in that material, the model says
so. The chat is stateless on the server. The browser sends the run context plus the
conversation, and the turns are saved on the run's IndexedDB record, so they come back
after a reload.

Chunk 04's `ReportView` takes a `followUp?: ReactNode` prop. This chunk mounts the chat
through that prop from `src/app/runs/[id]/page.tsx` and `src/app/examples/[id]/page.tsx`,
the latter created by chunk 06. It does **not** edit `ReportView.tsx`.

The model and system prompt come from config: add `followUp: {model, system,
suggestions[]}` to `config/app.yaml`. Never add them to a decision-path file (`prompts.yaml`
or `experiment.yaml`).

The GC-facing rule still applies:
- Answers must not reveal internal names.
- The context sent to the model is built by a function that copies only public fields, so
  internal names never enter it. Run `assertPublic` (chunk 03) on the context object.

## Acceptance Criteria

- Given a finished or example run, Then the suggestion chips and composer render under the
  report.
- Given a running, failed or interrupted run, Then no chat UI renders.
- Given a question, When sent, Then the answer streams in token by token (AI SDK
  `streamText` through `/api/followup`, with `maxDuration` set). The turn pair is saved in
  IndexedDB under that run's ID (live or example) and comes back after a reload.
- Given the request body, Then the route rejects (400):
  - a context object that fails `assertPublic`;
  - a conversation over a size limit set in config (default 20 turns);
  - a missing `items` array.
- Given the context builder on a real recorded example run, Then its output contains no
  probability fields, model IDs or prompt text.
- Given a question the report can't answer, Then the system prompt instructs the model to
  say "That isn't in this report", and the test checks the instruction is present in the
  rendered system prompt. Model behaviour itself is not unit-testable.

## What To Do

### Tasks

- [ ] T001 — write failing tests:
  - `src/lib/followup/context.test.ts`: `buildFollowUpContext(viewState)` on a real
    example run from `public/evals/user-view/runs/` contains only whitelisted fields, and
    `assertPublic` passes on it.
  - `src/app/api/followup/route.test.ts`: the 400 cases, with constructed bodies.
  - `src/lib/runs/store.test.ts`: saving and reading chat turns on a run.
- [ ] T002 — create `src/lib/followup/context.ts` (whitelist copy) and
  `src/lib/followup/prompt.ts` (system prompt from config plus the grounding rules).
- [ ] T003 — create `src/app/api/followup/route.ts`: zod validation, `streamText` via the
  Gateway with the configured model, wrapped in chunk 03's `withRetry` for the initial
  connect only.
- [ ] T004 — create `src/components/gc/FollowUpChat.tsx`, with chips, composer and
  streamed turns, styled from the hi-fi. Use the AI SDK's React `useChat` if it fits the
  stateless body; otherwise a small fetch reader. Explain your choice.
- [ ] T005 — edit `src/app/runs/[id]/page.tsx` and `src/app/examples/[id]/page.tsx` to pass
  `<FollowUpChat/>` into `ReportView`'s `followUp` prop, only when status is `done`.
- [ ] T006 — edit `config/app.yaml` and `src/lib/config/schemas.ts`: add `followUp`.
- [ ] T007 — edit `src/lib/runs/store.ts`: add a `chats` store keyed by run ID (`live:<id>`
  or `example:<id>`), holding the turns. Example runs have no IndexedDB run record, so
  chat turns must not live on the run record.

Verify the AI SDK v7 `streamText` / `useChat` surfaces against the installed package
before relying on them.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `context.test.ts` | only public fields reach the model | a builder that spreads the whole view state includes `decisions[].jevProbability` |
| `route.test.ts` › 400s | input guards | a route that forwards any body to `streamText` returns 200 for a 50-turn conversation |
| `store.test.ts` › turns | chat persists | without the field, turns are lost on reload |
| `prompt.test.ts` | grounding instruction present | a prompt template missing the "not in this report" rule fails the assertion |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| context with an internal field | `{items:[…], debug:{model:"typesafe-ai/jev"}}` | `route.test.ts` |
| conversation too long | 21 turns | `route.test.ts` |

## Reuse Audit

Reuse: chunk 03's `assertPublic` and `withRetry`; chunk 04's store and `ReportView`
`followUp` prop; chunk 06's examples page. New: the context whitelist and the follow-up
route.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiReport.dc.html` | Chips + composer placement and style |
| `plans/2026-11-22-demo-build/design/gcai-ui-notes.md` | GC AI's follow-up chip and composer pattern |
| `.claude/resources/project.md` | Conventions: GC-facing text is public-only; UI config lives in `app.yaml` |
| `.claude/resources/bibles/swe/testing.md` | Test the context builder on a real recorded run |

## External Dependencies

- `ai` v7 `streamText` (server) and optionally `@ai-sdk/react` `useChat` (client), via the
  AI Gateway.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck
bash plans/2026-11-22-demo-build/02-core-libs/parity.sh

# Gate 2: chat never mounted on a non-finished run
grep -n "followUp" src/app/runs/\[id\]/page.tsx | grep -q "done" \
  || { echo "FAIL: followUp not gated on status done" >&2; exit 1; }
```

**Live smoke** (spends a few cents; the reviewer may skip it): ask "Summarize for the CEO
in 3 lines" on an example run, and paste the answer into the report.

## Deliverables

- [ ] `completion-report.md`, committed, with screenshots: chat hidden while running,
      chips + answer on a finished run, and an "isn't in this report" answer.

## Artifacts Checklist

- ☐ New tests
- ☐ Existing tests updated (`store.test.ts`)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout)
