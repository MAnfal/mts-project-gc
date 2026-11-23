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

Every test named below must be collected by `pnpm test` (the vitest `include` glob in
`vitest.config.mts`). A test file the runner never collects counts as missing — check the
runner's file list, not the directory listing.

- [ ] IndexedDB store (`src/lib/runs/store.ts`, tested in `store.test.ts` with
      `fake-indexeddb`): save, list newest-first by `createdAt`, get by id, a stored
      `running` run with no terminal event is reported as interrupted, and with `indexedDB`
      undefined every call falls back to in-memory and raises the visible-notice flag —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Request validation for `POST /api/run`, with constructed bodies: an unknown
      `profileId`, a profile id that exists but is not a demo preset (`use: eval`), a
      window one day over `maxWindowDays` (counted inclusively), `windowEnd` before
      `windowStart`, a malformed date, and a custom profile missing `summary` each return
      400 with a plain message; the test proves `runPipeline` was never called. A window of
      exactly `maxWindowDays` is accepted — `.claude/resources/bibles/swe/testing.md`
- [ ] The run-config builder (whatever module turns a validated request into the
      pipeline's `RunConfig`) is tested against the config the recorded fixture run used
      (`run.start.config` in `src/lib/pipeline/__fixtures__/replay-06.jsonl.gz`): every
      decision field — `mode`, `model`, `filter`, `jevThreshold`, `webLeads`, `promptSet`,
      `filterVotes`, `filterExcerpts` — matches, and `asOf` equals `windowEnd`; values come
      from `config/experiment.yaml` `userView.setup` and `config/setups.yaml`, not literals
      in code
- [ ] `reduceEvents()` (`src/lib/runs/reduce.ts`): the public events from the replay
      harness (`runReplay().events`) reduce to every planned step done and an item count
      equal to `run.done.items.length`; a constructed failure sequence keeps the failed
      step and its message; a `run.failed` with `step: null` is handled; `step.progress`
      sub-items and `step.retry` attempts are tracked; a sequence with no terminal event
      reduces to a non-done, non-failed state — `.claude/resources/bibles/swe/testing.md`
- [ ] The client stream reader: an NDJSON body delivered in chunks that split a line (and a
      multi-byte character) across chunk boundaries yields each event exactly once, in order;
      a trailing partial line at end-of-stream is not dropped silently
- [ ] Run start and retry (wherever the client's POST logic lives): retry posts the stored
      request body byte-for-byte; a stream that ends or errors without `run.done` /
      `run.failed`, and a non-OK response, each leave the run saved as interrupted/failed
      with Retry available — not stuck as running
- [ ] Report derivations built in code — the heading and summary sentence, the "Why <tier>?"
      text, the per-owner `mailto:` body, and the "not relevant" count: the summary text
      changes between a 0-item run and a run with items; the mailto body contains only that
      owner's items and is URL-encoded; the not-relevant count equals the screened-out list
      it links to
- [ ] `GcSidebar.tsx`, `RunSteps.tsx`, `ReportView.tsx`, `SourcesPanel.tsx` and the run page
      are presentational over the reducer, store and derivation helpers; any branching
      logic left in a component has a test that `pnpm test` collects
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
- [ ] Every new `throw`, early `return` on bad input, and fallback branch the chunk adds has
      a test whose input is constructed (not drawn from the replay fixture), named in the
      report with the mutation that turns it red
- [ ] No test calls a model or the network: tests stub `fetch` and use `installModels` or
      mock `runPipeline`; the report shows the suite green with global `fetch` replaced by
      a thrower, or shows equivalent evidence

## Chunk-Specific Checks

Convention Map rows matched by files this chunk touches: `src/lib/**/*.ts`,
`src/app/api/**/route.ts`, `src/components/**/*.tsx`; `.claude/resources/project.md` falls
under the prompt-engineering bible. No row covers `src/app/**/page.tsx`; page checks below
come from the Conventions section.

### Route

- [ ] `POST /api/run` responds `application/x-ndjson` with one `RunEvent` per line, the
      last being `run.done` or `run.failed`, and exports `maxDuration = 300`
- [ ] The route file exports only HTTP handlers and segment config (`runtime`,
      `maxDuration`); body parsing, run-config building and stream encoding live in sibling
      or `src/lib` modules with their own tests — `.claude/resources/bibles/swe/testing.md`
- [ ] The body is parsed with zod before use; limits come from `config/` through `readYaml`
      or the existing config accessors (no duplicated constant for the window length);
      an invalid body returns 400 with a plain message and starts no run (the built server
      returns 400 for a 30-day window)
- [ ] Only `use: demo` presets or a custom profile are accepted; an eval company id is
      rejected exactly like an unknown id (Principle: eval companies are held out)
- [ ] A custom profile is validated with the existing `CompanySchema`, runs as the
      pipeline's `customProfile`, and is written nowhere on the server
- [ ] Exactly one terminal event per response: when `runPipeline` rejects after emitting
      `run.failed`, the route does not emit a second one; an error thrown before or outside
      `runPipeline` becomes a single `run.failed` with a fixed public message. No 500 with a
      stack; no `error.message` text reaches the client
- [ ] A client disconnect does not crash the server or turn into an unhandled rejection:
      the stream sink stops enqueuing after cancel, and the report states what happens to
      the in-flight run (it keeps running server-side, or is stopped)
- [ ] The route is wiring only — validate, build the config, call `runPipeline`, serialize
      events; all view logic lives in the pure reducer used by both live rendering and
      stored-run replay — `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md`
- [ ] No server code this chunk adds or edits writes to the filesystem (the no-fs-writes
      gate passes on the final tree)
- [ ] No file under `src/lib/pipeline/` is changed; if one is, the pipeline Convention Map
      row applies in full (its mutations gate runs and passes, events built from named
      fields, `withRetry` only) — `.claude/resources/bibles/swe/patterns/migration-verification.md`

### Client state and persistence

- [ ] `src/lib/**` modules import no React; a React hook lives outside `src/lib/`, unless
      the plan records the exception — Convention Map `src/lib/**/*.ts` row
- [ ] Browser code imports only **types** from `src/lib/pipeline/events.ts` (`import type`),
      never `STEP_LABELS`, `stepOf`, `assertPublic` or its patterns; no client module imports
      a `server-only` module. Step labels on screen come from `run.start.steps` /
      `step.start.label`
- [ ] Runs persist in IndexedDB (database `reg-monitor`, store `runs`); a record holds the
      request the GC made (profile id or custom profile, window), the public events, the
      status and the `run.done` payload — never the server's `RunConfig` (model id, filter
      mode) nor `PipelineResult.decisions` (internal relevance score)
- [ ] Every store call is wrapped and degrades to in-memory with a visible notice; after a
      reload, Recent runs lists finished and failed runs and opening one re-renders it from
      stored events with no network call (shown, not inferred)
- [ ] A run whose stream ends without a terminal event — reload mid-run, function timeout,
      network drop, non-OK response — shows as "Interrupted" (or failed) with Retry, and the
      UI says a stream cannot resume; it is never left spinning
- [ ] Retry starts a new run with the identical saved request and keeps the old run in
      history

### Running and Report screens

- [ ] Running screen: steps render as done, in progress or waiting (waiting steps from
      `run.start.steps`) with counts and timings; the step in progress shows its sub-items;
      a retry in progress is visible; the spinner stops under `prefers-reduced-motion`; the
      status line is an `aria-live="polite"` region; skeleton placeholders hold the report's
      space
- [ ] Report screen on `run.done` has every required part: a collapsible "Worked for Ns"
      that reopens the steps; a heading and summary built in code from counts, tiers and
      owners (no model call); tier counts as paired status badges plus "Held back N"; a
      Priority | Rule and what to do (numbered source chips) | Deadline with "Verified" |
      Owner table; "Why <tier>?" from the item's tier reason; a "Draft email to <owner>"
      `mailto:` whose plain-text body lists only that owner's items; "N not relevant · see
      why" listing the screened-out reasons; `.md` (the pipeline's markdown) and `.json`
      downloads; and the Sources | Profile right panel, whose Profile tab renders from data
      stored with the run (no network on replay)
- [ ] Counts shown to the GC are each read from their own field (`items`, `dropped`,
      `screenedOut`, `notReviewedCount`, `scanned`); no count is derived by subtracting from
      `scanned`, and no copy claims the parts add up to the scanned total
- [ ] On `run.failed` the failed step shows the event's message under it with a Retry
      button; a failure with no step shows the message at run level with Retry
- [ ] `ReportView` accepts an optional `followUp?: ReactNode` rendered in the composer
      position
- [ ] All text and numbers on both screens come from the run; nothing is copied from the
      mockups as data
- [ ] `/` offers one action that starts a run on the `ledgerly` preset for the frozen
      2026-11-02 – 2026-11-06 week and navigates to `/runs/<id>`
- [ ] Any page that reads `config/` calls `await connection()` before reading; client-only
      pages read no config; no page relies on Next's generated `PageProps`/`LayoutProps`
- [ ] No GC-facing source, UI string, event or response this chunk adds or edits contains an
      internal name — the internal filter component's name, `typesafe-ai`, a model id or a
      model vendor prefix, or prompt text. Check with `assertPublic`'s patterns (an ordinary
      word such as "Sarajevo" is not a leak), over the GC client source and the `/api/run`
      400 bodies; the eval bundle and eval pages are out of scope (ORCHESTRATOR Decision 9)

