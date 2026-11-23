---
chunk: 11
title: Follow-up chat on a finished report
branch: feat/demo-build--followup-chat
base: feat/plan--demo-build
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
conversation, and the turns are saved in IndexedDB (a separate `chats` store, amendment 6), so they come back
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

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunks 01–10 actually merged. Where the text
below conflicts with these points, these win:

1. **Mount point.** Mount the chat in `RunView.tsx` and `ExampleView.tsx`, where
   `ReportView` renders under `status === "done"`, through `ReportView`'s `followUp`
   prop. The server pages pass only `suggestions: string[]` from config as props. Never
   mount it on `/evals/reports/**`. Replace Gate 2 with a tested mount condition: the
   chat is hidden with no finished report, and shown on done live runs and on examples.
2. **Retry that really retries.** In `ai` 7.0.179, `streamText` returns immediately and
   puts errors in the stream, so `withRetry` around it is a no-op.
   - Await the first stream part inside `withRetry`, with the policy passed as a
     parameter as in `suggest.ts`, so tests use zero delays.
   - Always set `maxRetries: 0`.
   - A missing key returns a fixed plain-text 503 before streaming starts.
   - `toTextStreamResponse` ends silently on error, so emit a fixed failure signal the
     UI can render.
3. **Public check.** `assertPublic` takes a `RunEvent`. Use
   `assertPublicText(JSON.stringify(context), "follow-up context")` server-side in the
   route's helper, and the same on the system prompt.
4. **Module placement.**
   - The browser-side context builder goes in `src/lib/runs/followup-context.ts`, inside
     the dirs Gate 4 and `GC_DIRS` already scan.
   - The prompt and model call go in a server-only sibling of the route,
     `src/app/api/followup/followup.ts`, following the `suggest-areas` pattern.
   - `route.ts` exports only handlers and segment config.
   - There is no `src/lib/followup/`.
5. **Client streaming.** `@ai-sdk/react` is not installed. Read the response with `fetch`
   and a stream reader (or `readUIMessageStream` from `ai`), and add no new dependency.
   If you add one anyway, pin it and record it in Stack.
6. **Persistence.** Use a separate `chats` store (T007): `store.ts` VERSION 3 creates only
   the missing store, the upgrade keeps runs and profiles, and `RunStore.getChat`/
   `saveChat` get a memory fallback. Turns are **not** written on the run record. Read
   the Context and Test Plan below accordingly.
7. **Examples.** Chat turns are the only IndexedDB write an example page makes. They are
   an explicit exception to chunk 06's read-only rule.
8. **Context builder.**
   - The signature is `buildFollowUpContext(view, profile)`, built on the
     `applyConfirmed` view. Items checked by the GC are included and marked untiered.
   - The test fixture is `public/examples/<id>.json` through `reduceEvents`.
   - Add a constructed view with an extra internal field, which the builder must drop
     (whitelist, not blacklist).
   - 0 items is a valid context.
9. **Tests.** Stub the model with `setModelsForTests` and a mock language model that
   implements `doStream`; the existing helper only stubs `doGenerate`. A bad request gets
   a 400 with zero model calls.
10. **Config and caps.** Put `followUp: {model, system, suggestions, maxTurns,
    maxMessageChars, maxContextChars}` in `config/app.yaml`, with its schema. Enforce the
    caps server-side and test them. 05's Gate 3 seds every `  model:` line in app.yaml, so
    keep the same indentation.
11. **Gates and spend.**
    - Add `AI_GATEWAY_API_KEY= PORT=3801 bash plans/2026-11-22-demo-build/06-edge-states/gates.sh`.
    - Add a keyless curl of `/api/followup`: a 503 and the 400s, with no model id or
      `AI_GATEWAY` in any body.
    - Add the `poc/` count, counted explicitly.
    - Drop the live smoke test. The implementer and the reviewer spend nothing, and answer
      screenshots come from seeded turns. The lead runs one short live check at the end.
    - Servers run on ports 3801–3809.

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

- [x] T001 — write failing tests:
  - `src/lib/runs/followup-context.test.ts`: `buildFollowUpContext(view, profile)` on a real
    example from `public/examples/` (via `reduceEvents` + `applyConfirmed`) contains only
    whitelisted fields; a constructed view with an extra internal field drops it
    (amendment 8).
  - `src/app/api/followup/followup.test.ts`: the 400 cases with zero model calls, the 503,
    caps, streaming via a mock `doStream`, a retry that re-attempts (amendments 2, 9, 10).
  - `src/lib/runs/store.test.ts`: the `chats` store (VERSION 3) round-trip and upgrade
    (amendment 6).
- [x] T002 — create `src/lib/runs/followup-context.ts` (whitelist copy) and the server-only
  prompt in `src/app/api/followup/followup.ts` (amendment 4).
- [x] T003 — create `src/app/api/followup/route.ts` (handlers only) + `followup.ts`: zod
  validation, `assertPublicText`, `streamText` via the Gateway with the configured model,
  first stream part awaited inside `withRetry`, `maxRetries: 0` (amendments 2–4).
- [x] T004 — create `src/components/gc/FollowUpChat.tsx`, with chips, composer and
  streamed turns, styled from the hi-fi. Use a fetch stream reader (no new dependency;
  amendment 5).
- [x] T005 — mount `<FollowUpChat/>` via `ReportView`'s `followUp` prop in `RunView.tsx` and
  `ExampleView.tsx`, only when status is `done`; pages pass `suggestions` (amendment 1).
- [x] T006 — edit `config/app.yaml` and `src/lib/config/schemas.ts`: add `followUp` with caps (amendment 10).
- [x] T007 — edit `src/lib/runs/store.ts`: add a `chats` store keyed by run ID (`live:<id>`
  or `example:<id>`), holding the turns. Example runs have no IndexedDB run record, so
  chat turns must not live on the run record.

Verify the AI SDK v7 `streamText` / `useChat` surfaces against the installed package
before relying on them.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `context.test.ts` | only public fields reach the model | a builder that spreads the whole view state includes `decisions[].jevProbability` |
| `route.test.ts` › 400s | input guards | a route that forwards any body to `streamText` returns 200 for a 50-turn conversation |
| `store.test.ts` › chats store | chat persists | without the `chats` store, turns are lost on reload (amendment 6) |
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

Write them to `plans/2026-11-22-demo-build/11-followup-chat/gates.sh` (amendment 11):

```bash
set -e
AI_GATEWAY_API_KEY= PORT=3801 bash plans/2026-11-22-demo-build/06-edge-states/gates.sh  # 05→04→03, parity, examples, Gate 5
# Gate 2 replaced by the tested mount condition (amendment 1)
# keyless curl of /api/followup: 503 + 400s; no model id / AI_GATEWAY in bodies
# poc/ count (explicit)
```

**Live smoke**: lead-only, at the end (amendment 11).

## Deliverables

- [ ] `completion-report.md`, committed, with screenshots: chat hidden while running,
      chips + answer on a finished run, and an "isn't in this report" answer.

## Artifacts Checklist

- ☐ New tests
- ☐ Existing tests updated (`store.test.ts`)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout)
