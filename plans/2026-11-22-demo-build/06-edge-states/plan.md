---
chunk: 06
title: Edge states, held-back items, and example runs in the GC view
branch: feat/demo-build--edge-states
base: feat/plan--demo-build
execution: sequential
depends: [05, 07, 09]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 06 — Edge states, held-back items, and example runs

## Context

Chunks 04–05 render the happy path. This chunk adds the states in
`design/HiStates.dc.html`, plus the "Examples" list in the GC sidebar:

1. **Nothing applies.** A run with 0 items shows "Nothing affects <company> this week":
   - "All N federal documents from <week> were checked against your profile";
   - **Closest calls**: the first 3 of `run.done.screenedOut`, as title · reason, from
     chunk 03;
   - a "Download 'no action' memo" button, which produces a markdown memo built in code.
2. **Held back.** `run.done.dropped` lists items that looked relevant but failed
   verification, e.g. a date not found in the published text. They show **above** the
   report table in the orange status style:
   - each has "Open on Federal Register" and "Add after checking";
   - "Add after checking" moves the item into the table with a "Confirmed by you" badge,
     stored on the run in IndexedDB;
   - held-back items never enter the table on their own: that would violate Principle 3,
     that every surfaced date is verified. A person confirming it is the documented
     exception, and the badge makes it visible;
   - the downloaded memo lists held-back items in their own section.
3. **Failed run, refined.** Steps that finished stay visible. The failed step shows the
   red icon, its message, and "Retry" plus "Edit settings". Chunk 04 shipped the
   mechanics; this chunk matches the hi-fi copy and layout.
4. **Examples in the sidebar.** Chunk 07 publishes the POC's 22 example runs under
   `public/evals/user-view/`. List the ones with status `done` under "Examples" in
   `GcSidebar`. Opening one renders it with the same Report screen through an adapter,
   `fromRecordedRun(run, trace?)`, which maps the POC run record to the view state.
   - The adapter must apply the same public-naming rules: example runs recorded before the
     leak fix carry reasons like "Jev p=0.42 (no LLM reason)". The adapter replaces them
     with the neutral fallback, and `assertPublic` (chunk 03) is run on its output.

### Preflight amendment (lead, 2026-11-23)

The preflight checked this plan against what chunks 04, 05, 07 and 09 actually merged.
Where the text below conflicts with these points, these win:

1. **The GC projection is generated in Node, not in the browser.** The leak fix and the
   public check need server-side modules (`assertPublic`, `stepOf`, `screenedOut`,
   `NEUTRAL_REASON`), and the GC client may import only types from `events.ts`.
   - Add `src/lib/pipeline/recorded.ts` (server-only) and
     `scripts/build-examples.mts`. They project each `public/evals/user-view/runs/*.json`
     into public `RunEvent[]` plus a profile snapshot and metadata, written to
     `public/examples/{index.json,<id>.json}`.
   - Every emitted event passes `assertPublic`, and the `Jev p=` fallback becomes the
     neutral reason.
   - The GC `/examples/[id]` page reads **only** `public/examples/**` and renders through
     the existing `reduceEvents` + `ReportView`, unchanged in shape.
   - The rebuild is idempotent. A gate re-runs it and checks for a clean `git status`, and
     scans every file under `public/examples/` for internal names (Decision 9 applies to
     fetched JSON, not only JS).
2. **GC pages never read `/evals/user-view/**`.** Those files carry setup ids, model ids,
   stage ids, prompts and Gateway errors.
3. **Sources for closest calls and names:**
   - Titles come from the frozen week: `frozenWeek()` in Node; the browser loader
     `loadWeekDocs` for the reviewer route.
   - The company name comes from `presets()` or the record's custom profile name.
4. **Tests are constructed.** No shipped record has a `Jev p=` reason or a dropped item.
   The leak and held-back tests use constructed copies of a real record, and say so. The
   held-back and failed screenshots come from seeded IndexedDB. The only done 0-item
   example is `l14a` (custom).
