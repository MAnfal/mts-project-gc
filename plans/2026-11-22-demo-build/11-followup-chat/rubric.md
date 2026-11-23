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

- [ ] Unit tests for the context builder (`buildFollowUpContext()` or whatever the chunk
      names it) in its colocated `*.test.ts`, run on a real GC-facing example run
      (`public/examples/<id>.json` folded through `reduceEvents`, the same path the GC page
      takes): the output's key set equals the whitelist (items with tier, deadline, owner,
      reason, action and citation; sources; held-back items; screened-out titles and
      reasons; the run's profile), and the serialized output passes the internal-name
      check (`assertPublicText` from `src/lib/pipeline/events.ts`, imported, not retyped) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] The builder is also tested on **constructed** inputs no shipped example produces: a
      view carrying an extra field (an internal score, a model id, prompt text) that the
      output does not contain; a finished run with 0 items (accepted, not rejected); and a
      view where the GC confirmed a held-back item (`applyConfirmed`), which the context
      reports as confirmed by the GC and untiered, never as an ordinary tiered item
- [ ] Unit test for the system-prompt builder in its colocated `*.test.ts`: the prompt
      rendered from the real `config/app.yaml` contains the grounding rules and the
      instruction to say "That isn't in this report", and passes `assertPublicText` (the
      system prompt names no internal component or model)
- [ ] Unit tests for the follow-up route's body guard and handler, with constructed bodies,
      each returning 400 **without the model being resolved or called**: a context that
      fails the internal-name check; a conversation one turn over the configured limit
      (and one at the limit accepted); a missing `items` array; a malformed or non-JSON
      body. The test asserts the model stub saw zero calls
- [ ] A route test drives a mock streaming model (`MockLanguageModelV4` with `doStream`,
      installed through `setModelsForTests` in `src/lib/gateway.ts`) and asserts the
      response arrives as more than one chunk and reassembles to the model's text; a
      second test makes the model fail and asserts the client receives a fixed public
      message (no SDK error text, no model id) and the failure is logged server-side
- [ ] A test shows the route answers a fixed 503 (no model id, no env-variable name, no
      config key in the body) when the Gateway key is missing, before any stream starts
- [ ] If the initial connect is retried, a test with a model that fails then succeeds
      proves the retry (policy passed as a parameter with zero delays, as
      `src/app/api/suggest-areas/suggest.ts` does) and that the SDK's own retries are off
      (`maxRetries: 0`). If no retry is implemented, the report records why
- [ ] Unit tests in `src/lib/runs/store.test.ts`: chat turns saved under a live key and an
      example key are read back, independently; a run with no chat reads as none; an
      upgrade from the previous `reg-monitor` version keeps every existing run and profile;
      the in-memory fallback holds chat turns too
- [ ] The client's stream reading and turn handling (fetch reader or AI SDK transport) is
      covered by a test of a pure helper, or delegated entirely to an AI SDK primitive whose
      use is shown in the report
- [ ] The mount condition is tested: rendering the run screen (or the helper that decides
      it) for `running`, `failed` and `interrupted` yields no chat, and for `done` yields
      the chat — `.claude/resources/bibles/swe/testing.md`
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red
- [ ] Every new `throw` or guard (body shape, turn limit, size cap, internal name in the
      context, missing key, unknown chat key) has a test whose input is constructed, not
      drawn from a shipped example, and the report names that test per guard

## Chunk-Specific Checks

Convention Map rows matched: `src/lib/**/*.ts` (`.claude/resources/bibles/swe/testing.md`)
for the follow-up lib modules and the store; `src/app/api/**/route.ts`
(`.claude/resources/bibles/swe/testing.md`) for the follow-up route;
`src/components/**/*.tsx` (no doc) for the chat component and the views it is mounted in;
`src/lib/runs/**/*.ts`, `src/components/gc/**/*.tsx`, `src/app/examples/**`
(`.claude/resources/bibles/swe/testing.md`); `config/**/*.yaml`
(`.claude/resources/bibles/swe/testing.md`) for `config/app.yaml`. Conditional, applied
only if touched: `src/lib/pipeline/**/*.ts`, `src/lib/gateway.ts`
(`.claude/resources/bibles/swe/patterns/migration-verification.md`). The `project.md`
edit is governed by the prompt-engineering bible.

### Chat behaviour (SPEC US3)

