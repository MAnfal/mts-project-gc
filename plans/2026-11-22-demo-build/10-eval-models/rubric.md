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

- [ ] Unit tests for `modelComparisons(index, reports)` in `src/lib/evals/models.test.ts` on
      the real shipped bundle: one group per suite that ran more than one model; every row
      in a group shares one suite; the live model's row recall equals that setup's value in
      `report.json`; a constructed index whose only setups use one model yields no group —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `config/eval-story.yaml` with its new `models` section loads through
      `src/lib/evals/story-schema.ts` in a test
- [ ] `ModelTable.tsx` and `src/app/evals/models/page.tsx` are presentational over
      `models.ts`; any grouping or highlighting logic left in them has a test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] The Cases page accepts a suite + setup filter as an alternative to the iteration filter, and a test covers it; model rows link to that filtered view
- [ ] `/evals/models` shows one table per multi-model suite with columns Model | Method |
      Recall | Precision | Dates verified | Judges pass | $ / run | s / run | Runs; the live
      choice is highlighted; the suite name, its eval-set weeks and run counts appear above
      each table
- [ ] Models are compared only within one suite; no table or figure mixes suites
- [ ] The "Why Sonnet 5.5" block renders from the `models` section of
      `config/eval-story.yaml` with numbers filled from data; a short caveats block covers
      possible answer-key bias and price parity, with the date checked
- [ ] The judge panel section lists the judge models and the agreement rule as read from
      `config/judges.yaml`, not typed in, and states it is separate from the model choice
- [ ] Clicking a model row opens Cases filtered to that suite and setup, and the Cases page
      honours that filter when opened
- [ ] Every eval number shown comes only from data under `public/evals` (read through the
      loader), is labelled with its split and run count, and none is typed into a
      component, page or prose template
- [ ] `src/lib/config/schemas.ts` is not modified; the `models` schema lives in
      `src/lib/evals/story-schema.ts`
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, and each still matches `git show poc:poc/config/<path>`
      byte for byte, brightside's single added `use: eval` line excepted (the parity
      script passes where it exists)
- [ ] `EvalSidebar` has a working "Models" entry and keeps every existing entry
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] Internal names (model IDs, component names) are allowed in the eval view; no eval
      page or component is imported by a GC route
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] At 390 px, each table scrolls inside its own box
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes a screenshot and lists the multi-model suites found with their
      run counts
- [ ] `project.md` Layout gains the new paths
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