5. **Held back.** `dropped` is `{document_number, title, reason}` and is produced only when
   a re-fetch fails. It has no tier, deadline, owner or url.
   - A row the GC confirms shows "Not tiered", deadline none, owner the general counsel,
     and an FR link built from `document_number`. It never gets a tier code didn't
     compute (Principle 1).
   - Store confirmations as a `confirmed: string[]` field on `StoredRun`, applied after
     `reduceEvents`, with no IndexedDB version bump. Do **not** add a `RunEvent` type; the
     pipeline's event contract is chunk 03's.
   - Older stored runs default to nothing confirmed.
   - T001's reduce test and T003 change accordingly.
6. **"Edit settings"** opens `/runs/new?from=<runId>`, prefilled from IndexedDB. Add
   `src/app/runs/new/page.tsx`, `NewRunForm.tsx` and the new-run initial state to the
   tasks, with a prefill test.
7. **Copy.** Retry re-posts the whole run, so no copy may claim "only the failed step
   reruns". Fix the HiStates copy, and also chunk 03's `TIMEOUT_MESSAGE` wording if it
   says the same. That message is GC-facing copy, not a decision; parity stays green.
8. **Reviewer-facing run report.** Chunk 09's amendment 2 moved this here.
   - Add `/evals/reports/[suiteId]/[runId]` for suite runs and user-view runs, including
     status `error`.
   - It renders items, tiers, owners and dates through a pure, browser-safe mapping in
     `src/lib/runs/recorded-view.ts`. The Node projection in point 1 reuses the same
     mapping, so there is one mapping, not two.
   - It may show internal names, because it is reviewer-facing.
   - Load one suite run by streaming `runs.jsonl.gz` through the loader and stopping at
     the match. Add a single-run loader for user-view.
   - Link it from chunk 09's `RunsView` and `RunPanel`, within 3 clicks of `/evals`.
     It is read-only.
9. **Gate 5.** Add the examples routes (`examples/[id]/page`, plus an examples index if
   you add one) to 04's Gate 5 `GC_ROUTES`, with a canary.
10. **Gates.** Write `plans/2026-11-22-demo-build/06-edge-states/gates.sh`. It runs:
    - `bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh`;
    - Gate 2, which must **fail** when a listed directory is missing;
    - the `public/examples/` scan and idempotence check from point 1;
    - the `poc/` count. Count explicitly: `! … | grep -q` can't fail under `set -e`.

    Servers are keyless on ports 3601–3609. No Gateway spend.

## Acceptance Criteria

- Given a finished run with 0 items, When the run view renders, Then the empty state renders with up to 3 closest
  calls, and the memo download contains the window, the count checked, and those calls.
- Given a run with 1 dropped item, When the run view renders, Then a held-back block renders above the table and the
  "Held back 1" badge counts it. "Add after checking" moves it into the table with a
  "Confirmed by you" badge, and the change survives a reload.
- Given a failed run, When the run view renders, Then the finished steps show as done, the failed step shows its
  message with "Retry" and "Edit settings", and "Edit settings" opens `/runs/new?from=<runId>` filled
  with that run's config (amendment 6).
- Given the sidebar, When the run view renders, Then "Examples" lists the example runs from
  `/examples/index.json` (generated; amendment 1). Each opens a report with no network call beyond the
  static files, and no internal name appears in the rendered report or in any fetched file.

## What To Do

### Tasks

- [x] T001 — write failing tests:
  - `fromRecordedRun.test.ts` → now tests for `recorded.ts` / `recorded-view.ts` (amendments 1, 8). Load one real example record from
    `public/evals/user-view/runs/` that has a `Jev p=` reason, and assert the adapter's
    view state passes `assertPublic` and keeps items, tiers and owners equal to the record.
    Find such a record with `grep -l "Jev p=" public/evals/user-view/runs/*`. If none
    exists, construct one from a real record and say so in the report.
  - `src/lib/runs/memo.test.ts`: the no-action memo and the held-back section.
  - `src/lib/runs/reduce.test.ts` (or a confirmations test): applying `confirmed: string[]`
    after `reduceEvents` moves a held-back item into the table as "Not tiered" (amendment 5).
