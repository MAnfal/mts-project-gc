<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 02 — Port config and core libraries — Review Rubric

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

- [ ] The POC suites ported as `src/lib/{tier,verify,fr-text,config,prompt-sets}.test.ts`
      differ from `poc:poc/tests/<name>.test.ts` only in import and fixture paths —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] `src/lib/tier.ts` — `tier.test.ts` covers tier assignment: under 90 days is Critical
      for Rule and Proposed Rule only, plus the recently-effective rule
- [ ] `src/lib/verify.ts` — `verify.test.ts` covers quoted dates verifying against the
      source text, including a quote that must not verify
- [ ] `src/lib/fr.ts` text extraction — `fr-text.test.ts` covers govinfo text keeping its
      content after a literal `<`
- [ ] `src/lib/config.ts` — `config.test.ts` covers every config file validating and a
      malformed fixture being rejected
- [ ] `src/lib/prompts.ts` — the golden prompt-parity test renders the recorded inputs
      and compares byte for byte with `src/lib/__fixtures__/recorded-prompts.json`, and
      that fixture is the POC's recorded file unchanged (`git diff` against
      `poc:poc/tests/fixtures/recorded-prompts.json` is empty) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for `presets()` in `src/lib/presets.test.ts`: the result is exactly the
      demo-tagged companies (`hearth`, `ledgerly`) and a constructed company with no `use`
      field is excluded
- [ ] Unit tests for `listWindow()` and the in-memory cache in `src/lib/fr.test.ts`: with
      `fetch` stubbed to throw, a frozen-week window returns the frozen file's documents
      (count asserted equal to the file's, not to a typed literal) while a non-frozen window
      throws; with a counting `fetch` stub, `useCache=false` re-fetches and the cached path
      does not
- [ ] `src/lib/types.ts` — N/A: types only
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

- [ ] No `poc/` path is committed: `git ls-tree -r --name-only HEAD | grep '^poc/'` and
      `git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'` both print
      nothing. POC files reach the tree only as copies at their destination paths
      (`config/`, `src/lib/`), never through the index under `poc/`
- [ ] Every `src/lib` module that gains logic has a test file beside it in `src/lib/` that
      asserts the values a caller receives, not internal calls or that something merely ran
      (test file names may follow the POC suites they were ported from) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] No file under `src/lib/` imports React
- [ ] Every `src/lib` module that reads the filesystem (config YAML, frozen weeks, keys) or
      a secret imports `server-only`; modules that do neither (`tier.ts`, `verify.ts`) need
      not. *Contradiction resolved:* adding `import "server-only"` to `config.ts` or
      `fr.ts` is a runtime marker, not a decision expression, so it does not break the
      "change no decision expression" item below
- [ ] Every YAML kind under `config/` has a zod schema, in `src/lib/config/schemas.ts` or
      in the owning module that loads it, and that schema accepts the committed files as
      they are (including brightside's `use` value); a test loads the real committed files
      and asserts a parsed value, not only that parsing did not throw —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Decision-path config is byte-identical to the POC: `config/prompts.yaml`,
      `prompt-sets/*.yaml`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`,
      `experiment.yaml`, `companies/{cornercare,hearth,ledgerly,skyhop}.yaml` and every
      file under `evalsets/` match `git show poc:poc/config/<path>` — verified by running
      the parity gate, not by reading it —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] `config/companies/brightside.yaml` differs from the POC by exactly one added line,
      `use: eval`
- [ ] `plans/2026-11-22-demo-build/02-core-libs/parity.sh` is committed and can fail: it
      compares every `evalsets/` file (a file present on `poc` but missing locally fails
      it), enforces the one-line brightside rule, and the report shows a planted
      one-character change to a decision-path file making it exit non-zero, then passing
      after the restore
- [ ] The report records the new `configHash()` value and explains its difference from the
      POC's `9a0f857741` as the brightside edit alone
- [ ] `src/lib/config.ts` exports the ported surface (schemas, `companies`, `getCompany`,
      `prompts`, `promptSet`, `withPromptSet`, `render`, `frozenWeek`, `loadKey`,
      `evalsets`, `configHash`, `validateAll`) plus `presets()` filtering on
      `use === "demo"`; every YAML read goes through `readYaml`; `pinConfig`/`unpinConfig`
      are dropped only if the report shows no demo-path caller
- [ ] `src/lib/fr.ts` replaces the disk cache with a process-scoped `Map` using the same
      keys and `useCache` semantics; keeps the govinfo-first text fetch, the literal-`<`
      fix and `isBlockPage`; a window that matches a frozen week reads the committed file
      and any other window calls the live API
- [ ] `verify.ts`, `tier.ts` and `prompts.ts` differ from the POC only in import paths, and
      `config.ts` and `fr.ts` change no decision expression — tier is assigned by code
      (Principle 1) and dates are checked against the source text (Principle 3) exactly as
      in the POC — `.claude/resources/bibles/swe/patterns/migration-verification.md`
- [ ] No `writeFile`, `appendFile`, `mkdir`, `writeFileSync` or other filesystem write
      appears anywhere under `src/lib` (a grep for those calls over `src/lib`, run on the
      finished tree, finds none)
- [ ] `src/lib/types.ts` drops only arena-only types the demo never reads, and the report
      lists every dropped type
- [ ] Files land where the layout expects: config at the repo-root `config/` beside chunk
      01's `app.yaml` (kept), the prompt fixture under `src/lib/__fixtures__/`, and no
      `poc/` directory left behind
- [ ] Only the Federal Register API and govinfo are called, with no key and no paid or
      state-level source (Principle 4)
- [ ] No pipeline, route or UI code is added (`src/lib/pipeline/`, `src/app/` and
      `src/components/` are untouched)
- [ ] `project.md` Layout gains `config/` and `src/lib/`; Conventions gains the
      byte-identical decision-path rule (change only with a recorded reason) and the
      no-filesystem-writes-in-server-code rule
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
