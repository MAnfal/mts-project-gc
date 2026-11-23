<!-- The reviewer reads this. The implementer never does, and plan.md must not
     reference it. Separate documents prevent teaching to the test.
     Items state the RULE being verified, not an example copied from the plan. -->

# Chunk 01 — Scaffold, theme, config loader and deploy probe — Review Rubric

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

- [ ] Unit tests for `readYaml()` in `src/lib/config/load.test.ts`: a valid temp file
      returns the typed object and the test asserts a resolved field value (not just that
      something was returned); a field of the wrong type throws a message containing the
      file name and the failing field path —
      `.claude/resources/bibles/swe/testing.md`
- [ ] Unit tests for the probe route's `seconds` handling in
      `src/app/api/probe/stream/route.test.ts`: a value below the range, a value above it
      and a non-numeric value each resolve to a value inside 1–120, and a missing value
      resolves to the default
- [ ] `AppShell.tsx`, `SidebarNav.tsx` and `src/app/page.tsx` are presentational and need
      no unit test; any branching logic in them beyond rendering their props has one
- [ ] For each defensive branch in this chunk — a guard, a boundary, a clamp, a
      uniqueness or normalization check — a test exists whose input cannot come from the
      committed fixture. Delete the branch and confirm a named test goes red

## Chunk-Specific Checks

> **Convention Map: empty at generation time — this chunk is the one that fills it.** No
> map row matched a file this chunk touches. The checks below are derived from the
> acceptance criteria, the test plan, the verification gates and the chunk's stated
> constraints.

- [ ] From a fresh clone, `pnpm install --frozen-lockfile && pnpm build` succeeds and no
      code path reached at build time calls a model (no AI SDK call at module top level or
      in a statically rendered page)
- [ ] The app lives at the repository root (no `poc/` directory) on the POC's stack: Next.js
      16 App Router with `src/`, React 19, TypeScript 5, Tailwind 4, shadcn on Base UI,
      `ai` v7 with `@ai-sdk/gateway`, zod 4, yaml 2, vitest, ESLint 9, pnpm 9;
      dependency versions are pinned exactly in `package.json`
- [ ] `/` renders inside `AppShell` (cream sidebar with the "Reg Monitor" wordmark,
      floating white panel) and shows a value read server-side from `config/app.yaml`
      through `readYaml` — not a hard-coded string — plus a primary button, a status
      badge per tone and a link to the probe
- [ ] `readYaml(relPath, schema)` is server-only (cannot be bundled into client code),
      reads `config/<relPath>` under `process.cwd()`, parses with `yaml`, validates with
      zod, and throws `Config error in <file>: <path>: <message>` — the error names the
      file and the failing field, never a bare parse or zod error
- [ ] `next.config.ts` declares `outputFileTracingIncludes` covering `config/**`, so the
      YAML ships inside the deployed function bundle
- [ ] `config/app.yaml` holds `appName` and `maxWindowDays`, validated by a zod schema in
      `src/lib/config/schemas.ts`; no other file exists under `config/`
- [ ] `src/app/globals.css` defines the measured GC AI tokens under shadcn's variable names
      (background, card, foreground, primary, primary-foreground, muted/secondary,
      muted-foreground, border, ring, radius) with the values recorded in
      `plans/2026-11-22-demo-build/design/gcai-ui-notes.md`, plus a surface/foreground
      pair for every status tone, shadow tokens and the heading colour; Inter loads via
      `next/font/google`; light theme only
- [ ] `AppShell` takes `sidebar`, `children` and an optional `aside` and reproduces the
      three-pane layout of `design/HiReport.dc.html`: sidebar 220–264 px, white panel
      with 8 px margin, 12 px radius and the extra-small shadow, optional right panel;
      at narrow widths the panes wrap into one column
- [ ] `SidebarNav` provides the wordmark, a nav item (icon + label, with an active state
      exposed to assistive tech, e.g. `aria-current`) and a section label
- [ ] UI rules hold for every component this chunk adds or edits: colours, radii and
      shadows come from theme tokens (no raw hex or rgb literal in `.tsx`); interactive
      elements are real `button`, `a` or `input`/`select`/`textarea` elements, never a
      clickable `div`; every form control has an associated label; every icon-only button
      has an `aria-label` naming what it acts on; at 390 px width the page never scrolls
      sideways (shown in a screenshot or browser check, not inferred from the CSS)
