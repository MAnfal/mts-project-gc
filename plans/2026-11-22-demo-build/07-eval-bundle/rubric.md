<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 07 — Eval data bundle — Review Rubric

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

- [ ] Unit tests for the index schema in `src/lib/evals/index-schema.test.ts`: a minimal
      valid index is accepted; a metric missing `split` and a metric missing `runs` are
      each rejected
- [ ] Unit tests for `loadIndex()`, `loadSuiteRuns(id)` and `loadTrace(suiteId, runId)` in
      `src/lib/evals/loader.test.ts` against a constructed bundle in a temp dir: gzip is
      decompressed with `DecompressionStream`; `loadTrace` yields parsed lines lazily as an
      async iterator; a trailing empty line is not parsed; a 0-byte trace is handled
      without a crash
- [ ] `scripts/verify-eval-bundle.sh` is the test for nothing-lost and the `live`
      recompute: the report shows it exiting non-zero and naming a deliberately deleted
      trace file, then passing after the restore
- [ ] `scripts/build-eval-bundle.sh` and `scripts/build-eval-index.mts` are exercised by the
      verify script, and a second build run leaves `git status` clean (idempotence)
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] Nothing is lost, verified by running the verify script: for every arena ID under
      `poc:poc/data/evals/`, the run count in `runs.jsonl.gz` equals the count of
      `runs/*.json` on `poc`, and every trace exists with identical bytes; every
      `user-view` run on `poc` ships, failed ones included; every `poc/data/iterations/*`
      directory has an entry, evidence-only ones included
- [ ] Any run record the export skips still ships in `runs.jsonl.gz`, flagged
      `superseded: true`
- [ ] The bundle is built from tracked `poc` data with the POC's own `export.mts`,
      `suiteReport` and `checkTrace`, run unmodified — not from `poc/data/exports/`, and
      with no edited copy of the grading code
- [ ] `public/evals/` follows the contract layout (index, one shared `config/`, per-suite
      manifest, report, trace-checks, runs and traces, `user-view/`, `iterations/`), with
      no per-suite config copies, and `public/evals/config/` is byte-identical to
      `poc:poc/config/`
- [ ] The repo's `config/` directory is untouched by this chunk
- [ ] `index.json` validates against `src/lib/evals/index-schema.ts`; every number in it is
      `{value, split, runs, suite}`; `live` is the live setup pooled over both
      iteration-06 suites using `suiteReport`'s own inclusion rule (the count it used is
      reported), split all / dev / test; `baseline` is computed the same way on the latest
      suite where it ran, with that suite recorded; no figure is copied from the README
- [ ] The verify script recomputes `live` from runs decoded out of the shipped
      `runs.jsonl.gz` and the shipped keys, not from the `poc` source files or typed
      figures — `.claude/resources/bibles/swe/testing.md`
- [ ] `public/evals` ships as static files: no route or server module imports from it
      (grep and build output), `.gz` files are served as `application/gzip` and
      decompressed by the client, with no reliance on `Content-Encoding`
- [ ] The loader is browser-side and fetch-based with no `fs` import; the build scripts are
      build-time only and imported by no app code
- [ ] `build-eval-bundle.sh` is documented at the top, idempotent, creates the POC worktree
      only if absent, and removes nothing from it
- [ ] The bundle stays under 150 MB (`du -sm public/evals`, recorded in the report)
- [ ] The report gives per-suite run, trace and byte counts; the `live` and `baseline`
      numbers with split and run counts beside the POC README's figures, explaining every
      difference; the "Rebuild the eval bundle" Commands line for the lead; and the
      judgement call on where `build-eval-index.mts` lives, with its reason
- [ ] `project.md` changes only Layout (`public/evals/`, `scripts/`) and Conventions (the
      bundle is generated, never hand-edited, rebuilt from `poc`); Stack and Commands are
      untouched. *Contradiction resolved:* `project.md` asks for a new command to land in
      the chunk that adds it, but this chunk runs in parallel with another that edits
      Commands, so the Commands line goes in the report for the lead instead
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
