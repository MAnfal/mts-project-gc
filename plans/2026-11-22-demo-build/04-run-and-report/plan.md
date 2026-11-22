---
chunk: 04
title: Streaming run, Running and Report screens, IndexedDB history and Retry
branch: feat/demo-build--run-and-report
base: feat/plan--demo-build
execution: sequential
depends: [03]
file-limit-waived: true
file-limit-reason: "A vertical slice needs the API route, the client stream reader, the IndexedDB store, and four screen components (sidebar, steps, report, sources). Splitting would leave a route with no UI or a UI with no route. Expected ~12 files."
---

# Chunk 04 — Streaming run, Running and Report screens, IndexedDB history and Retry

## Context

Chunk 03 gives `runPipeline(config, emit)`, which emits public `RunEvent`s
(`src/lib/pipeline/events.ts`). This chunk makes it a product. A route streams those
events to the browser. The browser renders the **Running** screen
(`design/HiRunning.dc.html`) and then the **Report** screen (`design/HiReport.dc.html`),
and saves every run — config, events, result, status — in **IndexedDB**. The server keeps
nothing (user decision: browser-only persistence).

User rule for failures: after 3 failed attempts on a step (03 already retries), the run
fails. The failed step shows the timeout message right under it, with a **Retry** button
that reruns with the same saved settings. The failed run is saved, so it shows again after
a reload.

There is no new-run form yet (chunk 05 builds it). To make the slice usable now, `/`
shows one button: "Run Ledgerly · Nov 2–6". It starts a run with the `ledgerly` preset
and the frozen week `2026-11-02`–`2026-11-06`.

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunk 03 actually merged. Where the text
below conflicts with these points, these win:

1. **RunConfig builder.** `runPipeline` needs the full `RunConfig`, and the POC's
   `cellConfig`/`cellByKey` were never ported. Add a server-only builder:
   - it looks up `experiment().userView.setup` in `setups()` (setups + methods);
   - it sets `asOf = windowEnd`, and maps a custom profile to `profileId "custom"`;
   - test it against the decision fields of the recorded `run.start.config` that
     chunk 03's `runReplay` exposes (`jev-sonnet-strict-passages`).
2. **Stored record.** The record stays `{id, createdAt, request, events, status, result,
   profile}`:
   - `request` is the request body (profileId or custom profile, plus window);
   - `result` is the `run.done` payload;
   - `profile` is a snapshot (see 11).

   Never store `RunConfig` or pipeline `decisions`: they hold model ids and internal
   scores (Decision 9). Retry re-posts `request`.
3. **Validation.** Check profile ids against `presets()`, not `getCompany` (`brightside`
   exists with `use: eval` and must be rejected). A custom body is a full `CompanySchema`
   profile, because chunk 05 sends edited presets with areas. Count the window
   inclusively (≤ `maxWindowDays`), and return 400 for malformed dates. Error responses
   use plain text, with no internal names.
4. **Exactly one terminal event.** `runPipeline` already emits `run.failed`, then rejects
   with `RunFailed`. On `RunFailed`, just close the stream. Emit an unexpected-error
   `run.failed` only for errors thrown outside `runPipeline`, and never twice. The emit
   sink must no-op after the stream's `cancel()`. Known: the run keeps spending after a
   client disconnect, because there is no AbortSignal. Document it and don't fix it.
5. **Dropped stream.** The stream can end or error with no terminal event, or the
   response can be non-OK, while the page is open. Then the run is saved as
   **Interrupted** with Retry, and the pure client reader test covers it. A reload
   mid-run is handled the same way. The 87 s rationale is stale: chunk 03's `retry.ts`
   says a govinfo outage can add up to about 240 s, and a 300 s hard timeout emits no
   terminal event, which is exactly this case.