- [ ] The probe route runs on the Node runtime, exports `maxDuration = 300`, and returns a
      `ReadableStream` that writes one `tick N` line per second for `seconds` (default 5,
      clamped to 1–120) and then a final `done` line; it validates its input and returns
      no secret or environment value
- [ ] The report shows the built server (`pnpm start`) streaming the probe to a final
      `done` line
- [ ] No server code this chunk adds or edits writes to the filesystem — no `writeFile`,
      `appendFile`, `mkdir`, `writeFileSync`, `createWriteStream` or equivalent in any
      route or module it imports
- [ ] `.gitignore` keeps every existing entry (including `.worktrees/`) and adds `.next/`,
      `node_modules/`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel` and `.env*.local`; no
      `.env*` file is committed
- [ ] `project.md` Stack lists versions read from `node_modules` (the report shows how they
      were read) and states the harness as plain Vercel AI SDK + AI Gateway with Flue/Pi
      deferred and the reason; the "Not yet measured" text is gone
- [ ] `project.md` Commands fills every row with an exact command the report shows being
      run — install with a frozen lockfile, bootstrap that also links `.env.local` from the
      main checkout when present, `pnpm typecheck` (backed by a `typecheck` script),
      `pnpm lint`, `pnpm test`, `pnpm build` — and marks the monitor-pass and evals rows
      `N/A`
- [ ] `project.md` Principles changes only the status line, to "Ratified 2026-11-22"; the
      principle text is byte-identical
- [ ] `project.md` Convention Map has rows for `src/lib/**/*.ts` (colocated `*.test.ts`, no
      React imports), `src/app/api/**/route.ts` (server-only, zod-validated input, no
      secrets in responses), `src/components/**/*.tsx` (theme tokens, never raw hex; real
      interactive elements) and `config/**/*.yaml` (has a zod schema; loaded only through
      `readYaml`); each `Doc` cell cites a bible leaf page that carries the rule (e.g.
      `.claude/resources/bibles/swe/testing.md`) or `—`, never a `decision-tree.md`
- [ ] `project.md` Conventions names the AI Gateway key's environment variable and says it
      is the one to set in Vercel; Layout shows the tree that actually exists
- [ ] Every line this chunk adds to `.claude/resources/project.md` is true of the tree after
      the chunk and was measured, not assumed (a version read off disk, a command actually
      run); each rule lives in one section only; and each added line passes the filtering
      test — removing it would let a cold reader make a mistake —
      `.claude/resources/bibles/prompt-engineering/conventions/ai-optimized-writing.md`
- [ ] `CLAUDE.md`: the pipeline line names the plain Vercel AI SDK (with AI Gateway) as the
      harness with Flue/Pi deferred, and `git diff` on `CLAUDE.md` shows that one line and
      nothing else. *Contradiction resolved:* the two required wordings differ ("Vercel AI
      SDK" vs "plain Vercel AI SDK + AI Gateway"); either passes, because the stated
      constraint is that nothing else in the file changes and the gate only forbids the
      Flue claim
- [ ] `plans/2026-11-22-demo-build/01-scaffold/gates.sh` is committed, and the report
      records each gate's command, exit status and error text on the base commit and on the
      finished tree — with different error text on the two runs, proving the gate tests
      the tree
- [ ] The report explains the scaffold choice (`create-next-app` then prune, or configs by
      hand) and that the Next 16, shadcn and AI SDK v7 surfaces used were checked against
      the installed packages
- [ ] The report ends with a "For the user: Vercel setup" section naming the env var, the
      framework preset (Next.js, root `/`, pnpm) and the two deployed-URL checks: open `/`,
      and stream the probe for 90 s until it prints `done`

## Verdict

**PASS** or **FAIL**, then:

- **Issues** — blocking problems, each with file, line, and what's wrong
- **Warnings** — non-blocking, worth fixing
- **Guidance** — what the next iteration should do first

Return this verdict as your final response text. Anything that must survive the review
goes in a file in the chunk directory — a message is not an artifact.
