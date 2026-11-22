<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 09 — Eval view: Cases, run panel, and trace viewer — Review Rubric

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

- [ ] Unit tests for `casesForIteration()` in `src/lib/evals/cases.test.ts`, run on a real
      shipped iteration suite read from `public/evals`: a case whose hits differ between the
      iteration's setup and its `comparedTo` setup is listed as changed; every case's After
      and Before equal a direct count over that suite's runs, one per (case, repeat), with
      failed and superseded runs handled as the module documents; and the sum of hits and
      misses over all cases equals the suite's `report.json` per-setup `counts`
      (`tp`, `fn`, `trapHit`) — `.claude/resources/bibles/swe/testing.md`
- [ ] `cases.test.ts` covers, with constructed input: a setup with no finished repeat for a
      company-week shows as "no runs" (not a zero count); two setups with unequal finished
      repeats for the same case are compared the way the module documents (count or rate),
      and a test pins that choice — `.claude/resources/bibles/swe/testing.md`
- [ ] If a grader is ported (`src/lib/evals/grade.ts` or an extension of
      `src/lib/grade.ts`): its test shows per-setup recall and precision equal to the
      shipped `report.json` for the same suite —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`. N/A when no grader
      is ported and the report shows `report.json` carries no per-case results (its keys
      listed) and that case counts reproduce its totals
- [ ] Unit tests for the trace index (filter and search) in
      `src/lib/evals/traceIndex.test.ts` over a real shipped trace: filtering by event type
      returns exactly the events of that type; search by document number or a word matches
      field values, not field names; a trace with 0 events returns an empty result —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Any reader added to `src/lib/evals/loader.ts` (suite JSON, trace checks, answer keys)
      has a `loader.test.ts` case that serves the real shipped file through the fetch stub
      and asserts what the caller receives, plus a non-OK response that throws naming the
      URL — `.claude/resources/bibles/swe/testing.md`
- [ ] `CasesTable.tsx`, `RunPanel.tsx`, `TraceViewer.tsx` and any run-report adapter keep
      selection, counting, filtering and shaping logic in tested pure modules under
      `src/lib/evals/`; any logic left in a component has a test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
- [ ] Every new `throw` or guard (unknown iteration, iteration with no suite or no
      `comparedTo`, missing answer key, unknown run id, malformed trace line) has a test
      that drives it with constructed input, not with shipped data

## Chunk-Specific Checks

Convention Map rows matched: `src/lib/**/*.ts`
(`.claude/resources/bibles/swe/testing.md`); `src/components/**/*.tsx` (no doc);
`src/app/evals/**`, `src/components/evals/**` (`.claude/resources/bibles/swe/testing.md`);
and, only if the chunk touches them, `public/evals/**`, `scripts/*eval*` (no doc). The
`project.md` edit is governed by the prompt-engineering bible.

### Cases

- [ ] `/evals/cases` with an iteration selected lists the cases whose hits differ between
      that iteration's setup and its `comparedTo` setup in the iteration's suite, with
      columns Rule · company-week (tuning / held-out) | Expected (Flag / Skip) | After |
      Before | What happened (Fixed / Regressed / Trap / Indirect tag plus the answer key's
      short reason)
- [ ] `/evals/cases` with no iteration, an unknown iteration, the reference iteration (no
      `comparedTo`) and an evidence-only iteration each render a defined state — a default
      iteration or a stated message — never a crash or an empty table with no explanation
- [ ] The filter buttons ("Changed in <iteration>", "Still missed", "Traps flagged", "All N
      cases") each show a computed count, and no more than 4 choices are visible
- [ ] The report states where per-case hits come from (`report.json` per-case results, or
      a count over `runs.jsonl.gz` against the answer keys), with the `report.json` keys
      inspected; no second copy of logic that already exists (`majority`/`Verdict` in
      `src/lib/grade.ts`, trap normalization and `AnswerKey` in `bundle-build.ts`,
      `LabelSet` in `src/lib/types.ts`)
- [ ] Subset grading is reproduced: flags outside the answer key are not counted against
      precision; the report shows that making the counting penalise them turns a named test
      red, then green after the revert

### Run panel

- [ ] Selecting a case shows one tab per repeat of the selected setup; "Why the filter
      flagged it" shows the LLM filter's recorded reason for that document in that run; the
      passages the filter read, when that run recorded them for that document (as many as
      were recorded), and nothing when it did not; trace checks as "All N passed" or the
      failing ones named; judge verdicts with votes and reasoning collapsed, and an explicit
      "not judged" state for a repeat the panel did not grade; a "Raw trace · N events"
      link for every repeat, with N taken from data (the run-report link moved to chunk 06,
      plan amendment 2)
- [ ] A failed repeat (status not `done`) appears in the tabs with its status, not silently
      dropped, and its raw trace is still reachable

### Trace viewer

- [ ] `/evals/traces/<suiteId>/<runId>` fetches one gz file and decompresses it in the
      browser through `loader.ts` (no `res.json()` on a `.gz`, no server read of
      `public/evals`); the trace-check summary is shown first; event-type filter chips and a
      search box (document number or word) work; any event's JSON opens on click
- [ ] The list is virtualized and stays responsive on the largest shipped trace (measured
      event count stated in the report); the report explains the virtualization choice, and
      any new dependency is pinned exactly and added to the `project.md` Stack table with
      the version read from `node_modules`
- [ ] The trace viewer works for a user-view run (pseudo suite `user-view`), which ships
      no `trace-checks.json`: the summary states that no checks were recorded rather than
      erroring

### Run report

- N/A: moved to chunk 06 by plan amendment 2 (lead, 2026-11-23). Chunk 04's `ReportView`
  wasn't merged when this chunk was cut, and chunk 06 builds the recorded-run adapter. The
  rubric is amended in the same sweep (lead, after review i1).

### Reachability and numbers

- [ ] A reviewer reaches the raw trace of any shipped run in at most 3 clicks from `/evals`
      (SPEC success metric). The report lists the click path and count for at least: Run 1
      of a changed case, a later repeat of the same case, a failed repeat, and a run outside
      the iteration's two setups. A run that needs more than 3 clicks is a FAIL unless the
      plan records the exception
- [ ] Every number shown (hits, counts, event counts, check counts, filter counts) is
      computed from shipped data under `public/evals` read through `loader.ts` and names
      its denominator, split and suite (tooltip, footnote or column header); none is typed
      into a component, page or prose template (ORCHESTRATOR Decision 10) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Pure modules imported by client components (`cases.ts`, `traceIndex.ts`, any grader
      or adapter) import neither `@/lib/config`, `@/lib/config/load`, `node:fs` nor
      `server-only`; answer keys reach the browser from `public/evals/config/`, not through
      a server read

### Convention Map rows and project Conventions

- [ ] `src/lib/**/*.ts`: every pure module added has a colocated `*.test.ts` that asserts
      what a caller receives; no module under `src/lib/` imports React; any module that
      touches the filesystem or secrets imports `server-only` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `src/components/**/*.tsx` and every page this chunk adds: colours, radii and shadows
      come from theme tokens (no raw hex, `rgb`/`rgba` literal, or Tailwind palette colour
      such as `bg-sky-500/15`); interactive elements are real `button`, `a` or
      `input`/`select`/`textarea` elements, never a clickable `div`; every form control has
      an associated label; every icon-only button has an `aria-label` naming what it acts
      on; no file under `src/components/shell/` is modified (`git diff --stat` against the
      base lists no shell path)
- [ ] At 390 px width, `/evals/cases` (with a case selected) and the trace viewer never
      scroll sideways, and the run panel stacks under the table — shown in a screenshot or
      a browser check of `document.documentElement.scrollWidth`, not inferred from the CSS
- [ ] `src/app/evals/**`, `src/components/evals/**`: no metric number is typed in a
      component or page; every number names its split, runs and suite; server pages read
      YAML only and no server module reads `public/evals` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Any page that reads config calls `await connection()` before reading; props are typed
      explicitly (no `PageProps`/`LayoutProps` globals); `searchParams`/`params` are awaited
- [ ] Internal names (Jev, model ids, stage ids) are allowed in the eval view; no eval page
      or component is imported by a GC route, and the GC sidebar gains no eval link
- [ ] `EvalSidebar`'s "Cases" entry resolves to a working page and every existing entry
      still works; the Cases entry is active on `/evals/cases`
- [ ] No server code this chunk adds or edits writes to the filesystem (gate
      `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes)
- [ ] No `poc/` path in the HEAD tree (`git ls-tree -r --name-only HEAD | grep '^poc/'` is
      empty) or in any commit of `feat/plan--demo-build..HEAD`
      (`git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'` is empty)
- [ ] If `public/evals/**` or `scripts/*eval*` is touched: the diff comes from re-running
      `bash scripts/build-eval-bundle.sh`, never a hand edit; a second rebuild leaves
      `git status` clean (idempotent); `bash scripts/verify-eval-bundle.sh` passes. N/A
      when neither is touched (`git diff --stat` shows no path there)

### Gates and evidence

- [ ] These pass after the last edit, with output in the report:
      `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh`,
      `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`,
      `bash scripts/verify-eval-bundle.sh`. If the no-typed-numbers needles were extended
      for this chunk's figures, the report shows the gate failing on a planted number
- [ ] Runtime checks (pages render, gz fetch and decompress, 390 px, click counts) were
      made against a local production server (`pnpm build && pnpm start -p <port ≥ 3101>`),
      stopped afterwards; no check relies on `next dev` or on a deploy
- [ ] The report includes screenshots: Cases for one iteration, the run panel, the trace
      viewer filtered to one event type, and the 390 px view
- [ ] `project.md` Layout gains the new paths; every line this chunk adds to
      `.claude/resources/project.md` is true of the tree after the chunk and was measured,
      not assumed (a version read off disk, a command actually run); each rule lives in one
      section only; and each added line passes the filtering test — removing it would let a
      cold reader make a mistake —
      `.claude/resources/bibles/prompt-engineering/conventions/ai-optimized-writing.md`

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