6. **Client imports only types from `events.ts`.** Strike `STEP_LABELS` from the Reuse
   Audit, because its keys and regexes contain internal names. Labels come from
   `run.start.steps` / `step.start.label`. Gate: grep the GC client source for any value
   import from `events.ts`.
7. **Test infrastructure.** Vitest discovers `src/**/*.test.ts`, with no DOM environment,
   and the `src/lib` convention forbids React. So:
   - the NDJSON reader, the start/retry logic and the report derivations (summary
     sentence, why-tier, mailto, counts) go in pure `src/lib/runs/*.ts` modules, each
     with a colocated `.test.ts`;
   - the React hook moves to `src/components/gc/useRun.ts`;
   - add `fake-indexeddb`, pinned exactly, for the IndexedDB store test.

   `ReportView.test.tsx` becomes tests on the pure derivations.
8. **Fixture.** Public events come only from `runReplay().events`, which is Brightside,
   not Ledgerly. `StepKey` has 6 values. The reducer test replays those events, so read
   "7 steps" below as "every step in `run.start.steps`".
9. **Reducer state.** Keep everything `run.done` carries: `items`, `dropped`,
   `screenedOut`, `notReviewedCount`, `scanned`, `markdown` and `ms`. Also track
   `step.retry`, and `run.failed` with `step: null`. "N not relevant" is
   `screenedOut.length`. Never derive a count by subtracting from `scanned`; the parts can
   sum to less than `scanned`.
10. **Pages.** `/runs/[id]/page.tsx` is a server page: it calls `await connection()`,
    reads the wordmark and presets from config, and renders a client `RunView`. `params`
    is a Promise in Next 16. `/` stays a server component with a client button child.
11. **Profile tab.** It renders from the run's stored `profile` snapshot: the preset passed
    down from the server page, or the custom profile. A replay needs no network.
12. **Dependencies and docs.**
    - Add `pnpm exec shadcn add table tabs collapsible`.
    - Record every new package in project.md Stack.
    - Per-run cost is about $0.24 (`setups.yaml` estUsd).
13. **Gates.** Add these:
    - `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh`;
    - the `poc/` check on the HEAD tree and on `feat/plan--demo-build..HEAD`;
    - the events.ts value-import grep (point 6).
14. **Live smoke test is lead-only.** The implementer and the reviewer don't spend Gateway
    credit. The lead runs one live run at the US1 checkpoint.

## Acceptance Criteria

- Given `POST /api/run` with `{profileId:"ledgerly", windowStart:"2026-11-02",
  windowEnd:"2026-11-06"}`, When it runs, Then the response is `application/x-ndjson`
  with one `RunEvent` per line, ending in `run.done` or `run.failed`. The route declares
  `maxDuration = 300`.
- Given a body that fails validation, Then the route returns 400 with a plain message and
  starts no run. Validation failures: an unknown `profileId`, a window longer than
  `config/app.yaml` `maxWindowDays`, `windowEnd < windowStart`, or a custom profile
  missing `summary`.
- Given a custom profile in the body, When it runs, Then the pipeline uses it. The server
  never writes it anywhere.
- Given the Running screen, When events arrive, Then:
  - steps render as done, in progress or waiting, with counts and timings;
  - the step in progress shows its sub-items, with a spinner that respects
    `prefers-reduced-motion`;
  - the status line is an `aria-live="polite"` region;
  - skeleton placeholders hold the report's space.
