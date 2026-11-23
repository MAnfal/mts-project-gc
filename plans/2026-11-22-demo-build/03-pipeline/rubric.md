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
- [ ] `src/lib/gateway.ts` — a colocated `gateway.test.ts` asserts what a caller of
      `gatewayCost()` receives: a reported cost (number and numeric string) comes back as a
      number, and missing metadata, a missing cost and a non-finite cost each come back as
      `0`. Model resolution (`languageModel`, `decisionModel`) is stubbed in every test and
      needs no test of its own — `.claude/resources/bibles/swe/testing.md`
- [ ] `src/lib/models.ts` — N/A if it is not created or holds only re-exports; if it gains
      behavior, a colocated test covers it the same way
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
- [ ] Every `throw` and every guard this chunk adds (not ones ported verbatim and already
      pinned by the replay) has a named test whose input is constructed in the test —
      it could not have been produced by the replay trace, the frozen week or any other
      committed fixture. Graded per throw/guard: list each one, the test that pins it, and
      confirm deleting it turns that test red. A guard pinned only by fixture data is a
      FAIL — `.claude/resources/bibles/swe/testing.md`

## Chunk-Specific Checks

### From the Convention Map — row `src/lib/**/*.ts` (matched by every module this chunk adds under `src/lib/`)

- [ ] Gates `pnpm test`, `pnpm lint` and `pnpm typecheck` were run after the last edit and
      exit 0 — `.claude/resources/bibles/swe/testing.md`
- [ ] Every module with pure logic (`events.ts`, `retry.ts`, `excerpts.ts`, `gateway.ts`'s
      cost parsing, the stages' item building) has a colocated `*.test.ts` that asserts what
      a caller receives — return values and emitted events — not internal calls or call
      counts alone — `.claude/resources/bibles/swe/testing.md`
- [ ] No module under `src/lib/` imports React or anything from `react`/`react-dom` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Every module that touches secrets or the filesystem imports `server-only`: at least
      `gateway.ts` (it resolves the gateway key), and any pipeline module that reads the key,
      config files or a fixture outside a test — `.claude/resources/bibles/swe/testing.md`

### Repository and plan-branch constraints

- [ ] No `poc/` path is committed anywhere on the chunk branch. Both commands print
      nothing: `git ls-tree -r --name-only HEAD | grep '^poc/'` and
      `git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'` (the second
      catches a `poc/` path added then deleted inside the range)
- [ ] The decision-path config and libraries are unchanged:
      `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh` exits 0 after the last edit.
      The chunk is not expected to edit `config/`, `tier.ts`, `verify.ts` or `prompts.ts`;
      the replay's parity claim depends on them staying byte-identical to the POC
- [ ] No server code writes to the filesystem:
      `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` exits 0 after the last
      edit, and no route or module the chunk adds calls an fs write API (`writeFile`,
      `appendFile`, `mkdir`, `createWriteStream`, or equivalent)
- [ ] Nothing in the chunk depends on a deployed URL; runtime checks, if any, use the local
      stand-in (`pnpm build && pnpm start`) per the project Commands

### From the acceptance criteria and stated constraints

- [ ] The parity contract holds when run, and the report records the chosen trace id with
      why it qualifies: a `jev-sonnet-strict-passages` run (identified via its run record,
      since trace filenames carry no setup name) that finished `done` with at least one
      item on a frozen week — `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] The parity mutation is aimed at the comparison that **decides** which documents pass
      the relevance cut and reach the LLM filter, wherever the port places it — not at a
      comparison that only feeds a stage summary count. The report shows the mutated
      comparison (e.g. `>=` → `>`) turning `replay.test.ts` red and the revert turning it
      green. If the replay compares only final `relevant` flags and the mutation survives,
      the parity test must also compare which documents passed the cut (the trace records
      this per document); a surviving mutation is a FAIL —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] The replay makes no network call. Every primary-source read the pipeline makes
      during the replay (document re-fetch, full text for passages and date verification)
      is served from committed recorded data or stubs derived from the trace — captured
      from the real source, never hand-edited to make parity pass. A missing recording
      fails the test loudly rather than falling through to `fetch`. Where the trace records
      a count the recorded text determines (passage chunk counts per document), the replay
      asserts it matches, proving the recorded text is what the POC saw
- [ ] Only the live setup's path is ported — no baseline, arena, web-leads search or
      vote-majority code paths beyond what the live setup executes; any import the POC
      stages needed for an unported path is removed, not stubbed with dead code
- [ ] Every decision expression in the ported `stages.ts`, `excerpts.ts` and `run.ts`
      matches `poc:poc/src/lib/pipeline/`; a diff shows changes only for event emission,
      retry wrapping, the reason fallback and removal of unported paths — any other
      difference is documented as intentional or is a FAIL —
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
- [ ] Every external call — Federal Register/govinfo fetch, LLM call, Jev call — is wrapped
      in `withRetry`: at most 3 attempts in total, waiting 2 s before the second and 4 s
      before the third, the same request re-issued with unchanged inputs; after the third
      failure the step emits `step.failed` with its label and a plain-English timeout
      message, then `run.failed`, and no later stage runs
- [ ] Each retry constant carries a one-line comment giving its reason, and no comment in
      the chunk references a plan, chunk, ticket or PR —
      `.claude/resources/bibles/swe/code-comments.md`
- [ ] The reason leak is fixed: the fallback is the neutral text; an internal probability
      may reach a server log but never an item; `grep -rn "Jev p=" src/` finds nothing
- [ ] No persistence or spend ledger is ported: no `saveRun`, `spentUsd`, `budgetUsd` or
      ledger `guard()`; the internal tracer is a no-op or a log behind
      `process.env.DEBUG_PIPELINE` (a grep of `src/lib/pipeline` for those names finds none)
- [ ] `run.ts` is wiring: it sequences stages, passes outputs along and emits events; it
      adds no business rule of its own. *Plan constraint resolved:* decision expressions
      the POC kept in its orchestrator (the relevance cut, merging filter verdicts into
      decisions) may stay there verbatim, or move into a stage unchanged — "decision
      expressions untouched" outranks relocating them. A new rule, threshold or branch
      authored in `run.ts` is a FAIL —
      `.claude/resources/bibles/swe/patterns/orchestrator-pattern.md`
- [ ] `runPipeline(config, emit)` returns `{items, dropped, decisions, markdown}`
- [ ] Tier is assigned by code only; no LLM output sets or overrides a tier (Principle 1)
- [ ] The gateway port exposes only what the live path needs (`languageModel`,
      `decisionModel`, `gatewayCost`, plus at most a test-only model seam); it relies on
      `AI_GATEWAY_API_KEY` as the project Conventions describe — no `dotenv` loading, no
      read of `VERCEL_AI_GATEWAY_API_KEY`, no key value or explicit key passing in code,
      and no import-time throw that would break a build or test without the key
- [ ] Any dependency the port adds (e.g. a concurrency limiter the POC stages used) is
      pinned exactly in `package.json` at the POC lockfile's version, installed, and
      recorded in `project.md` Stack with the version read off disk
- [ ] Tests make no network call — the model layer and every fetch are stubbed
- [ ] The report states which AI SDK v7 surfaces were checked against the installed
      package, and explains both judgement calls (keep or drop the internal tracer; key the
      replay stubs by stage and order or by document number)
- [ ] `project.md` Conventions gains: GC-facing text comes only from `STEP_LABELS` and item
      fields, and `assertPublic` guards every event; `project.md` Layout lists the new
      `src/lib/pipeline/` modules, `gateway.ts` (and `models.ts` if created) and the
      replay fixture folder
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
