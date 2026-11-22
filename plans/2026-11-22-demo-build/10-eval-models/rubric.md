<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 10 — Eval view: Models page — Review Rubric

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

- [ ] Unit tests for the model-comparison helper (`src/lib/evals/models.ts`, colocated
      `models.test.ts`) run on the real shipped bundle (`src/lib/evals/__fixtures__/shipped.ts`):
      one group per suite whose setups use more than one model, and no other suite; every
      row in a group carries that one suite; the group's run counts and weeks match that
      suite's `index.json` entry; at least one named row's recall, precision and cost per
      run equal the same setup's values in that suite's `report.json` (cross-check against
      the shipped file, not a typed constant) — `.claude/resources/bibles/swe/testing.md`
- [ ] Constructed-input tests (off the shipped fixture) for the helper's guards: an index
      whose every suite uses one model yields no group; a metric whose value is `null`
      renders as a defined empty mark, not `NaN` or `0`; a setup listed in a suite but
      missing from `suiteResults` (or from `setups`) is surfaced as an error or excluded
      with a reason, never silently dropped
- [ ] The `models` section of `config/eval-story.yaml` loads through
      `src/lib/evals/story-schema.ts` in a test that reads the real file; a test shows the
      schema rejecting a typed digit in that section; any new placeholder the section uses
      is filled by `story.ts` from data, with a test, and an unknown placeholder fails
      rather than rendering as literal braces
- [ ] The Cases page's suite + setup filter has tests in the module that decides Cases page
      state (not only in the component): a known suite and setup resolve to that setup's
      cases in that suite; an unknown suite, a setup that did not run in the named suite,
      and a URL naming both an iteration and a suite each produce a defined state (a
      stated message or a stated precedence), never a crash or an unexplained empty table
- [ ] Any highlighting rule (which rows count as the live choice) lives in a tested pure
      module, with a test; `ModelTable.tsx` and `src/app/evals/models/page.tsx` only render
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

Convention Map rows matched: `src/lib/**/*.ts` (`.claude/resources/bibles/swe/testing.md`);
`src/components/**/*.tsx` (no doc); `config/**/*.yaml`
(`.claude/resources/bibles/swe/testing.md`); `src/app/evals/**`, `src/components/evals/**`,
`config/eval-story.yaml` (`.claude/resources/bibles/swe/testing.md`); and, only if the chunk
touches them, `public/evals/**`, `scripts/*eval*` (no doc). The `project.md` edit is
governed by the prompt-engineering bible. Chunk 05's `gates.sh` is required by the plan
lead for every chunk in this wave, not by a row match.

### Models page

- [ ] `/evals/models` shows one table per suite that ran more than one model, and none for
      a single-model suite; columns cover model, method (and whatever distinguishes two
      setups of the same model and method in one suite, such as the setup label or prompt
      set), recall, precision, dates matching the answer key, judge pass, cost per run,
      time per run and runs; the suite id, its eval-set weeks (with split) and its run
      counts appear above each table
- [ ] Measure column headers use the eval view's existing measure labels
      (`config/eval-story.yaml` → `measures`) or say exactly what the metric is; a column
      backed by `datesRight` is not labelled as "verified" dates
- [ ] Models are compared only within one suite: no table, figure or sentence pools or
      juxtaposes numbers from different suites
- [ ] The live choice is highlighted by a rule stated in code and the report (the live
      setup's row where it ran in that suite; otherwise the rows of the live setup's
      model), and the highlight is not applied to a row of another model
- [ ] The live model's rationale block renders from the `models` section of
      `config/eval-story.yaml`; every number in it is a `{{placeholder}}` filled from
      `index.json` or a verbatim quote of a recorded source, and every claim it makes holds
      for the shipped data (e.g. a claim that the chosen model is cheaper is FAIL if the
      data shows otherwise)
- [ ] The caveats block covers (a) possible answer-key bias — keys were drafted by Claude
      models — with any recall-ranking statement computed from that suite's data and true
      as stated (if a baseline row ranks below the non-Claude setup, the claim names the
      comparison set it holds for); and (b) price parity, with the date it was checked
      taken from a recorded source rather than typed into a component or the story YAML
- [ ] The judge-panel section lists the judge models and the agreement threshold read from
      `config/judges.yaml` through the existing `judges()` reader in `src/lib/config.ts`
      (no second schema for that file), and states that the panel grades outputs and is not
      part of the model choice
- [ ] Each model row links (a real `a` element) to Cases filtered to that row's suite and
      setup, and opening that link shows that setup's cases in that suite

### Numbers and data