- Given `run.done`, Then the Report renders:
  - "Worked for Ns" (collapsible back to the steps);
  - a heading and summary written from the items, e.g. "3 sanctions notices for Marcus,
    nothing Critical", built from counts, tiers and owners in code, no LLM;
  - tier counts as paired status badges, plus a "Held back N" badge;
  - a table: Priority | Rule and what to do (with numbered source chips) | Deadline with
    "Verified" | Owner;
  - "Why <tier>?" for each item, built from the tier rule's reason;
  - "Draft email to <owner>", a `mailto:` with a plain-text body built from that owner's
    items;
  - "N not relevant · see why", listing the screened-out documents' one-line reasons;
  - Download `.md` (the pipeline's markdown) and `.json`;
  - the Sources | Profile right panel.
- Given `run.failed`, Then the failed step shows its timeout message under it and a
  **Retry** button. Retry starts a new run with the identical saved config.
- Given a reload at any point after a run finished or failed, Then the sidebar's "Recent
  runs" lists it from IndexedDB and opening it re-renders it from the stored events, with
  no network call.
- Given a reload during a run, Then that run shows as "Interrupted" with Retry. A stream
  can't resume after a reload; say so in the UI.

## What To Do

### Tasks

- [x] T001 — write failing tests:
  - `src/lib/runs/store.test.ts` (with `fake-indexeddb`): save, list newest-first, get
    by id, and mark interrupted.
  - `src/app/api/run/route.test.ts`: the 400 cases, using constructed bodies.
  - `src/lib/runs/reduce.test.ts`: `reduceEvents(events)` turns an event list into view
    state. Feed it the replay events from chunk 03's fixture plus a constructed
    `run.failed` sequence.
  - `src/lib/runs/reader.test.ts` (pure reader; amendment 7): with a mocked `fetch` whose body streams NDJSON in
    chunks that split lines mid-way, assert that every event is parsed once and appended
    to the store. Also assert `retry()` posts the stored config unchanged.
- [x] T002 — create `src/app/api/run/route.ts`:
  - validate the body with zod, using limits from `config/app.yaml`;
  - call `runPipeline` with an `emit` that writes NDJSON lines to a `ReadableStream`;
  - catch-all errors become a `run.failed` event, never a 500 with a stack;
  - `export const maxDuration = 300`, because Vercel Hobby's maximum is 300 s and the
    worst case observed is 87 s.
- [x] T003 — create `src/lib/runs/reduce.ts`: the pure reducer from `RunEvent[]` to
  `{steps, items, dropped, status, failedStep}`. Both live rendering and replay from
  IndexedDB use it.
- [x] T004 — create `src/lib/runs/store.ts`, a typed IndexedDB wrapper. Database
  `reg-monitor`, store `runs`, record `{id, createdAt, request, events, status, result, profile}` (amendment 2).
  Every call is wrapped in try/catch and degrades to in-memory with a visible notice when
  IndexedDB is unavailable (private mode). You may use the `idb` package or raw IndexedDB;
  explain your choice.
- [x] T005 — create `src/components/gc/useRun.ts` (amendment 7; pure logic in `src/lib/runs/`), a client hook that:
  - POSTs, reads the NDJSON stream line by line, and appends each event to state and to
    the store;
  - exposes `retry()`, which starts a new run with the stored config.
- [x] T006 [P] — create `src/components/gc/GcSidebar.tsx`: composes chunk 01's
  `SidebarNav` with New run, All runs, Company profiles, RECENT RUNS from the store, and
  the user footer. Don't edit `src/components/shell/*`.
- [x] T007 [P] — create `src/components/gc/RunSteps.tsx`, the Running step list from the
  hi-fi, with icons from `lucide-react`.
- [x] T008 [P] — create `src/components/gc/ReportView.tsx` (heading, summary, badges,
  table, actions, and an optional `followUp?: ReactNode` prop rendered in the hi-fi's
  composer position, which the page passes in) and
  `src/components/gc/SourcesPanel.tsx`, using shadcn `Table`, `Badge`, `Tabs`,
  `Collapsible` and `Button`.
- [x] T009 — create `src/app/runs/[id]/page.tsx` (server page + client `RunView`; amendment 10), which renders a run from the
  store with `RunSteps` and `ReportView`, and edit `src/app/page.tsx` so `/` shows the
  "Run Ledgerly · Nov 2–6" button, which starts a run and navigates to `/runs/<id>`.
- [x] T010 — edit `.claude/resources/project.md`:
  - Commands: "Run a monitor pass" →
    `curl -sN -X POST localhost:3000/api/run -H 'content-type: application/json' -d '{"profileId":"ledgerly","windowStart":"2026-11-02","windowEnd":"2026-11-06"}'`.
    Mark it as spending real Gateway credit (~$0.24).
  - Layout: add the new paths.

Match `design/HiRunning.dc.html` and `design/HiReport.dc.html` for layout, spacing and
copy tone, with theme tokens only. Numbers and text come from the run, never from the
mockup. The mockup's three Ledgerly rows are what a real Nov 2–6 run produced, so a live
run should look like it, but render whatever the run returns.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `store.test.ts` › newest first; get; interrupted | persistence contract | a store keyed by an auto-increment without `createdAt` sorting returns oldest first |
| `route.test.ts` › 400s | input validation | a route that passes the body straight to `runPipeline` returns 200 for a 30-day window |
| `reduce.test.ts` › `runReplay().events` → every step in `run.start.steps` done, N items (amendment 8) | rendering state | a reducer that ignores `step.progress` loses the in-progress sub-items count |
| `reduce.test.ts` › failed sequence → failedStep + message | retry UI state | a reducer that maps `run.failed` to generic "error" loses which step failed |
| `src/lib/runs/report.test.ts` › summary sentence from items (amendment 7) | deterministic copy | a hard-coded heading doesn't change for a 0-item run |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| `maxWindowDays` | an 8-day window | `route.test.ts` |
| reversed window | `windowEnd` before `windowStart` | `route.test.ts` |
| IndexedDB unavailable | `indexedDB` undefined in the test env | `store.test.ts` |
| reload mid-run | a stored run with status `running` and no terminal event | `store.test.ts` |

## Reuse Audit

Reuse: chunk 03's `runPipeline` and `RunEvent` types (not `STEP_LABELS`; amendment 6); chunk 01's `AppShell` and
`SidebarNav`; shadcn primitives. The POC's `/try` page (`git show poc:poc/src/app/try/…`)
shows the report fields but polls disk; don't port its data path. New: the NDJSON route,
the reducer and the IndexedDB store.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiRunning.dc.html` | The Running screen to build |
| `plans/2026-11-22-demo-build/design/HiReport.dc.html` | The Report screen to build, including the sources panel and composer slot |
| `plans/2026-11-22-demo-build/design/gcai-ui-notes.md` | Tokens and component specs |
| `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md` | The route is wiring only; view logic lives in the pure reducer |
| `.claude/resources/bibles/swe/testing.md` | Test the reducer with the real recorded events, not hand-made ones |
| `src/lib/pipeline/events.ts` | The event contract this chunk consumes |

## External Dependencies

- Browser IndexedDB (`fake-indexeddb` in tests), and optionally `idb`
- Next.js route handlers streaming a `ReadableStream`. Verify the streaming response
  behaviour on Next 16 against the installed version.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: the route streams NDJSON and validates (no network: a 400 path)
pnpm start -p 3104 & SRV=$!; sleep 4
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3104/api/run \
  -H 'content-type: application/json' -d '{"profileId":"ledgerly","windowStart":"2026-11-01","windowEnd":"2026-11-30"}')
kill $SRV
[ "$code" = "400" ] || { echo "FAIL: 30-day window not rejected ($code)" >&2; exit 1; }
```

**Live smoke test** (spends ~$0.24; lead-only at the US1 checkpoint, amendment 14): run the "Run a monitor
pass" command once. Paste the event types it streamed and the final item count in the
report.

## Deliverables

- [ ] `completion-report.md`, committed. It includes screenshots of Running, Report,
      Failed+Retry and the 390 px width view, and the live smoke output if run.

## Artifacts Checklist

- ☐ New tests for new behavior
- — Existing tests: none affected
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Commands: run a monitor pass; Layout)
