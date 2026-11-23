<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 08 — Eval view: Summary and Iterations — Review Rubric

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

- [ ] Unit tests for `computeVerdict()` in `src/lib/evals/verdict.test.ts` with
      constructed inputs: a metric just below its target is not counted as met (the count
      drops accordingly); a metric exactly at its target counts as met; a measure missing
      from the baseline is excluded from "beats baseline" rather than counted as a win; a
      target whose metric has no value is reported as not measured, not as met
- [ ] Unit tests for the template filler in `src/lib/evals/story.test.ts`: placeholders fill
      from data values, and a placeholder with no value throws naming it
- [ ] Unit tests in `src/lib/evals/chartSeries.test.ts`: the series breaks where the
      eval-set size changes; the noise band is the control setup's spread across the
      identical-config suites the data names; the band is `null` when the control is
      missing from any of them
- [ ] Any logic that marks a gap "within noise", picks an outcome badge, assigns Fixed /
      Better / Worse tags, narrows an iteration's recorded results, or computes cross-run
      relevance agreement lives in a pure module under `src/lib/evals/` with a colocated
      test that asserts what a caller receives —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `config/eval-story.yaml` and the `evalTargets` block of `config/app.yaml` load through
      their schemas in a test that reads the real file and asserts the parsed values a
      consumer receives — `.claude/resources/bibles/swe/testing.md`
- [ ] If the chunk extends the eval index (schema or builder): `index-schema.test.ts`
      covers each new field, including a constructed input the schema must reject
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
- [ ] Every new `throw` and every new schema refinement has a test whose input is
      constructed, not read from `public/evals/`, and that asserts the error names the
      offending field or value

## Chunk-Specific Checks

Convention Map rows matched: `src/lib/**/*.ts`, `src/components/**/*.tsx`,
`config/**/*.yaml`, and (if the chunk regenerates or extends the bundle)
`public/evals/**` / `scripts/*eval*`. `src/app/evals/**` pages match no row; the checks for
them below come from the acceptance criteria and project Conventions.

### Summary page

- [ ] `/evals` shows, in order: a computed verdict heading and sub-line; the CARL table
      (Context | Action | Result | Learning, each with one link down); the Scoreboard
      (Measure | Target | Live, all weeks | Held-out | Baseline) with status badges — met
      green, within 1 pt yellow, missed red — and a footnote naming suites and run counts;
      and the "How it got here" chart
- [ ] The verdict is computed: targets met by the live setup on all weeks, and "beats
      baseline" tested per measure. No count or headline number is typed into a
      component, page or config template. A grep of the eval components, eval pages and
      `config/eval-story.yaml` for the headline figures finds none, and the report shows a
      planted figure making that gate fail
- [ ] Every eval number shown comes from shipped data under `public/evals/` (or a
      computation over it), is shown with its split and run count, and each number carries
      its own run count. A metric computed over a subset of runs (e.g. judged runs only)
      shows that subset's count, not the setup's total. Numbers from different suites or
      run pools on the same page are labelled so a reader can tell them apart
- [ ] Each scoreboard row's label says what its metric measures. A metric graded against
      the answer key is not labelled as cross-run agreement, and vice versa
- [ ] Cross-run relevance agreement, if shown, is computed from shipped run records and
      answer keys with the definition the report states. It is computed per company-week
      within each suite, and the report reproduces the shown fraction (numerator and
      denominator) from the data
- [ ] CARL prose comes from `config/eval-story.yaml` templates with placeholders filled from
      data; schema in `src/lib/evals/story-schema.ts`; no number is typed into the prose
- [ ] Targets come from an `evalTargets` block in `config/app.yaml` with its schema in
      `src/lib/config/schemas.ts`, and that block is the only change to `schemas.ts`

### Chart

- [ ] Numbers from eval sets of different sizes are never presented as one connected series
- [ ] The chart has one point per recorded iteration with recall and precision lines,
      dashed target lines, a break where the eval-set size changed, filled / hollow /
      square markers for kept / dropped / baseline, tooltips with exact value, split and
      runs, and points that open their iteration
- [ ] The noise band's size comes from data and the page or tooltip names the suites it
      spans. When the data cannot give it, the band is omitted, never invented. The report
      shows the computed band and its source
- [ ] Chart colours come from theme tokens: recall uses the primary navy, precision an
      amber token. *Contradiction resolved:* the colours are given as hex values, but the
      theme-token rule forbids raw hex in components, so they are referenced as tokens
      whose values match; defining a missing amber token in `src/app/globals.css` is in
      scope