- [ ] Suggestion chips and the composer render under the report for a finished live run
      and for an example run, through `ReportView`'s `followUp` prop;
      `src/components/gc/ReportView.tsx` is not modified
- [ ] No chat UI renders for a running, failed or interrupted run, nor while a run or
      example is still loading; the mount sits inside the branch that renders the finished
      report, so no other status can reach it
- [ ] The reviewer-facing run report (`/evals/reports/…`, `ReportView` with `readOnly`)
      shows no chat, and nothing under `src/components/evals` or `src/app/evals` imports
      the chat
- [ ] An answer streams in token by token via `streamText` through the follow-up route,
      which sets `maxDuration`; the UI shows the partial answer as it arrives and a fixed,
      plain failure message (with a way to ask again) if the stream fails
- [ ] Answers are grounded only in this run: the context holds nothing beyond the run's
      items, sources, held-back items (and any the GC confirmed), screened-out titles and
      reasons, and the profile; the model call has no tools (no web search) and no other
      run's data; the system prompt tells the model to say "That isn't in this report" when
      the material doesn't answer the question
- [ ] The server keeps no state between requests: each request carries the run context and
      the conversation, and nothing is stored server-side
- [ ] Chat turns persist in the browser keyed by run (live and example runs kept apart,
      e.g. by a `live:` / `example:` prefix) and come back after a reload, for both a live
      run and an example run. Turns live in their own object store, not on the `StoredRun`
      record: example runs have no record, and live runs' events stay what the server sent
- [ ] Writing chat turns is the only IndexedDB write an example page makes: example pages
      still offer no "Add after checking" and no Retry, and never write a run record
- [ ] The new object store bumps the `reg-monitor` version by one and creates only the
      stores the old version lacks — `.claude/resources/bibles/swe/testing.md`

### Request guard and model call

- [ ] The route's request body is parsed with zod before use and rejects with 400: a
      context that fails the internal-name check, a conversation over the turn limit read
      from config (default 20 turns), a missing `items` array, and a message or context
      over any size cap the chunk sets. Rejections happen before a model is resolved
- [ ] `route.ts` exports only HTTP handlers and segment config (`runtime`, `maxDuration`);
      the body guard, prompt building and model call live in a sibling module with their
      own test, as `src/app/api/suggest-areas/` does —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Every response and stream the route sends carries fixed public text on failure: no
      SDK error message, stack trace, model id, env-variable name or config key; the real
      error goes to the server log with a prefix
- [ ] The model call goes through `languageModel()` (`src/lib/gateway.ts`) with the SDK's
      retries off (`maxRetries: 0`); any retry goes through `withRetry`
      (`src/lib/pipeline/retry.ts`) and actually re-attempts a failed connect (a
      `withRetry` wrapped around a call that never throws, such as a bare `streamText`,
      does not count)
- [ ] The model, system prompt, suggestions and turn limit come from a `followUp` block in
      `config/app.yaml`, with its own slice schema in `src/lib/config/schemas.ts`, read only
      through `readYaml`, and a test loads the real file and asserts the parsed value. The
      browser receives only the suggestion strings as props, never a parsed slice that
      names a model or holds the system prompt
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, nor `src/lib/{tier,verify,prompts}.ts`, and
      `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh` passes
- [ ] If `src/lib/pipeline/**` or `src/lib/gateway.ts` is touched: decision expressions are
      unchanged, `replay.test.ts` and
      `bash plans/2026-11-22-demo-build/03-pipeline/mutations.sh` pass —
      `.claude/resources/bibles/swe/patterns/migration-verification.md`. N/A when untouched

### Decision 9: nothing internal reaches the GC

- [ ] The context sent to the model is built by copying named public fields (never a
      spread of view state or a run record), and the route runs the internal-name check on
      the whole serialized context before calling the model
- [ ] The system prompt is never sent to the browser and never echoed: it is absent from
      every page's HTML/RSC payload, from the client chunks of the GC routes, and from the
      route's responses; the system prompt instructs the model not to reveal its
      instructions or name the model or vendor
