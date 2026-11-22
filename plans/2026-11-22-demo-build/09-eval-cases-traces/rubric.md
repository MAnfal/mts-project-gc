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

- [ ] Unit tests for `casesForIteration(suite, iteration, keys)` in
      `src/lib/evals/cases.test.ts` on the real shipped iteration-06 suite: a case known to
      change between the iteration's setup and its `comparedTo` is listed as changed; each
      case's After and Before equal a direct count over the runs per (case, repeat); a setup
      with 0 repeats for a week shows "—", not a zero count (constructed input) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] If `src/lib/evals/grade.ts` is ported: `src/lib/evals/grade.test.ts` shows per-setup
      recall and precision equal to `report.json` for the same suite —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`. N/A when
      `report.json` already carries rule-level results and the report shows which keys
      prove it
- [ ] Unit tests for filtering and search in `src/lib/evals/traceIndex.test.ts` over a real
      shipped trace: filter by event type; search by document number or word matches
      values, not keys; a trace with 0 events returns an empty result
- [ ] `CasesTable.tsx`, `RunPanel.tsx` and `TraceViewer.tsx` keep selection, counting and
      filtering logic in the tested pure modules; any logic left in them has a test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] `/evals/cases?iteration=<id>` lists the cases whose hit count differs between the
      iteration's setup and its `comparedTo` setup in that iteration's suite, with columns
      Rule · company-week (tuning / held-out) | Expected (Flag / Skip) | After | Before |
      What happened (Fixed / Regressed / Trap / Indirect tag plus the key's short reason)
- [ ] The filter buttons ("Changed in <iteration>", "Still missed", "Traps flagged", "All N
      cases") each show a computed count, and no more than 4 choices are visible
- [ ] The report states where per-case hits come from (`report.json` rule-level results, or
      a port of the POC grader), with the `report.json` keys inspected
- [ ] Subset grading is reproduced: flags outside the key are not penalised; the report
      shows that making the grader penalise them turns `grade.test.ts` or `cases.test.ts`
      red, then green after the revert
- [ ] The run side panel has Run 1 | 2 | 3 tabs; "Why the filter flagged it" from the
      `filter.decision` reason; the passages read, when the setup used them; trace checks
      as "All N passed" or the failing ones named; judge verdicts with votes and reasoning
      collapsed; and "Open this run's report" and "Raw trace · N events" links
- [ ] `/evals/traces/<suiteId>/<runId>` fetches one gz file, decompresses it in the browser
      through the loader, shows the trace-check summary first, renders a virtualized list
      that stays smooth at about 1,000 events, offers event-type filter chips and a search
      box, and opens any event's JSON on click; the report explains the virtualization
      choice
- [ ] A raw trace is reachable from `/evals` in at most 3 clicks, and the report states the
      count
- [ ] The run report link renders the run's items, tiers, owners and dates; the report
      explains whether `ReportView` was reused or a thin eval-side adapter was written
- [ ] Every eval number shown comes only from data under `public/evals` (read through the
      loader), is labelled with its split and run count, and none is typed into a
      component, page or prose template
- [ ] Internal names (model IDs, component names) are allowed in the eval view; no eval
      page or component is imported by a GC route
- [ ] `EvalSidebar` has a working "Cases" entry and keeps every existing entry
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] At 390 px, the side panel stacks under the table
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes screenshots (Cases for iteration 06, run panel, trace viewer
      filtered to one event type, 390 px)
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
