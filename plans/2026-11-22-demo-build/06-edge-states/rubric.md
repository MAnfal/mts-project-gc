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

- [ ] Unit tests for the recorded-run adapter (`fromRecordedRun()` or whatever the plan
      names it) in its colocated `*.test.ts`, run on a real record from
      `public/evals/user-view/runs/`: the view state it yields keeps the record's items,
      tiers and owners unchanged; its closest calls are the record's LLM-rejected decisions
      in the same order the live pipeline uses (most relevant first), with titles; its
      checked count equals the record's `scanned`. A `done` record with 0 items (the shipped
      user-view set has one) yields the empty state's inputs —
      `.claude/resources/bibles/swe/testing.md`
- [ ] The adapter's leak handling is tested on a **constructed** copy of a real record with
      a leaked internal reason (no shipped record carries one: 0 of the 461 shipped run
      records contain `Jev p=` or "no LLM reason"). The test shows the raw copy failing the
      public-name check and the adapter's GC-facing output passing it, with the reason
      replaced by the pipeline's own neutral fallback (imported, not retyped)
- [ ] The adapter is tested on a failed record (status `error`): it yields a failed view
      (finished steps done, the failure shown) rather than throwing or an empty report. For
      GC-facing output, the failure text is a fixed public message, never the recorded
      `error` string (recorded errors name the Gateway's internal exception)
- [ ] Unit tests for the memo builder in `src/lib/runs/memo.test.ts`: the no-action memo
      contains the window, the count checked and up to three closest calls; held-back items
      appear in their own section; a run with 0 items and 0 screened-out documents says
      there were no close calls
- [ ] Unit tests for confirming a held-back item (in `reduce.test.ts` or the module that
      owns it): confirming moves exactly that item from held back into the report with a
      user-confirmed flag; without a confirmation, a held-back item never reaches the
      items; confirming an unknown document number, or the same one twice, changes nothing
- [ ] Persistence of confirmations through `src/lib/runs/store.ts`: a save/get round-trip
      in `store.test.ts` returns the item as confirmed, and a stored run saved before this
      chunk (no confirmation field) still opens with nothing confirmed
- [ ] Every sentence and count the new states show (empty-state lines, "N items held back",
      closest-call lines, the confirmed row's labels, the "Held back N" count after
      confirming) is derived in `src/lib/runs/report.ts` (or a sibling pure module) with
      tests; components only render them
- [ ] If "Edit settings" prefills `/runs/new` through a new query parameter or initial
      state, the function that turns a stored run into the form's initial state has a test,
      including an unknown or missing run id
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
- [ ] Every new `throw` or guard (missing title for a document number, unknown stage name,
      malformed record, missing run, leak found) has a test whose input is constructed,
      not drawn from a shipped record, and the report names that test per guard

## Chunk-Specific Checks

Convention Map rows matched: `src/lib/**/*.ts`
(`.claude/resources/bibles/swe/testing.md`); `src/lib/runs/**/*.ts`,
`src/components/gc/**/*.tsx` (`.claude/resources/bibles/swe/testing.md`);
`src/components/**/*.tsx` (no doc); `src/app/evals/**`, `src/components/evals/**`
(`.claude/resources/bibles/swe/testing.md`) for the reviewer-facing report route and its
links. Conditional, applied only if the chunk touches them: `public/evals/**`,
`scripts/*eval*` (no doc); `src/lib/pipeline/**/*.ts`
(`.claude/resources/bibles/swe/patterns/migration-verification.md`). No row matches
`src/app/examples/**`; it is graded by the GC-route items below. The `project.md` edit is
governed by the prompt-engineering bible.

**Which route is which.** The example pages under the GC shell (opened from the GC
sidebar's "Examples") are **GC-facing**: Decision 9 applies to them in full. The report a
reviewer opens from the eval view's Runs page and run panel lives under `/evals/` and is
**reviewer-facing**: it may show internal names (setup ids, model ids, stage ids,
recorded error text).

### Empty state, held back, failed run

- [ ] A finished run with 0 items renders "Nothing affects <company> this week", the number
      of federal documents checked and the week, up to three closest calls (title ·
      reason, most relevant first, from the screened-out list), and a "no action" memo
      download built in code; fewer than three screened-out documents shows that many
- [ ] Held-back items render above the report table in the orange status style, the
      "Held back N" count equals the number still held back, and each has an "Open on
      Federal Register" link to that document's federalregister.gov page and an "Add after
      checking" button
- [ ] "Add after checking" moves the item into the table with a "Confirmed by you" badge;
      the change is stored on the run and survives a reload; no held-back item ever enters
      the table without that action (Principle 3 in `.claude/resources/project.md`; the
      badge keeps the exception visible)
- [ ] A confirmed held-back item is never given a tier, deadline or owner the pipeline did
      not compute (Principles 1 and 3): any value it shows is either the pipeline's own or
      an explicit "not checked"/"none" state, and the report says which
- [ ] Example and reviewer-facing reports are read-only: no "Add after checking", Retry or
      write to IndexedDB from them
- [ ] The downloaded memo lists held-back items in their own section
- [ ] A failed run keeps finished steps shown as done; the failed step shows the red icon,
      its message, "Retry" and "Edit settings"; "Edit settings" opens `/runs/new` filled
      with that run's profile and window; layout follows `design/HiStates.dc.html`. Copy
      never claims more than the code does: Retry re-posts the whole request, so no label
      says only the failed step reruns

### Example runs (GC-facing)

- [ ] The sidebar's "Examples" lists only recorded example runs with status `done`; each
      opens read-only in the same Report screen (chunk 04's `ReportView`, reused, not
      forked) with no network call beyond static files
- [ ] **Decision 9 on what a GC route downloads.** Nothing a GC-facing route loads — JS
      chunks **and** fetched JSON, HTML or RSC payloads — names an internal component,
      model id, model vendor path, setup id or stage id. Shown per URL against a keyless
      local server for the examples list and at least two example pages (the empty one
      included): the URLs fetched and a case-insensitive check of each body for
      `jev`, `typesafe-ai`, `claude-`, `anthropic/`, the setup ids in
      `public/evals/user-view/index.json`, and the stage ids in `STEP_LABELS`. The raw
      `public/evals/user-view/` files carry model ids and `setup: "jev-…"`, so fetching
      them from a GC page fails this item however clean the rendered text is
- [ ] Any projection of the example runs is generated, not hand-written: it is rebuilt by a
      committed script or build step from the eval bundle, a second rebuild leaves
      `git status` clean, and `public/evals/` itself is untouched by hand
      (`bash scripts/verify-eval-bundle.sh` passes). No route or server module reads
      `public/evals` at request time
- [ ] The adapter's GC-facing output passes `assertPublic` (or the same matcher, reused)
      where it is produced. Leak detection is never re-implemented as a second regex list
- [ ] Every GC-facing route this chunk adds is in chunk 04's Gate 5 route list
      (`GC_ROUTES` in `plans/2026-11-22-demo-build/04-run-and-report/gates.sh`), and the
      report shows Gate 5 failing on a planted internal name in that route's client code

### Reviewer-facing run report

- [ ] A route under `/evals/` renders the report for any recorded run — a suite run or an
      example run, `done` or `error` — in chunk 04's `ReportView`, sharing the examples'
      mapping (items, closest calls, held back, steps) rather than a second copy of it
- [ ] The eval view's Runs page rows and the run panel each link to that run's report;
      the report lists the click count from `/evals` for one suite run, one example run and
      one failed run (at most 3, as for raw traces)
- [ ] The reviewer-facing report is not imported by, or linked from, any GC route, and the
      GC sidebar gains no eval link

### Browser code and conventions

- [ ] Browser code (`src/lib/runs/**`, `src/components/gc/**`, `src/app/**` outside
      `src/app/api`, and any module they import) imports neither `@/lib/config`, a
      `server-only` module nor a Node built-in, and only `import type { … }` from
      `pipeline/events` (Gate 4) — `.claude/resources/bibles/swe/testing.md`
- [ ] Screen state for live and stored runs still comes from `reduceEvents`; a user
      confirmation is stored on the run without adding a type to the pipeline's public
      `RunEvent` contract, unless the plan records that change
- [ ] Any new IndexedDB object store bumps the `reg-monitor` version and creates only the
      stores the old version lacks; a new field on an existing record needs no bump and is
      read with a default
- [ ] A case-insensitive grep for `jev|typesafe-ai` over `src/components/gc`, `src/lib/runs`,
      `src/app/runs` and `src/app/examples`, test files included, finds nothing; the
      directory list fails if a listed directory is missing (a missing directory must not
      pass vacuously); and the report shows a planted canary making it fail
- [ ] UI rules hold for every component and page this chunk adds or edits: colours, radii
      and shadows come from theme tokens (no raw hex, `rgb`/`rgba` literal, or Tailwind
      palette colour); interactive elements are real `button`, `a` or
      `input`/`select`/`textarea` elements, never a clickable `div`; every form control has
      an associated label; every icon-only button has an `aria-label` naming what it acts
      on; no file under `src/components/shell/` is modified (`git diff --stat` against the
      base lists no shell path)
- [ ] At 390 px width the empty state, held-back state, failed state, an example run and the
      reviewer report never scroll sideways — shown by a browser check of
      `document.documentElement.scrollWidth` or a screenshot, not inferred from the CSS
- [ ] Any page that reads config calls `await connection()` before reading; props are typed
      explicitly (no `PageProps`/`LayoutProps` globals); `params`/`searchParams` are awaited
- [ ] If `src/lib/pipeline/**` is touched (adapter placed there, or `DocNote` widened):
      decision expressions are unchanged, events are built from named fields, and
      `bash plans/2026-11-22-demo-build/03-pipeline/mutations.sh` and `replay.test.ts` pass —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`. N/A when untouched

### Gates, spend and evidence

- [ ] `bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` passes after the last
      edit, output in the report (it runs 04's gates, which run 03's, then
      `no-typed-numbers.sh` and `verify-eval-bundle.sh`)
- [ ] No `poc/` path in the HEAD tree or in any commit of `feat/plan--demo-build..HEAD`,
      checked by an explicit count that is shown to be 0
      (`git ls-tree -r --name-only HEAD | grep -c '^poc/'` and
      `git log --name-only --format= feat/plan--demo-build..HEAD | grep -c '^poc/'`). A
      check written as `! … | grep -q` does not count: under `set -e` a negated pipeline
      never stops the script
- [ ] Runtime checks and screenshots come from a local production server
      (`pnpm build && next start` with `AI_GATEWAY_API_KEY` empty), stopped afterwards; no
      check relies on `next dev` or on a deploy. States a keyless server cannot produce
      (held back, failed) come from seeded IndexedDB runs, and the report says so
- [ ] No Gateway spend: no step of the work or its evidence starts a live run with a key
- [ ] No server code this chunk adds or edits writes to the filesystem
      (`bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes)
- [ ] The report includes screenshots of the empty state, held back before and after
      confirming, the failed state, an example run and the reviewer report
- [ ] `project.md` Layout gains the new paths; Conventions gains: held-back items surface
      only after a person confirms them, and how GC-facing pages get example runs without
      the raw eval files
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