- [ ] Every eval number shown comes from `public/evals` data read through
      `src/lib/evals/loader.ts` in the browser (`index.json`'s per-suite, per-setup results
      are sufficient), and names its split, runs and suite (column header, tooltip or
      footnote); none is typed into a component, page or the story YAML (ORCHESTRATOR
      Decision 10) — `.claude/resources/bibles/swe/testing.md`
- [ ] Server pages read YAML only; no server module reads `public/evals`; no page reads
      `report.json` on the server
- [ ] `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`
      passes; if its needles were extended for this page's headline figures, the report
      shows the gate failing on a planted number, then passing after its removal

### Convention Map rows and project Conventions

- [ ] `src/lib/**/*.ts`: every pure module added has a colocated `*.test.ts` that asserts
      what a caller receives; no module under `src/lib/` imports React; modules imported by
      client components import neither `@/lib/config`, `@/lib/config/load`, `node:fs` nor
      `server-only`; any module that touches the filesystem or secrets imports
      `server-only` — `.claude/resources/bibles/swe/testing.md`
- [ ] `config/**/*.yaml`: the edited `config/eval-story.yaml` has its zod schema in
      `src/lib/evals/story-schema.ts`, is read only through `readYaml`, and a test loads the
      real file and asserts the parsed value — `.claude/resources/bibles/swe/testing.md`
- [ ] `src/components/**/*.tsx` and every page this chunk adds: colours, radii and shadows
      come from theme tokens (no raw hex, `rgb`/`rgba` literal, or Tailwind palette colour
      such as `bg-sky-500/15`); interactive elements are real `button`, `a` or
      `input`/`select`/`textarea` elements, never a clickable `div` or `tr` with `onClick`;
      every form control has an associated label; every icon-only button has an
      `aria-label` naming what it acts on; no file under `src/components/shell/` is
      modified (`git diff --stat` against the base lists no shell path)
- [ ] At 390 px width `/evals/models` never scrolls sideways
      (`document.documentElement.scrollWidth` ≤ the viewport) and each table scrolls inside
      its own box — shown in a screenshot or browser check, not inferred from the CSS
- [ ] Any page that reads config calls `await connection()` before reading; props are typed
      explicitly (no `PageProps`/`LayoutProps` globals); `searchParams`/`params` are awaited
- [ ] Internal names (model ids, setup keys, Jev) are allowed in the eval view; no eval page
      or component is imported by a GC route, and the GC sidebar gains no eval link
      (chunk 04's Gate 5 inside the 05 gate chain passes)
- [ ] `EvalSidebar` gains a working "Models" entry, active on `/evals/models`, and every
      existing entry (Summary, Iterations, Cases, Runs, the iteration list) still resolves
      and keeps its active state
- [ ] Decision-path config is untouched: `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh`
      passes and the diff changes none of `config/prompts.yaml`, `prompt-sets/`,
      `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`, `companies/` or
      `evalsets/`
- [ ] No server code this chunk adds or edits writes to the filesystem
      (`bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes)
- [ ] No `poc/` path is committed, counted explicitly so a non-zero count fails:
      `git ls-tree -r --name-only HEAD | grep -c '^poc/'` prints `0`, and
      `git log --name-only --format= feat/plan--demo-build..HEAD | grep -c '^poc/'` prints
      `0` (a `! … | grep -q` form cannot fail under `set -e` and does not count)
- [ ] If `public/evals/**` or `scripts/*eval*` is touched: the diff comes from re-running
      `bash scripts/build-eval-bundle.sh`, never a hand edit; a second rebuild under Node 24
      leaves `git status` clean (idempotent); `bash scripts/verify-eval-bundle.sh` passes.
      N/A when neither is touched (`git diff --stat` shows no path there)

### Gates and evidence

- [ ] These pass after the last edit, with output in the report:
      `bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh` (runs 04's gates,
      which run 03's — lint, test, build, typecheck, parity, no fs writes, no `poc/`, Gate 5
      — then `no-typed-numbers.sh` and `verify-eval-bundle.sh`; `PORT` set inside the
      wave's port range),
      `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`,
      `bash scripts/verify-eval-bundle.sh`
- [ ] Runtime checks (page renders, row link opens filtered Cases, 390 px) were made against
      a local keyless production server (`pnpm build`, then
      `AI_GATEWAY_API_KEY= pnpm start -p <port ≥ 3101>`), stopped afterwards; no check
      relies on `next dev` or on a deploy
- [ ] The report includes a screenshot of `/evals/models` (and the 390 px view), lists the
      multi-model suites found with their setups and run counts, and states which rows the
      live highlight marks and why
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