### Iteration pages

- [ ] Every iteration in the index has a page, including evidence-only ones, and an
      unknown id renders a not-found state rather than crashing. Each shows: title and
      outcome badge; Why | Change; result against the replaced setup as a 4-measure table
      with "within noise" marked when the gap is under the band for that measure, plus a
      collapsible "All 9 measures, tuning vs held-out"; What actually moved with Fixed /
      Better / Worse tags; Decision; and links to Cases filtered to the iteration, the error
      analysis (sheet) and the config and system diffs (sheet, rendered as diffs)
- [ ] A link or sheet for an evidence file appears only when the iteration ships that
      file; a missing file is never a broken link or an empty sheet
- [ ] An iteration without a `comparedTo` or without recorded results renders without a
      comparison table rather than with fabricated or zero values

### Sidebar and shell

- [ ] The eval sidebar shows Summary, Iterations, Cases and an ITERATIONS list with
      outcomes, carries the "Evals" badge, and composes `SidebarNav`; the GC sidebar gains
      no link to the eval view. *Contradiction resolved:* the Models entry is added by the
      chunk that builds that page, so its absence here is not a FAIL; a Cases link whose
      route does not exist yet is acceptable
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] Internal names (model IDs, component names) are allowed in the eval view; no eval
      page or component is imported by a GC route

### Convention Map rows and project Conventions

- [ ] `src/lib/**/*.ts`: every pure module added has a colocated `*.test.ts` that asserts
      what a caller receives; no module under `src/lib/` imports React; any module that
      touches the filesystem or secrets imports `server-only` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `src/components/**/*.tsx`, and every page this chunk adds: colours, radii and shadows
      come from theme tokens (no raw hex or `rgb`/`rgba` literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on
- [ ] At 390 px width no eval page scrolls sideways and tables scroll inside their own box —
      shown by a screenshot or a measured browser check (`scrollWidth <= clientWidth` on
      the document), not inferred from the CSS
- [ ] `config/**/*.yaml`: each new or changed YAML has a zod schema and is read only through
      `readYaml`; a test loads the real file and asserts the parsed value —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Any page that reads config calls `await connection()` before reading, so the YAML on
      disk is what it shows; a build-time path that reads config is a FAIL
- [ ] No route or server module imports or reads `public/evals/`; eval data reaches the page
      through `src/lib/evals/loader.ts` (extended there if a new file type is needed), not a
      second fetch helper
- [ ] If any file under `public/evals/` or `scripts/*eval*` changed: the diff under
      `public/evals/` comes from re-running `scripts/build-eval-bundle.sh`, never a hand
      edit; `bash scripts/verify-eval-bundle.sh` passes on the result, run after the last
      edit; POC grading code ran unmodified from the detached `poc-src` checkout
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`. If anything under `config/` changed,
      `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh` passes, run after the last
      edit
- [ ] No server code this chunk adds or edits writes to the filesystem, and
      `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes
- [ ] No Next-generated global types (`PageProps`, `LayoutProps`) are relied on; page props
      are typed explicitly, and `pnpm typecheck` passes on a tree with no `.next/`
- [ ] Every dependency added is pinned to an exact version in `package.json`, the version is
      read from `node_modules/<pkg>/package.json`, and `project.md` Stack lists it; shadcn
      components are added with `pnpm exec shadcn add` and `src/components/ui/button.tsx` is
      not overwritten
- [ ] No `poc/` path exists in the chunk branch's tree
      (`git ls-tree -r --name-only HEAD | grep '^poc/'` is empty) or in its history
      (`git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'` is empty)
- [ ] Checks the plan frames as "on the deployed URL" are run against a local stand-in
      (`pnpm build && pnpm start -p <port ≥ 3101>`), with the command and output in the
      report, and the server stopped afterwards; `next dev` was not used, or the
      `AGENTS.md` it writes is not left untracked

### Report and docs

- [ ] The report includes screenshots (Summary, the live iteration, a dropped iteration,
      390 px), the computed verdict and noise band with the data behind them, and the
      data-loading choice (when and where each file is read) with its reason
- [ ] `project.md` Layout gains the new paths; Conventions gains: eval prose lives in
      `config/eval-story.yaml`, eval numbers come only from shipped data under
      `public/evals/`; the `configHash()` convention line is updated if a config YAML was
      added or changed
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