### UI rules

- [ ] Colours, radii and shadows come from theme tokens — no raw hex, `rgb()` or `rgba()`
      in any `.tsx` this chunk adds or edits; interactive elements are real `button`, `a`
      or `input`/`select`/`textarea` elements, never a clickable `div`; every form control
      has an associated label; every icon-only button has an `aria-label` naming what it
      acts on — Convention Map `src/components/**/*.tsx` row
- [ ] At 390 px width neither the Running nor the Report page scrolls sideways
      (`document.documentElement.scrollWidth <= 390` in a browser, or a screenshot);
      tables scroll inside their own box
- [ ] No file under `src/components/shell/` is modified (`git diff --stat` against the base
      lists no shell path); new shadcn primitives were added with `pnpm exec shadcn add`
      and `src/components/ui/button.tsx` is unchanged

### Gates and repository hygiene

- [ ] `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh` passes on the final tree
      (lint, test, build, typecheck, decision-path parity, no-fs-writes, no `poc/`)
- [ ] No `poc/` path exists in the HEAD tree (`git ls-tree -r --name-only HEAD`) or in any
      commit of `feat/plan--demo-build..HEAD` (`git log --name-only`)
- [ ] Runtime checks that the plan would make against a deployed URL are made against a
      local `pnpm build && pnpm start -p <port ≥ 3101>`, and the server is stopped after;
      the report says which checks ran locally and that the deploy is unverified
- [ ] New dependencies are pinned to an exact version and recorded in `project.md` Stack
      with the version read off `node_modules/<pkg>/package.json`

### Documentation

- [ ] The report includes screenshots of Running, Report, Failed + Retry and the 390 px
      view, the live smoke output if it was run (event types and final item count), the
      choice between `idb` and raw IndexedDB with its reason, and confirms the streaming
      response was checked against the installed Next 16
- [ ] `project.md` Commands sets "Run a monitor pass" to the exact `curl` that POSTs a
      Ledgerly frozen-week run, marked as spending real Gateway credit; Layout gains every
      new path; Stack gains every new package
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
