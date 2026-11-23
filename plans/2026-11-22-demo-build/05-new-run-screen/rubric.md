<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 05 — New-run screen — Review Rubric

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

- [ ] Unit tests for `lastFullWeeks()` and `validateWindow()` in `src/lib/runs/weeks.test.ts`
      with constructed dates: today on a Monday, a Friday, a Saturday and a Sunday each yield
      complete Mon–Fri windows, newest first, and the rule for whether the week that ends on
      or just before today counts is asserted, not implied; a today in the first days of
      January yields weeks that cross the year boundary; a range one day over
      `maxWindowDays` and a reversed range are rejected; a range of exactly the maximum is
      accepted, counted inclusively the same way the server's request validation counts it
      — `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for `formToProfile()` in `src/lib/runs/profileForm.test.ts`: the output is
      parsed by `CompanySchema` and the test asserts on the parsed value, for an empty areas
      table, one area, and a blank owner; an unedited preset run through the form round-trips
      to a value deep-equal to the preset; fields the form doesn't expose are carried over
      from the source profile (or defaulted for a new company) —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for `POST` in `src/app/api/suggest-areas/route.test.ts` (or its sibling
      helper's test): an empty and a whitespace-only description return 400 without calling
      the model; with the model stubbed through the gateway seam, the response holds
      proposed areas with names and coverage and no owners; a model failure (including a
      missing Gateway key) returns a plain error with no stack, env var name, model ID or
      prompt text; retries are exercised with a zero-delay policy, not real waits —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for the `profiles` store in `src/lib/runs/store.test.ts`: save, list and
      get; the in-memory fallback when IndexedDB is unavailable; and an upgrade test — a
      database created at the previous version holding a run is reopened at the new version,
      the run is still there and the `profiles` store exists —
      `.claude/resources/bibles/swe/testing.md`
- [ ] `src/app/api/presets/route.ts` (if the chunk keeps it) — `GET` returns exactly the
      `presets()` profiles; the evidence is a route test or the built server's response
      body recorded in the report
- [ ] Logic in `ProfilePicker.tsx`, `WeekPicker.tsx`, `ProfileEditor.tsx` and
      `OwnersTable.tsx` — detecting an edited profile, the switch-with-edits guard,
      custom-range errors, area-name uniqueness — lives in a tested pure module under
      `src/lib/runs/`, or has its own test
- [ ] Any schema added to `src/lib/config/schemas.ts` has a test that loads the real
      `config/app.yaml` and asserts the parsed value —
      `.claude/resources/bibles/swe/testing.md`
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

Convention Map rows matched by the files this chunk touches: `src/lib/**/*.ts`,
`src/app/api/**/route.ts`, `src/components/**/*.tsx`, `src/lib/runs/**/*.ts` +
`src/components/gc/**/*.tsx`, and `config/**/*.yaml`. No row matches `src/app/page.tsx` or
`src/app/runs/new/page.tsx`; their checks below come from the acceptance criteria.

**Acceptance criteria**

- [ ] On load, the profile picker lists exactly the demo presets, then saved profiles, then
      "New company…"; the first preset is selected with every field filled; preset entries
      carry a "Preset" badge
- [ ] No eval company is ever offered — the built server's response (the presets route
      body, or the `/runs/new` HTML if presets are passed as page props), recorded in the
      report, contains `ledgerly` and none of `brightside`, `cornercare` or `skyhop`
- [ ] Editing any profile field shows "<Name> (edited)" in the picker, and Run sends a
      custom profile rather than the preset id; returning every field to the preset's value
      is not required to clear the edited state, but an untouched preset sends its id
- [ ] Editing a preset never writes server files: no code this chunk adds sends a profile
      to the server except inside the run request body, the preset's YAML under
      `config/companies/` is byte-identical after an edited run, and edited profiles are
      persisted only in the browser
- [ ] Switching preset with unsaved edits shows an inline confirm offering "Discard edits"
      or "Keep editing"; `window.confirm` is not used
- [ ] The week buttons show the last three full Mon–Fri weeks relative to today, newest
      selected; "Custom" shows two date inputs; a reversed range or one longer than
      `maxWindowDays` shows an inline error and disables Run; the window is never stored in
      a profile
- [ ] `maxWindowDays` is read from `config/app.yaml` (the value the run route enforces) and
      handed to the client by the server page; `config/experiment.yaml` is not read for it
      and not edited
- [ ] "Today" for the week buttons can't differ between server render and browser render
      (no hydration mismatch): either the server supplies the date or the buttons compute
      after mount; the report states which and the timezone used
- [ ] With no owner areas the run still starts, and text under the table says every item
      will route to the GC; the report states what the pipeline receives in that case and
      why it is safe for the filter step's structured output
- [ ] An area row with a blank owner routes to the GC rather than to an empty owner; two
      rows with the same area name are rejected inline before Run (an object keyed by area
      would silently drop one)
- [ ] Owner emails: rows from a preset keep their real emails; any placeholder is stable
      per person (the same owner in two areas gets one address, two different owners never
      share one), because the report groups draft emails by address
- [ ] "Suggest from description" asks the server for proposed areas (name and coverage,
      owner left blank), fills them into the table for review, and never starts a run
- [ ] Run navigates to `/runs/<id>` through the existing run-start path (`startRun` /
      `StartRunButton`, no second fetch implementation), and `/` redirects to `/runs/new`
- [ ] At 390 px width the panes stack and the page never scrolls sideways — shown in a
      screenshot or browser check, not inferred from the CSS
- [ ] The report includes screenshots (preset filled, edited state, switch confirm,
      custom-week error, 390 px) and explains the picker component choice and the owner
      email choice

**Presets and suggest-areas routes** (`src/app/api/**/route.ts` row)

- [ ] Each new route is server-only, parses its request body or query with zod before use,
      and returns no secret, stack trace, env var name, model ID or prompt text —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Each route file exports only HTTP handlers and segment config (`runtime`,
      `maxDuration`); prompt building and output parsing live in a sibling module with its
      own test — `.claude/resources/bibles/swe/testing.md`
- [ ] The suggest-areas model ID and prompt come from a `suggestAreas` block in
      `config/app.yaml` validated by a zod schema; the prompt is filled with the existing
      placeholder renderer, not a new one; the model is resolved through the existing
      gateway seam so tests stub it at no cost
- [ ] The model call is wrapped in the existing `withRetry` and disables SDK-level retries
      (`maxRetries: 0`), so one policy governs attempts
- [ ] `suggestAreas` lives only in `config/app.yaml` and its schema — not in `prompts.yaml`
      or `experiment.yaml`

**Config** (`config/**/*.yaml` row)

- [ ] Every key added to `config/app.yaml` has a zod schema in `src/lib/config/schemas.ts`,
      is read only through `readYaml`, and a test loads the real file and asserts the parsed
      value — `.claude/resources/bibles/swe/testing.md`
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, and `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh`
      passes after the last edit
- [ ] `CompanySchema` in `src/lib/config.ts` is not loosened (any diff to that file is a
      FAIL unless the report justifies it as non-decision-path)

**Browser code** (`src/lib/runs/**/*.ts` + `src/components/gc/**/*.tsx` row)

- [ ] Browser code imports nothing from `@/lib/config`, a `server-only` module or a Node
      built-in, and only `import type { … }` from `pipeline/events` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Sentences and counts shown to the GC (the week note, the bottom-bar summary, the
      empty-areas note, "(edited)" labels) are derived in a tested `src/lib/runs/` module,
      not composed inside components — `.claude/resources/bibles/swe/testing.md`
- [ ] The new `profiles` object store bumps the `reg-monitor` version and the upgrade
      creates only the stores the old version lacks (an existing `runs` store and its data
      survive) — `.claude/resources/bibles/swe/testing.md`
- [ ] Edited profiles are saved in that IndexedDB `profiles` store and offered again in the
      picker; the sidebar's "New run" and "Company profiles" links lead somewhere that works
      after `/` redirects (no link to an anchor or page that no longer exists)

**Pure logic** (`src/lib/**/*.ts` row)

- [ ] Pure logic (`weeks.ts`, `profileForm.ts`, any helper the components lean on) has a
      colocated `*.test.ts` asserting what a caller receives, and imports no React; a
      module touching the filesystem or secrets imports `server-only` —
      `.claude/resources/bibles/swe/testing.md`
- [ ] The inclusive day count used to validate a custom window is the same rule the run
      route enforces — one shared helper, or a test that pins both to the same answer at
      the boundary — not two independent re-derivations

**Components** (`src/components/**/*.tsx` row)

- [ ] Colours, radii and shadows come from theme tokens, never raw hex, `rgb()` or
      `rgba()` in `.tsx`; interactive elements are real `button` / `a` / `input` /
      `select` / `textarea`, never a clickable `div`; every form control has an associated
      label; every icon-only button has an `aria-label` naming what it acts on (in the
      owners table, the area it removes)
- [ ] No file under `src/components/shell/` is modified — layout composes `AppShell` and
      the sidebar primitives (`git diff --stat` against the base lists no shell path)
- [ ] shadcn components the chunk needs and lacks are added with `pnpm exec shadcn add`
      (not hand-written), and the Stack row listing `src/components/ui/` names them

**Decision 9, spend and repo hygiene**

- [ ] No GC-facing code, UI string, page prop or response this chunk adds or edits
      contains an internal name — `Jev`, `typesafe-ai`, a model ID or prompt text. The
      server page passes the client only the fields it renders (profiles, `maxWindowDays`,
      app name), never the `suggestAreas` block; checked in the built `/runs/new` HTML and
      the new routes' responses, not only in `.next/static`
- [ ] No server code this chunk adds or edits writes to the filesystem
      (`plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh` passes)
- [ ] No Gateway spend in any gate or test: every server the gates start runs with
      `AI_GATEWAY_API_KEY=` empty, and every model call in tests is stubbed
- [ ] Deployed-URL checks are evidenced by local stand-ins: `pnpm build && pnpm start`
      (keyless) and the recorded response or screenshot from that server
- [ ] No `poc/` path in the HEAD tree (`git ls-tree -r --name-only HEAD | grep '^poc/'` is
      empty) or in any commit since the plan branch
      (`git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'` is empty)
- [ ] These gates pass after the last edit, with output in the report:
      `bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh` (includes the earlier
      chunks' lint, test, build, typecheck, parity and no-fs-writes gates),
      `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`,
      and `bash scripts/verify-eval-bundle.sh`

**project.md**

- [ ] `project.md` Layout gains the new paths; Conventions gains: UI-only config,
      including UI-only prompts, lives in `config/app.yaml`, never in a decision-path file;
      the Convention Map's browser-code row still describes the store after the version bump
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