- [ ] The follow-up model id is absent from the GC routes' HTML and client chunks and from
      the route's keyless and 400 responses, shown by a check against the id read from
      `config/app.yaml` (Gate 5's fixed needle list does not cover a new model id)
- [ ] No GC-facing code, UI string, request or response this chunk adds names an internal
      component, model id or vendor path (`jev`, `typesafe-ai`, `claude-`, `anthropic/`, …);
      the case-insensitive grep over `src/components/gc`, `src/lib/runs`, `src/app/runs`,
      `src/app/examples` and any new browser-side lib directory finds nothing
- [ ] Every GC-facing route the chat appears on is covered by chunk 04's Gate 5
      (`GC_ROUTES` in `plans/2026-11-22-demo-build/04-run-and-report/gates.sh`); a new GC
      page route, if the chunk adds one, is added to that list and the report shows Gate 5
      failing on a planted internal name in it. N/A if no route is added

### Browser code and conventions

- [ ] Browser code (the chat component, the views it is mounted in, and every module they
      import, including any new `src/lib/` directory) imports neither `@/lib/config`, a
      `server-only` module nor a Node built-in, and only `import type { … }` from
      `pipeline/events`; the internal-name check runs server-side. If browser-side code
      lives outside `src/lib/runs`, `src/components/gc` and `src/app`, the report shows
      04's Gate 4 and 06's `GC_DIRS` checks were extended to cover it, or proves the same
      rule another way — `.claude/resources/bibles/swe/testing.md`
- [ ] Server-side modules the chat adds (prompt builder, route helper) import
      `server-only`
- [ ] Any page that reads config calls `await connection()` before reading; props are typed
      explicitly (no `PageProps`/`LayoutProps` globals); `params` are awaited
- [ ] A new dependency (e.g. `@ai-sdk/react`) is added only if needed, pinned exactly,
      version read off `node_modules/<pkg>/package.json`, and recorded in `project.md`
      Stack; the report explains the `useChat` vs fetch-reader choice against the installed
      `ai` 7.0.179 surfaces
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex, `rgb`/`rgba` literal or Tailwind palette
      colour in `.tsx`); chips and send are real `button` elements, the composer a real
      `textarea` with an associated label; every icon-only button has an `aria-label`;
      streamed answers are announced politely to assistive tech; layout follows
      `plans/2026-11-22-demo-build/design/HiReport.dc.html`; no file under
      `src/components/shell/` is modified (`git diff --stat` against the base lists no shell
      path)
- [ ] At 390 px width a finished run with the chat open (chips, composer and at least one
      long answer) and an example run with the chat never scroll sideways — shown by a
      browser check of `document.documentElement.scrollWidth` or a screenshot, not
      inferred from the CSS
- [ ] No server code this chunk adds or edits writes to the filesystem
      (`bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes)

### Gates, spend and evidence

- [ ] `AI_GATEWAY_API_KEY= PORT=<port> bash plans/2026-11-22-demo-build/06-edge-states/gates.sh`
      passes after the last edit, output in the report (it runs 05's, 04's and 03's gates,
      the examples rebuild and scan, and the keyless page checks)
- [ ] The chunk's own gates include a keyless check of the follow-up route on a local
      server: a valid body answers the fixed 503 and each 400 case answers 400, and no
      response body contains the follow-up model id, `AI_GATEWAY` or `followUp`
- [ ] No `poc/` path in the HEAD tree or in any commit of `feat/plan--demo-build..HEAD`,
      checked by an explicit count that is shown to be 0
      (`git ls-tree -r --name-only HEAD | grep -c '^poc/'` and
      `git log --name-only --format= feat/plan--demo-build..HEAD | grep -c '^poc/'`). A
      check written as `! … | grep -q` does not count: under `set -e` a negated pipeline
      never stops the script
- [ ] Runtime checks and screenshots come from a local production server
      (`pnpm build && next start` with `AI_GATEWAY_API_KEY` empty), stopped afterwards; no
      check relies on `next dev` or on a deploy
- [ ] **No Gateway spend** by the implementer or the reviewer: every test stubs the model
      through `setModelsForTests`; no live smoke runs with a key. Screenshots of an answer
      and of an "isn't in this report" answer come from seeded chat turns in IndexedDB or a
      stubbed route response, and the report says so
- [ ] The report includes screenshots: chat absent on a running run, chips and an answer on
      a finished run, chips and an answer on an example run, and an "isn't in this report"
      answer
- [ ] `project.md` Layout gains the new paths; Conventions gains where chat turns persist
      (the store, its key scheme, the version bump) and what the chat may send the model
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
