<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 06 — Edge states, held-back items, and example runs — Review Rubric

Grade each item PASS, FAIL, or N/A with the reason. A FAIL needs the evidence that
produced it: the file, the line, and what's wrong.

Items carrying a `.claude/resources/bibles/…` path cite the rule they check. **Open the
page before grading that item** — a cited rule graded from memory fails correct work as
often as it passes a violation.

## Universal Checks

- [ ] The change does what the acceptance criteria say, verified by reading the code — not
      by trusting the report
- [ ] Every verification gate was run **after the last edit**, and each one can actually
      fail (a gate that passes on the base tree proves nothing)
- [ ] New behavior has tests covering the happy path, the error path, and the edges
- [ ] `completion-report.md` exists and is committed — without it the evidence below
      cannot be graded
- [ ] The tests were observed failing before the implementation existed **for the right
      reason** — the report distinguishes a suite that failed to *import* (which proves
      only that the module was absent) from an assertion that failed against a *wrong
      value*. `0 tests collected` is an import error wearing a red run's clothes
- [ ] For every guarantee the chunk's plan calls a contract, the report shows that
      assertion failing against a **plausible wrong implementation** — one deliberate
      mutation per contract, not a mutation-testing pass
- [ ] For each defensive branch — a guard, a boundary, a clamp — a test exists whose input
      **cannot come from the committed fixture**. A real fixture contains only the cases
      that repository happened to produce; the guard for the case it didn't produce has
      nothing holding it
- [ ] Any abstraction introduced is justified in the plan's Design Decisions; no layer,
      base class, or indirection appears that the chunk didn't need
- [ ] No principle in `.claude/resources/project.md` is violated without a recorded
      justification
- [ ] No unrelated files touched; no scope beyond the chunk
- [ ] No secrets, credentials, or keys in the diff
- [ ] No silent failures — errors surface with context rather than being swallowed
- [ ] No duplicated logic that an existing helper already covers
- [ ] Error and warning counts are graded against the captured baseline, not absolutely
- [ ] Comments and docs the change touches are still true after it

## Test Coverage Checks

- [ ] Unit tests for `fromRecordedRun()` in `src/lib/runs/fromRecordedRun.test.ts` on a real
      example record from `public/evals/user-view/runs/` that carries a leaked internal
      reason (one acceptable proof that the leak is present: the raw record fails
      `assertPublic`): the adapter's view state passes `assertPublic`, and its items, tiers
      and owners equal the record's.
      If no shipped record carries a leak, a constructed copy of a real record is used and
      the report says so — `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for the memo builder in `src/lib/runs/memo.test.ts`: the no-action memo
      contains the window, the count checked and up to three closest calls; held-back items
      appear in their own section; a run with 0 items and 0 screened-out documents says
      there were no close calls
- [ ] Unit tests in `src/lib/runs/reduce.test.ts` for the confirm action: confirming a
      held-back item moves it from `dropped` into the items with a user-confirmed flag, and
      without that action a dropped item never reaches the items
- [ ] The confirmed state persists through `src/lib/runs/store.ts` — a save/get round-trip
      in `store.test.ts` returns the item as confirmed
- [ ] `EmptyReport.tsx`, `HeldBack.tsx`, `FailedStep.tsx` and `src/app/examples/[id]/page.tsx`
      are presentational; any branching logic left in them has a test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] A finished run with 0 items renders "Nothing affects <company> this week", the number
      of federal documents checked and the week, up to three closest calls (title ·
      reason, in rank order, from the screened-out list), and a "no action" memo download
      built in code
- [ ] Held-back items render above the report table in the orange status style, the
      "Held back N" badge equals their count, and each has an "Open on Federal Register"
      link to the record and an "Add after checking" button
- [ ] "Add after checking" moves the item into the table with a "Confirmed by you" badge,
      the change is stored on the run and survives a reload, and no held-back item ever
      enters the table without that action (Principle 3 in `.claude/resources/project.md`;
      the badge keeps the exception visible)
- [ ] The downloaded memo lists held-back items in their own section
- [ ] A failed run keeps finished steps shown as done; the failed step shows the red icon,
      its message, "Retry" and "Edit settings"; "Edit settings" opens `/runs/new` filled
      with that run's config; layout and copy follow `design/HiStates.dc.html`
- [ ] The sidebar's "Examples" section lists example runs from
      `/evals/user-view/index.json` with status `done` only; each opens read-only (no Retry)
      in the same Report screen with no network call beyond the static files.
      *Contradiction resolved:* one requirement says "the example runs", the stated
      constraint lists only those with status `done`; graded toward the constraint
- [ ] The adapter replaces leaked internal reasons with the same neutral fallback the
      pipeline uses (reused, not retyped) and runs `assertPublic` on its output; no internal
      name appears in any rendered example report
- [ ] No GC-facing code, event, UI string or response this chunk adds or edits contains an
      internal name — `Jev`, `typesafe-ai`, a model ID or prompt text; internal
      identifiers are allowed only inside pipeline code, never in what reaches the GC
- [ ] A case-insensitive grep for `jev|typesafe-ai` over `src/components/gc`, `src/lib/runs`,
      `src/app/runs` and `src/app/examples`, test files included, finds nothing, and the
      report shows a planted canary making that check fail. *Contradiction resolved:* the
      adapter and its test must detect leaked text without spelling the internal name
      inside those directories, so leak detection reuses `assertPublic` or a matcher
      exported from `src/lib/pipeline`
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes screenshots of the empty state, held-back before and after
      confirming, the failed state, and an example run
- [ ] `project.md` Layout gains the new paths; Conventions gains: held-back items surface
      only after a person confirms them
- [ ] Every line this chunk adds to `.claude/resources/project.md` is true of the tree after
      the chunk and was measured, not assumed (a version read off disk, a command actually
      run); each rule lives in one section only; and each added line passes the filtering
      test — removing it would let a cold reader make a mistake —
      `.claude/resources/bibles/prompt-engineering/conventions/ai-optimized-writing.md`

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