- [x] T002 — create `src/lib/runs/fromRecordedRun.ts` and `src/lib/runs/memo.ts`.
- [x] T003 — edit `src/lib/runs/store.ts` (a `confirmed: string[]` field on `StoredRun`) and
  apply confirmations after `reduceEvents`. No new `RunEvent` type (amendment 5).
- [x] T004 [P] — create `src/components/gc/EmptyReport.tsx`, `HeldBack.tsx` and
  `FailedStep.tsx`, styled from `design/HiStates.dc.html`.
- [x] T005 — edit `src/components/gc/ReportView.tsx` and `RunSteps.tsx` to render those
  states. Edit `src/components/gc/GcSidebar.tsx` to add the Examples section.
- [x] T006 — create `src/app/examples/[id]/page.tsx`, which renders an example run with
  the Report screen from `public/examples/<id>.json` (amendment 1). It is read-only, with
  no Retry.
- [x] T007 — `src/lib/pipeline/recorded.ts` + `scripts/build-examples.mts` → `public/examples/**`
  (amendment 1); `src/lib/runs/recorded-view.ts` shared mapping (amendment 8).
- [x] T008 — `/runs/new?from=<runId>` prefill (amendment 6).
- [x] T009 — `/evals/reports/[suiteId]/[runId]` reviewer report + links from `RunsView`/`RunPanel`
  (amendment 8).
- [x] T010 — add examples routes to 04's Gate 5 `GC_ROUTES`; write `06-edge-states/gates.sh` (amendments 9–10).

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `fromRecordedRun.test.ts` | example runs are public and faithful | a pass-through adapter keeps `Jev p=` in the reason |
| `memo.test.ts` | no-action memo and held-back section | a memo built from items only omits the closest calls and the held-back section |
| `reduce.test.ts` › confirm held-back | user confirmation flow | without the action, the item stays in `dropped` |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| 0 items and 0 screened-out | a `run.done` with empty arrays | `memo.test.ts` (memo says "no close calls") |
| example record with leaked reason | a real record, or a constructed copy | `fromRecordedRun.test.ts` |

## Reuse Audit

Reuse: chunk 03's `assertPublic` and neutral fallback; chunk 04's reducer, store and
`ReportView`; chunk 07's `public/evals/user-view/` files and index. New: the adapter, the
memo builder and three state components.

## Reference Files

| File | Why |
| ---- | --- |
| `plans/2026-11-22-demo-build/design/HiStates.dc.html` | The three states to build |
| `.claude/resources/project.md` | Principle 3: unverified items never surface on their own |
| `.claude/resources/bibles/swe/testing.md` | Test the adapter with a real recorded example run |
| `git show poc:poc/SCHEMA.md` | The run-record format the adapter reads |

## External Dependencies

None new.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: no internal names in any GC-facing component or adapter
if grep -rniE "jev|typesafe-ai" --exclude='*.test.*' --exclude-dir='__fixtures__' \
     src/components/gc src/lib/runs src/app/runs src/app/examples; then
  echo "FAIL: internal name in GC-facing code" >&2; exit 1; fi
```

Run gate 2 on the base commit (the plan-branch tip this chunk was cut from) before your work. It should pass there, so it proves nothing on its
own. Its value is as a regression guard, so also plant a canary (`"Jev"` in a component
string), confirm it fails, and remove it.

## Deliverables

- [x] `completion-report.md`, committed, with screenshots of the empty state, held-back
      state (before and after confirming), failed state, and an example run.

## Artifacts Checklist

- ☐ New tests
- ☐ Existing tests updated (`reduce.test.ts`)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout; Conventions: held-back items surface
  only after a person confirms them)
