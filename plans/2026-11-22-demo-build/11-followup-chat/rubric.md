<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 11 — Follow-up chat on a finished report — Review Rubric

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

- [ ] Unit tests for `buildFollowUpContext(viewState)` in `src/lib/followup/context.test.ts`
      on a real example run from `public/evals/user-view/runs/`: the output's key set
      equals the whitelist (items with tier, deadline, owner, reason, action and citation;
      sources; held-back list; screened-out titles and reasons; the profile), it holds no
      probability field, model ID or prompt text, and `assertPublic` passes on it —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit test for the system-prompt builder in `src/lib/followup/prompt.test.ts`: the
      prompt rendered from config contains the grounding rules and the instruction to say
      "That isn't in this report"
- [ ] Unit tests for `POST` in `src/app/api/followup/route.test.ts` with constructed bodies: a
      context carrying an internal field, a conversation one turn over the configured
      limit, and a missing `items` array each return 400 without calling the model
- [ ] Unit tests in `src/lib/runs/store.test.ts`: chat turns saved on a run are read back
- [ ] `FollowUpChat.tsx` — its stream reading and turn handling are covered by a test, or
      delegated to the AI SDK's `useChat`
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] Chat turns persist in IndexedDB keyed by run ID for both live and example runs (example runs have no run record), and survive a reload
- [ ] Suggestion chips and the composer render under the report for a finished run and for
      an example run; a running, failed or interrupted run renders no chat UI (the
      `followUp` mount in the run page is conditioned on status `done`)
- [ ] The chat is mounted through `ReportView`'s `followUp` prop from the run page and the
      example page; `src/components/gc/ReportView.tsx` is not modified
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] An answer streams in token by token via `streamText` through `/api/followup`, which
      sets `maxDuration`; `withRetry` wraps only the initial connect
- [ ] Each question-and-answer pair is saved on the stored run's IndexedDB record and comes
      back after a reload
- [ ] The route validates its body with zod and rejects with 400 a context that fails
      `assertPublic`, a conversation over the size limit read from config (default 20
      turns), and a missing `items` array
- [ ] Answers are grounded only in this run's report: the context holds nothing beyond the
      run's items, sources, held-back list, screened-out list and profile; no web search
      tool and no other run is available to the model
- [ ] The model, system prompt and suggestions come from a `followUp` block in
      `config/app.yaml` with its schema in `src/lib/config/schemas.ts`
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, and each still matches `git show poc:poc/config/<path>`
      byte for byte, brightside's single added `use: eval` line excepted (the parity
      script passes where it exists)
- [ ] The context sent to the model is a whitelist copy of public fields with `assertPublic`
      run on it
- [ ] No GC-facing code, event, UI string or response this chunk adds or edits contains an
      internal name — `Jev`, `typesafe-ai`, a model ID or prompt text; internal
      identifiers are allowed only inside pipeline code, never in what reaches the GC
- [ ] The server keeps no state between requests
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] The report explains the `useChat` vs fetch-reader choice, confirms the AI SDK v7
      `streamText` / `useChat` surfaces were checked against the installed package, and
      includes screenshots (chat hidden while running, chips and an answer on a finished
      run, an "isn't in this report" answer)
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
