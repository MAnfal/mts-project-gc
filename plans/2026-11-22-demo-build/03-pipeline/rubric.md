<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 03 — Port the pipeline with public step events and retries — Review Rubric

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

- [ ] `src/lib/pipeline/run.ts` — replay parity test for `runPipeline()` in
      `src/lib/pipeline/replay.test.ts`: with the model layer stubbed from a real
      recorded trace, every filter relevance decision, tier, owner and item
      `document_number`, `deadline` and `citation` equals the trace, ignoring only the
      reason text; the trace fixture is committed unmodified from the POC suite —
      `.claude/resources/bibles/swe/testing.md`,
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] `src/lib/pipeline/stages.ts` and `excerpts.ts` — every stage's decisions are compared
      by the replay parity test (not only the final items), and the emitted `step.progress`
      and `item.confirmed` events are asserted in the replay or events test
- [ ] `src/lib/pipeline/context.ts` — a test shows a `RunCtx` external call (`stage()`,
      `agent()`, `object()` or `jev()`) being retried through `withRetry`, and an emit
      carrying an internal name being rejected by `assertPublic`
- [ ] `src/lib/gateway.ts` and `src/lib/models.ts` — N/A: ported plumbing, stubbed in every
      test
- [ ] Unit tests for `assertPublic()` in `src/lib/pipeline/events.test.ts`: every event of
      the replay run, serialized, contains none of `jev`, `typesafe-ai`, `claude-`,
      `anthropic/`, `openai/`, `google/` and `moonshotai/` (all of them, checked
      case-insensitively), and a constructed event carrying an internal model or component
      name makes it throw
- [ ] Unit tests for `withRetry()` in `src/lib/pipeline/retry.test.ts`, with fake timers: two
      failures then success resolves and reports two retries at 2000 and 4000 ms; three
      failures reject; the retried call receives identical arguments each time; at run
      level, exhaustion produces `step.failed` then `run.failed` and no later stage runs
- [ ] Unit test for the item-reason fallback in `reason.test.ts`, colocated with the code
      that builds items: a decision with no LLM reason but an internal probability produces
      the neutral text "Flagged as relevant to your profile", and the probability appears
      nowhere in the item
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] The parity contract holds when run, and the report records the chosen trace id with
      why it qualifies (a finished run with at least one item on a frozen week), plus the
      mutation run: flipping the relevance-threshold comparison in `stages.ts` turns
      `replay.test.ts` red and reverting turns it green —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] Only the live setup's path is ported — no baseline or arena code paths
- [ ] Every decision expression in `stages.ts` and `excerpts.ts` matches
      `poc:poc/src/lib/pipeline/`; a diff shows changes only for event emission, retry
      wrapping and the reason fallback — any other difference is documented as
      intentional or is a FAIL —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] `RunEvent` is a typed union of `run.start`, `step.start`, `step.progress` (count,
      current item title), `step.retry`, `step.done` (count, ms), `step.failed`,
      `item.confirmed`, `run.done` and `run.failed`; `run.done` carries `items`, `dropped`
      (document number, title, plain reason), `screenedOut` (document number, title,
      one-line filter reason, in relevance-rank order, with no probability),
      `notReviewedCount`, `scanned` and `markdown`
- [ ] GC-facing step text comes from one `STEP_LABELS` table mapping each internal stage ID
      to a plain-English label; no stage label is built anywhere else
- [ ] Every public event passes through `assertPublic` before it leaves the pipeline —
      no emit path bypasses it — and no event payload carries an internal component name,
      a model ID or prompt text. Internal identifiers inside `src/lib/pipeline` code are
      allowed; the rule binds what is emitted
- [ ] Every external call — Federal Register/govinfo fetch, LLM call, Jev call
      — is wrapped in `withRetry`: at most 3 attempts, waiting 2 s then 4 s, the same request
      re-issued with unchanged inputs; after the third failure the step emits `step.failed`
      with its label and a plain-English timeout message, then `run.failed`.
      *Contradiction resolved:* the retry policy also lists an 8 s third delay and a 14 s
      longest wait, which only a fourth attempt could reach; graded toward the stated
      3-attempt limit and the observable delays (2000 and 4000 ms), so an 8 s entry may
      exist but must never trigger a fourth attempt
- [ ] Each retry constant carries a one-line comment giving its reason, and no comment in
      the chunk references a plan, chunk, ticket or PR —
      `.claude/resources/bibles/swe/code-comments.md`
- [ ] The reason leak is fixed: the fallback is the neutral text; an internal probability
      may reach a server log but never an item; `grep -rn "Jev p=" src/` finds nothing
- [ ] No persistence or spend ledger is ported: no `saveRun`, `spentUsd`, `budgetUsd` or
      ledger `guard()`; the internal tracer is a no-op or a log behind
      `process.env.DEBUG_PIPELINE` (a grep of `src/lib/pipeline` for those names finds none)
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] `run.ts` is wiring only — it sequences stages, passes outputs along and emits
      events; every business rule lives in the stages, `tier` or `verify` —
      `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md`
- [ ] `runPipeline(config, emit)` returns `{items, dropped, decisions, markdown}`
- [ ] Tier is assigned by code only; no LLM output sets or overrides a tier (Principle 1)
- [ ] `gateway.ts` and `models.ts` port only `languageModel`, `decisionModel` and
      `gatewayCost`, and read the key from the env var named in `project.md` Conventions;
      no key value appears in code
- [ ] Tests make no network call — the model layer and `fetch` are stubbed
- [ ] The report states which AI SDK v7 surfaces were checked against the installed
      package, and explains both judgement calls (keep or drop the internal tracer; key the
      replay stubs by stage and order or by document number)
- [ ] `project.md` Conventions gains: GC-facing text comes only from `STEP_LABELS` and item
      fields, and `assertPublic` guards every event
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
