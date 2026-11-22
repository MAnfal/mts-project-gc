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
      with constructed dates: today on a Monday, a Saturday and a Sunday each yield full
      Mon–Fri windows, newest first; a today in the first days of January yields weeks that
      cross the year boundary; a range one day over `maxWindowDays` and a reversed range
      are rejected, and a range of exactly the maximum is accepted
- [ ] Unit tests for `formToProfile()` in `src/lib/runs/profileForm.test.ts`: the output is
      parsed by `CompanySchema` and the test asserts on the parsed value, for an empty areas
      table, one area, and a blank owner — `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for `POST` in `src/app/api/suggest-areas/route.test.ts`: an empty (and a
      whitespace-only) description returns 400 without calling the model; with the model
      stubbed, the response holds proposed areas with names and coverage and no owners
- [ ] Unit tests for the `profiles` store in `src/lib/runs/store.test.ts`: save, list and get
- [ ] `src/app/api/presets/route.ts` — `GET` returns exactly the `presets()` profiles; the
      evidence is a route test or the built server's response body recorded in the report
- [ ] Logic in `ProfilePicker.tsx`, `WeekPicker.tsx`, `ProfileEditor.tsx` and
      `OwnersTable.tsx` — detecting an edited profile, the switch-with-edits guard,
      custom-range errors — lives in a tested pure module, or has its own test
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time.** `.claude/resources/project.md` declared no
> Convention Map rows when this rubric was generated, so no row matched a file this chunk
> touches. The checks below are derived from the acceptance criteria, the test plan, the
> verification gates and the chunk's stated constraints. If the map has rows by the time
> this chunk is graded, also apply every row whose glob matches a touched file.

- [ ] On load, the profile picker lists exactly the demo presets, then saved profiles, then
      "New company…"; the first preset is selected with every field filled; preset entries
      carry a "Preset" badge
- [ ] No eval company is ever offered — the built server's `/api/presets` response body,
      recorded in the report, contains `ledgerly` and none of `brightside`, `cornercare` or
      `skyhop`
- [ ] Editing any profile field shows "<Name> (edited)" in the picker, and Run sends a
      custom profile rather than the preset id; nothing in the chunk writes to a preset's
      YAML
- [ ] Switching preset with unsaved edits shows an inline confirm offering "Discard edits"
      or "Keep editing"; `window.confirm` is not used
- [ ] The week buttons show the last three full Mon–Fri weeks relative to today, newest
      selected; "Custom" shows two date inputs; a reversed range or one longer than
      `maxWindowDays` (read from `config/app.yaml`) shows an inline error and disables Run;
      the window is never stored in a profile
- [ ] With no owner areas the run still starts, and text under the table says every item
      will route to the GC
- [ ] "Suggest from description" asks the server for proposed areas (name and coverage,
      owner left blank), fills them into the table for review, and never starts a run; the
      model ID and prompt are read from a `suggestAreas` block in `config/app.yaml` with
      its schema; the call is wrapped in `withRetry`; the request is validated with zod
- [ ] No GC-facing code, event, UI string or response this chunk adds or edits contains an
      internal name — `Jev`, `typesafe-ai`, a model ID or prompt text; internal
      identifiers are allowed only inside pipeline code, never in what reaches the GC
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] Decision-path config is untouched: the diff changes none of `config/prompts.yaml`,
      `prompt-sets/`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`, `experiment.yaml`,
      `companies/` or `evalsets/`, and each still matches `git show poc:poc/config/<path>`
      byte for byte, brightside's single added `use: eval` line excepted (the parity
      script passes where it exists)
- [ ] `suggestAreas` lives only in `config/app.yaml` and its schema — not in `prompts.yaml`
      or `experiment.yaml`
- [ ] `CompanySchema` in `src/lib/config.ts` is not loosened; the report states how the
      required owner email is satisfied (placeholder or optional column) and why
- [ ] Edited profiles are saved in an IndexedDB `profiles` store beside `runs` and listed
      under "Company profiles" for reuse
- [ ] Run navigates to `/runs/<id>` using the existing run-start path (no second fetch
      implementation), and `/` redirects to `/runs/new`
- [ ] The custom-profile field mapping reuses the POC's mapping rather than a new one
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] Every remove or other icon-only button in the owners table has an `aria-label` that
      names its area
- [ ] No file under `src/components/shell/` is modified — layout is built by composing
      `AppShell` and `SidebarNav`, not by editing them (`git diff --stat` against the base
      lists no shell path)
- [ ] The report includes screenshots (preset filled, edited state, switch confirm,
      custom-week error, 390 px) and explains the picker component choice
- [ ] `project.md` Layout gains the new paths; Conventions gains: UI-only config, including
      UI-only prompts, lives in `config/app.yaml`, never in a decision-path file
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
