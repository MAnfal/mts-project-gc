---
chunk: 06
title: Edge states, held-back items, and example runs in the GC view
branch: feat/demo-build--edge-states
base: main
execution: sequential
depends: [05, 07]
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

## Acceptance Criteria

- Given a finished run with 0 items, When the run view renders, Then the empty state renders with up to 3 closest
  calls, and the memo download contains the window, the count checked, and those calls.
- Given a run with 1 dropped item, When the run view renders, Then a held-back block renders above the table and the
  "Held back 1" badge counts it. "Add after checking" moves it into the table with a
  "Confirmed by you" badge, and the change survives a reload.
- Given a failed run, When the run view renders, Then the finished steps show as done, the failed step shows its
  message with "Retry" and "Edit settings", and "Edit settings" opens `/runs/new` filled
  with that run's config.
- Given the sidebar, When the run view renders, Then "Examples" lists the example runs from
  `/evals/user-view/index.json`. Each opens a report with no network call beyond the
  static files, and no internal name appears in the rendered report.

## What To Do

### Tasks

- [ ] T001 — write failing tests:
  - `src/lib/runs/fromRecordedRun.test.ts`: load one real example record from
    `public/evals/user-view/runs/` that has a `Jev p=` reason, and assert the adapter's
    view state passes `assertPublic` and keeps items, tiers and owners equal to the record.
    Find such a record with `grep -l "Jev p=" public/evals/user-view/runs/*`. If none
    exists, construct one from a real record and say so in the report.
  - `src/lib/runs/memo.test.ts`: the no-action memo and the held-back section.
  - `src/lib/runs/reduce.test.ts`: confirming a held-back item moves it, with a
    `confirmedBy:"user"` flag.
- [ ] T002 — create `src/lib/runs/fromRecordedRun.ts` and `src/lib/runs/memo.ts`.
- [ ] T003 — edit `src/lib/runs/reduce.ts` and `src/lib/runs/store.ts`: add the
  `item.confirmedByUser` action and persist it.
- [ ] T004 [P] — create `src/components/gc/EmptyReport.tsx`, `HeldBack.tsx` and
  `FailedStep.tsx`, styled from `design/HiStates.dc.html`.
- [ ] T005 — edit `src/components/gc/ReportView.tsx` and `RunSteps.tsx` to render those
  states. Edit `src/components/gc/GcSidebar.tsx` to add the Examples section.
- [ ] T006 — create `src/app/examples/[id]/page.tsx`, which renders an example run with
  the Report screen. It is read-only, with no Retry.

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

Run gate 2 on `main` before your work. It should pass there, so it proves nothing on its
own. Its value is as a regression guard, so also plant a canary (`"Jev"` in a component
string), confirm it fails, and remove it.

## Deliverables

- [ ] `completion-report.md`, committed, with screenshots of the empty state, held-back
      state (before and after confirming), failed state, and an example run.

## Artifacts Checklist

- ☐ New tests
- ☐ Existing tests updated (`reduce.test.ts`)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout; Conventions: held-back items surface
  only after a person confirms them)
