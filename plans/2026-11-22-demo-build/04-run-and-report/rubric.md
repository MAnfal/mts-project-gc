<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 04 — Streaming run, Running and Report screens, IndexedDB history and Retry — Review Rubric

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

- [ ] Unit tests for the IndexedDB store in `src/lib/runs/store.test.ts` (with
      `fake-indexeddb`): save, list newest-first by `createdAt`, get by id, mark a stored
      `running` run with no terminal event as interrupted, and fall back to in-memory with
      a visible notice when `indexedDB` is undefined
- [ ] Unit tests for `POST` in `src/app/api/run/route.test.ts` with constructed bodies: an
      unknown `profileId`, a window one day over `maxWindowDays`, `windowEnd` before
      `windowStart`, and a custom profile missing `summary` each return 400 with a plain
      message, and the test asserts `runPipeline` was never called
- [ ] Unit tests for `reduceEvents()` in `src/lib/runs/reduce.test.ts`: the real replay
      events from the pipeline fixture reduce to every step done and an item count equal
      to the run's items; a constructed `run.failed` sequence keeps the failed step and its
      message; `step.progress` sub-items are tracked —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit test in `src/components/gc/ReportView.test.tsx` that the heading and summary
      sentence are derived from the items (counts, tiers, owners) — the text changes
      between a 0-item run and a run with items
- [ ] `src/lib/runs/useRun.ts` — the NDJSON line reader (a line split across two stream
      chunks still parses) and `retry()` (starts a new run with the stored config) are
      tested, either directly or by moving that logic into a tested pure helper
- [ ] `GcSidebar.tsx`, `RunSteps.tsx`, `SourcesPanel.tsx` and `src/app/runs/[id]/page.tsx`
      are presentational over the reducer and store; any branching logic left in them has a
      test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] Unit tests for the client stream reader and `retry()` in `src/lib/runs/useRun.test.ts`: NDJSON split mid-line across chunks is parsed exactly once per event, and retry re-posts the stored config unchanged
- [ ] `POST /api/run` responds `application/x-ndjson` with one `RunEvent` per line, the
      last being `run.done` or `run.failed`, and exports `maxDuration = 300`
- [ ] The request body is validated with zod using limits read from `config/app.yaml` (no
      duplicated constant); an invalid body returns 400 with a plain message and starts no
      run (the built server returns 400 for a 30-day window)
- [ ] Any error thrown during a run becomes a `run.failed` event; the route never answers
      500 with a stack, and no stack trace or internal error text reaches the client
- [ ] A custom profile in the body is the one the pipeline runs on, and the server stores
      it nowhere
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] The route is wiring only — validate, call `runPipeline`, serialize events; all view
      logic lives in the pure reducer used by both live rendering and stored-run replay —
      `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md`
- [ ] Running screen: steps render as done, in progress or waiting with counts and timings;
      the step in progress shows its sub-items; the spinner stops under
      `prefers-reduced-motion`; the status line is an `aria-live="polite"` region;
      skeleton placeholders hold the report's space
- [ ] Report screen on `run.done` has every required part: a collapsible "Worked for Ns"
      that reopens the steps; a heading and summary built in code from counts, tiers and
      owners (no LLM call); tier counts as paired status badges plus "Held back N"; a
      Priority | Rule and what to do (numbered source chips) | Deadline with "Verified" |
      Owner table; "Why <tier>?" built from the tier rule's reason; a "Draft email to
      <owner>" `mailto:` whose encoded plain-text body lists only that owner's items;
      "N not relevant · see why" listing the screened-out reasons; `.md` (the pipeline's
      markdown) and `.json` downloads; and the Sources | Profile right panel
- [ ] `ReportView` accepts an optional `followUp?: ReactNode` rendered in the composer
      position
- [ ] All text and numbers on both screens come from the run; nothing is copied from the
      mockups as data
- [ ] On `run.failed` the failed step shows its timeout message under it and a Retry button,
      and Retry starts a new run with the identical saved config
- [ ] Runs persist in IndexedDB (database `reg-monitor`, store `runs`, records
      `{id, createdAt, config, events, status, result}`); every store call is wrapped and
      degrades to in-memory with a visible notice; after a reload, Recent runs lists
      finished and failed runs and opening one re-renders it from stored events with no
      network call
- [ ] A run reloaded mid-stream shows as "Interrupted" with Retry, and the UI says the
      stream cannot resume
- [ ] `/` offers one action that starts a run on the `ledgerly` preset for the frozen
      2026-11-02 – 2026-11-06 week and navigates to `/runs/<id>`
- [ ] No GC-facing code, event, UI string or response this chunk adds or edits contains an
      internal name — `Jev`, `typesafe-ai`, a model ID or prompt text; internal
      identifiers are allowed only inside pipeline code, never in what reaches the GC
- [ ] Rendered run text comes only from step labels and item fields
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] Tables scroll inside their own box at narrow widths
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes screenshots of Running, Report, Failed + Retry and the 390 px
      view, the live smoke output if it was run (event types and final item count), the
      choice between `idb` and raw IndexedDB with its reason, and confirms the streaming
      response was checked against the installed Next 16
- [ ] `project.md` Commands sets "Run a monitor pass" to the exact `curl` that POSTs a
      Ledgerly frozen-week run, marked as spending real Gateway credit; Layout gains the new
      paths
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
