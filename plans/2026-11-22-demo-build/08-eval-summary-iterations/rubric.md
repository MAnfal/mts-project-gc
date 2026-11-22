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

- [ ] Unit tests for `computeVerdict(index, targets)` in `src/lib/evals/verdict.test.ts` with
      constructed indexes: a metric just below its target is not counted as met (the count
      drops accordingly); a metric exactly at its target counts as met; a measure missing
      from the baseline is excluded from "beats baseline" rather than counted as a win
- [ ] Unit tests for the template filler in `src/lib/evals/story.test.ts`: placeholders fill
      from index values, and a placeholder with no value throws naming it
- [ ] Unit tests in `src/lib/evals/chartSeries.test.ts`: the series breaks where the
      eval-set size changes; the noise band is the control setup's spread between the two
      identical iteration-06 suites; the band is `null` when the control is missing from
      either suite
- [ ] Any logic that marks a gap "within noise", picks an outcome badge or assigns Fixed /
      Better / Worse tags lives in a pure module with a test
- [ ] `config/eval-story.yaml` and the `evalTargets` block of `config/app.yaml` load through
      their schemas (`story-schema.ts`, `schemas.ts`) in a test that asserts the loaded
      values a consumer receives — `.claude/resources/bibles/swe/testing.md`
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] `/evals` shows, in order: a computed verdict heading and sub-line; the CARL table
      (Context | Action | Result | Learning, each with one link down); the Scoreboard
      (Measure | Target | Live, all weeks | Held-out | Baseline) with status badges — met
      green, within 1 pt yellow, missed red — and a footnote naming suites and run counts;
      and the "How it got here" chart
- [ ] The verdict is computed: targets met by `live` on all weeks, and "beats baseline"
      tested per measure — no count or headline number is typed into a component (a grep
      of `src/components/evals` and `src/app/evals` for the headline figures finds none,
      and the report shows a planted figure making that check fail)
- [ ] Every eval number shown comes only from data under `public/evals` (read through the
      loader), is labelled with its split and run count, and none is typed into a
      component, page or prose template
- [ ] Numbers from eval sets of different sizes are never presented as one series
- [ ] CARL prose comes from `config/eval-story.yaml` templates with placeholders filled from
      the index, schema in `src/lib/evals/story-schema.ts`; no number is typed into the
      prose
- [ ] Targets come from an `evalTargets` block in `config/app.yaml` with its schema in
      `src/lib/config/schemas.ts`, and that block is the only change to `schemas.ts`
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, and each still matches `git show poc:poc/config/<path>`
      byte for byte, brightside's single added `use: eval` line excepted (the parity
      script passes where it exists)
- [ ] The chart has one point per iteration 00–06 with recall and precision lines, dashed
      target lines, a break where the eval-set size changed, filled / hollow / square
      markers for kept / dropped / baseline, tooltips with exact value, split and runs, and
      points that open their iteration
- [ ] The noise band's size comes from data; when the data cannot give it, the band is
      omitted, never invented; the report shows the computed band and its source
- [ ] Chart colours come from theme tokens: recall uses the primary navy, precision an
      amber token. *Contradiction resolved:* the colours are given as hex values, but the
      theme-token rule forbids raw hex in components, so they are referenced as tokens
      whose values match; defining a missing amber token in `src/app/globals.css` is in
      scope
- [ ] Every iteration has a page (`generateStaticParams` covers all of them) showing: title
      and outcome badge; Why | Change; result against the replaced setup as a 4-measure
      table with "within noise" marked when the gap is under the band, plus a collapsible
      "All 9 measures, tuning vs held-out"; What actually moved with Fixed / Better / Worse
      tags; Decision; and links to Cases filtered to the iteration, the error analysis
      (sheet) and the config and system diffs (sheet, rendered as diffs). An iteration with
      evidence only renders without crashing
- [ ] The eval sidebar shows Summary, Iterations and an ITERATIONS list with outcomes, carries
      the "Evals" badge, and composes `SidebarNav`; the GC sidebar gains no link to the eval
      view. *Contradiction resolved:* Cases and Models entries are added by the chunks that
      build those pages, so their absence here is not a FAIL
- [ ] Internal names (model IDs, component names) are allowed in the eval view; no eval
      page or component is imported by a GC route
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] At 390 px, tables scroll inside their own box
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes screenshots (Summary, iteration 06, a dropped iteration, 390 px),
      the computed verdict and noise band with the data behind them, and the request-time
      vs build-time data-loading choice with its reason
- [ ] `project.md` Layout gains the new paths; Conventions gains: eval prose lives in
      `config/eval-story.yaml`, numbers come only from `public/evals/index.json`
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
