# Chunk 01 — Completion Report

Branch `feat/demo-build--scaffold`, cut from `feat/plan--demo-build` at `5ebffc7`. Every captured
output quoted below lives under the session scratch dir
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-01/`
(written `$S/` below). Two exceptions were not saved to files:
- the browser measurements (Chrome DevTools `evaluate_script` results in the session);
- the ad-hoc `grep -c` counts quoted inline.

The test, gate, canary and runtime outputs in the tables below are excerpts of the captured files.
The full script-generated excerpt (`$S/evidence.md`) is appended verbatim under "Appendix: captured
evidence", so it survives the scratch dir being cleared.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `package.json`, `pnpm-lock.yaml` | created | App at the repo root. Every dependency is pinned exactly, at the POC lockfile's resolved versions. Scripts: `dev`, `build`, `start`, `lint`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`). |
| `tsconfig.json`, `eslint.config.mjs`, `components.json` | created (copied from `poc:poc/…`, unchanged) | The POC's working Next 16 / ESLint 9 flat config / shadcn `base-nova` setup. |
| `vitest.config.mts` | created | `@` alias. Discovers `src/**/*.test.ts` (the POC used `tests/**`). Aliases `server-only` to its empty module. |
| `next.config.ts` | created | `outputFileTracingIncludes: {"/*": ["./config/**/*"]}` ships the YAML in every function. Tailwind runs through the Turbopack loader, as in the POC. |
| `config/app.yaml` | created | `appName: Reg Monitor`, `maxWindowDays: 7`. |
| `src/lib/config/schemas.ts` | created | `AppConfigSchema` (zod). |
| `src/lib/config/load.ts` | created | `readYaml(relPath, schema, {configDir?})`, server-only. Throws `Config error in config/<file>: <field.path>: <message>` for a missing file, bad YAML or a schema miss. |
| `src/lib/config/load.test.ts` | created | Six tests on real temp files, plus the repo's own `config/app.yaml`. |
| `src/app/api/probe/stream/route.ts` | created | `runtime = "nodejs"`, `maxDuration = 300`. Streams `tick N` once a second, then `done`. |
| `src/app/api/probe/stream/seconds.ts` | created | `parseSeconds`: zod coerce, floor, clamp 1–120, default 5. It's a sibling module because `route.ts` should export only handlers and segment config. |
| `src/app/api/probe/stream/route.test.ts` | created | Clamp table, `maxDuration`, and a real 1-second stream through `GET`. |
| `src/app/globals.css` | created | GC AI tokens in shadcn's variable names, plus heading/caption, 7 status pairs, navy shadows, and an explicit 4/6/12/16 radius scale. Light only: `@custom-variant dark (&:is(.dark *))` keeps `dark:` utilities inert. |
| `src/app/layout.tsx` | created | Inter via `next/font/google` (`--font-inter`). |
| `src/app/page.tsx` | created | Placeholder in `AppShell`: `appName` and `maxWindowDays` read per request (`await connection()`), a navy button, one badge per tone, a probe link, and a right panel. |
| `src/components/shell/AppShell.tsx`, `SidebarNav.tsx` | created | The three-pane shell and the sidebar parts (`SidebarNav`, `SidebarWordmark`, `SidebarNavItem`, `SidebarSectionLabel`). |
| `src/components/ui/button.tsx`, `badge.tsx`, `src/lib/utils.ts` | created from `poc:poc/…` | shadcn primitives. Button changed to `rounded-md` (6 px) and default `h-8.5` (34 px) to match GC AI. |
| `scripts/bootstrap.sh` | created | The Bootstrap command (see Judgment calls). |
| `.gitignore` | edited | Added `.next/`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel`, `.env*.local`. Existing entries kept. |
| `.claude/resources/project.md` | edited | Updated Stack (measured), Commands, Principles (ratified), Convention Map (4 rows), Conventions (8 entries, including the key name) and Layout. |
| `CLAUDE.md` | edited | Changed the harness sentence only (2-line diff). |
| `plans/…/01-scaffold/gates.sh` | created | The gates, each runnable on its own: `gates.sh [1|2|3|4|all]`. |
| `plans/…/01-scaffold/plan.md` | edited | Ticked T001–T011. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Fresh clone: `pnpm install && pnpm build` succeeds, with no model call | yes | Throwaway `git worktree add --detach $S/fresh 82986a8` → `bash scripts/bootstrap.sh` → `gates.sh all` printed `ALL GATES PASSED` (`$S/fresh-gates.txt`). No code imports `ai` or `@ai-sdk/gateway`: `grep -rn "from \"ai\"\|@ai-sdk" src/` gives 0 hits. Worktree removed afterwards. |
| `/` renders a placeholder in the GC shell (cream sidebar with "Reg Monitor", floating white panel) using the tokens, and shows a value read from `config/app.yaml` on the server | yes (under `pnpm start`, not the dev server; see Deviations) | In Chrome under `pnpm start`: body bg `rgb(244,245,241)`; `main` bg `rgb(254,254,255)`, radius `12px`, shadow `rgba(23,60,81,0.06) 0 1px 2px`; button `rgb(23,60,81)` / 6px radius / 34px tall / 14px 500; h1 `rgb(23,60,81)`; font `Inter`. Per request: editing `maxWindowDays` 7→9 under a running server changed the HTML (see Runtime config). |
| `GET /api/probe/stream?seconds=90` streams one line per second for 90 s, then `done`; `maxDuration = 300` | yes (locally) | `curl -sN` under `pnpm start`: `200 90.124297`, 91 lines, 90 `tick` lines, last line `done` (`$S/probe-90.txt`). `maxDuration` is asserted in `route.test.ts`. The deployed check is deferred to the user (last section). |
| A malformed `config/app.yaml` makes the loader throw naming the file and field | yes | Test `rejects a wrong type with an error naming the file and the field`. Live: with `appName: 42` the server logged `Config error in config/app.yaml: appName: Invalid input: expected string, received number` and `/` returned 500. |
| `project.md`: Stack/Commands/Convention Map/Layout describe what's installed; harness line replaced with reason; Principles ratified | yes | Versions were read with `node -p "require('./node_modules/<p>/package.json').version"` for 23 packages. Each command in the table was run (gate 1). Gate 3 needle C is 0 on the finished tree. |
| `CLAUDE.md` Pipeline line names the AI SDK harness; nothing else changes | yes, with a wording note | `git diff 5ebffc7 -- CLAUDE.md` is `2 insertions(+), 2 deletions(-)`, all in the Pipeline paragraph. The wording comes from T011, not the AC (see Deviations). |

## Tests

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `load.test.ts` › rejects a wrong type with an error naming the file and the field | Stub that returns `yaml.parse` unvalidated: `AssertionError: expected '' to match /^Config error in …/app\.yaml: appName: ` | pass |
| `load.test.ts` › names the nested field path | same stub: `expected [Function] to throw an error` | pass |
| `load.test.ts` › reports a YAML syntax error / a missing file against the file | same stub: `… but got 'Flow sequence in block collection mus…'` / `… but got 'ENOENT: no such file or directory, op…'` | pass |
| `load.test.ts` › returns the typed object for a valid file | `{}` stub: `expected {} to deeply equal { appName: 'Reg Monitor', …(1) }` | pass |
| `load.test.ts` › reads config/ under process.cwd() by default | `{}` stub: `expected undefined to be 'Reg Monitor'` | pass |
| `route.test.ts` › probe seconds clamp (8 cases) | Unclamped `Number(raw)` stub: `expected 500 to be 120`, `expected NaN to be 5`, `expected +0 to be 1`, `expected 2.7 to be 2`, … (7 of the 8 cases failed; `90` passed, as it should) | pass |
| `route.test.ts` › streams one tick line per second, then done | Empty-response stub: `expected '' to be 'tick 1\ndone\n'` | pass |
| `route.test.ts` › declares the 300 s function budget | Passed against the stub too, because the stub exported 300. It guards against regressions only. | pass |

The kinds of red, from `$S/red-*.txt`:
- `red-0`: an import error (`Cannot find module './load'` / `'./route'`, `Tests no tests`). It proves only that the modules were absent.
- `red-1` and `red-2`: assertion failures against plausible wrong implementations (`12 failed | 5 passed (17)`, then `2 failed`). These are the reds the Test Plan names.
- Green: `Test Files 2 passed (2) · Tests 17 passed (17)`.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| Schema validation is enforced | `load.ts`: `if (result.success \|\| true) return data` (skips validation) | `rejects a wrong type…`: `expected '' to match …appName: `; `names the nested field path…`: `expected [Function] to throw an error` (`$S/mut-1-noschema.txt`) |
| The error names the field path | `load.ts`: `fail(issue.message)` (path dropped) | Both field tests: `expected 'Config error in config/app.yaml: Inva…' to match …appName: ` (`$S/mut-2-nofield.txt`) |
| Clamp upper bound | `seconds.ts`: `Math.min(MAX_SECONDS, …)` removed | `seconds=500 becomes 120`: `expected 500 to be 120` (`$S/mut-3-noclamp.txt`) |

Each mutated file was copied aside and copied back; `diff -q` was clean after each restore.

## Gates

`plans/2026-11-22-demo-build/01-scaffold/gates.sh` follows the plan's gate block, with these hardening changes:
- Each gate is a function, so it can run alone on the base tree.
- Gate 2 also checks the `.nft.json` traces.
- Gate 3 also checks that the new harness line is present.
- Gate 4 waits for readiness instead of `sleep 4`, refuses a busy port, uses `curl --max-time 30`, and asserts exactly 3 ticks with `done` as the last line. An `EXIT` trap kills pnpm and the port's listener whether the gate passes or fails.

| Gate | Command | Result (finished tree, after the last code edit) | Fails on base? |
| ---- | ------- | ------ | -------------- |
| 1 install/lint/test/build/typecheck | `bash plans/2026-11-22-demo-build/01-scaffold/gates.sh 1` | `Tests 17 passed (17)`, build `ƒ /`, `ƒ /api/probe/stream`; lint printed no problems; `tsc` exit 0 | yes: exit 1, ` ERR_PNPM_NO_PKG_MANIFEST  No package.json found in …/chunk-01/base` |
| 2 config ships with the bundle | `… gates.sh 2` | `gate 2 OK` | yes: exit 1, `FAIL: config/app.yaml missing` |
| 3 harness line / measured stack | `… gates.sh 3` | `gate 3 OK` | yes: exit 1, `FAIL: CLAUDE.md still claims Flue` |
| 4 probe streams locally | `… gates.sh 4` (port 3101) | `gate 4 OK` | yes: exit 1, `FAIL: no package.json — nothing to start` |
| all | `… gates.sh all` | `ALL GATES PASSED` (`$S/final-gates.txt`; the output has no `warn`/`error` lines). Re-run after the last edit: `$S/final-gates-last.txt`. | — |

How the base run was done: `git archive 5ebffc7 | tar -x -C $S/base`, then `bash $S/gates.sh <n>` from inside it. Nothing was checked out or stashed. The base error text differs from the finished-tree text for every gate.

Per-assertion controls, run on the finished tree (`$S/canary-*.txt`, `$S/base-gate3-needles.txt`):
- **Gate 2, trace assertion.** Include glob changed to `./nothing/**/*` and rebuilt: `FAIL: config/app.yaml not traced into .next/server/app/api/probe/stream/route.js.nft.json`. Restored, rebuilt: `gate 2 OK`.
  - Measured first: without the include, `/`'s trace still holds `config/app.yaml` (Turbopack follows the statically scoped path), but the probe route's trace has none. The route trace is therefore the one that proves the option works.
- **Gate 2, key assertion.** `outputFileTracingIncludes` block deleted: `FAIL: next.config.ts declares no outputFileTracingIncludes`. Restored: OK.
- **Gate 3, needles probed one at a time.**
  - Base: needle A (`Harness: Flue`) present at `CLAUDE.md:11`; needle B (new line) count 0; needle C (`Not yet measured`) present at `project.md:39`.
  - Finished tree: `A=0 B=1 C=0`.
- **Gate 4, probe that never says `done`** (`"done\n"`→`"fin\n"`, rebuilt): `FAIL: probe did not finish: tick 1 tick 2 tick 3 fin`. Nothing was listening on 3101 afterwards. Restored, rebuilt: `gate 4 OK`.
- **Lint, seen red.** I appended `export function Unused() { let x: any = 1; return x; }` to a copied-aside `page.tsx`. `pnpm lint` exited 1 with `✖ 2 problems (2 errors, 0 warnings)` (`prefer-const`, `@typescript-eslint/no-explicit-any`; `$S/lint-red.txt`). Restored (`diff -q` clean), then lint exited 0.
- **Gate 4, busy port.** `python3 -m http.server 3101` running: `FAIL: port 3101 already in use`, exit 1.

**Baseline:** the base tree has no `package.json`, so type check, lint and tests cannot run there. There is nothing to diff against: zero pre-existing diagnostics. On the finished tree, lint reports 0 problems, `tsc` reports 0 errors, and the build prints 0 warnings, after fixing the Turbopack "Dynamic filesystem access" warning (see Deviations).

### Runtime config (YAML read per request)

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| `/` before the edit: `200`; `config-max-window-days">7<!-- --> days` | `$S/home-before.html`, `.meta` | — |
| `/` after `maxWindowDays: 9`, same server process: `200`; `…">9<!-- --> days` | `$S/home-edited.html`, `.meta` | `diff` of the extracted field from the two files: exit 1 (`< …7…` / `> …9…`), so the two bodies really differ |
| `/` with `appName: 42`: `500`; server log `Config error in config/app.yaml: appName: Invalid input: expected string, received number` | `$S/home-bad.html`, `.meta`, `$S/start-3102.log` | — |

`config/app.yaml` was copied aside before each edit, copied back after, and `diff -q` confirmed the restore.

### Browser checks (Chrome via DevTools, `pnpm start`)

- **1440×900:** sidebar 220 px; main panel 907 px, radius 12 px; right panel 280 px, radius 12 px. `scrollWidth 1440 = clientWidth 1440`.
- **390×844:** the panes wrap into a column (sidebar, main, aside, each 374 px wide). `scrollWidth 390 = clientWidth 390`, and no element's right edge goes past the viewport.
- **Raw colours:** `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/components src/app/page.tsx src/app/layout.tsx` gives 0 hits. Raw values exist only in `globals.css`.

## Judgment calls

- **Hand-written configs from the POC instead of `create-next-app` or `shadcn init`.**
  - `create-next-app` refuses or clobbers a non-empty directory, and this root already holds `CLAUDE.md`, `README.md` and `.gitignore`.
  - The POC's configs are that generator's output, and they already ran on this exact stack.
  - I copied `tsconfig.json`, `eslint.config.mjs` and `components.json` verbatim. The shadcn Button and Badge also come from the POC (generated by shadcn 4.23 `base-nova`).
  - The shadcn CLI works against this `components.json`: `pnpm exec shadcn add table --dry-run` planned `+ src/components/ui/table.tsx create` and wrote nothing.
- **Versions pinned to the POC lockfile, not `@latest`.** Chunk 02 ports the POC's tests and prompt-parity fixtures, and they assume this stack. `pnpm install` flagged newer versions (e.g. TypeScript 7.0.2, ESLint 10); I did not take them.
- **Tailwind via `@tailwindcss/turbopack`, no `postcss.config`.** This mirrors the POC. Next 16 builds with Turbopack.
- **Radius scale set explicitly** (`--radius-sm` 4px, `--radius-md` = `--radius` 6px, `--radius-lg` 12px, `--radius-xl` 16px). shadcn's multipliers on `--radius: 0.375rem` would give 3.6/4.8/6/8.4 px, not GC AI's measured scale. The computed button radius (6px) and panel radius (12px) were checked in the browser.
- **`readYaml` takes an optional `{configDir}`.**
  - Tests need temp fixtures, and vitest workers can't `chdir`.
  - The default path is `path.join(process.cwd(), "config", relPath)`, resolved on every call. The POC's tests read the real `config/` through the default, and chunk 02 can port them unchanged.
  - The override path carries a `turbopackIgnore` comment, so the bundler doesn't trace the whole project.
- **`/` renders per request through `await connection()`**, not `export const dynamic`. Next 16's docs say `dynamic` is removed when Cache Components is enabled (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md`). `connection()` works either way.
- **The probe emits `tick i` after i seconds**, so a `seconds=N` stream lasts about N s. It closes early if the client cancels.
- **`AI_GATEWAY_API_KEY` chosen as the env-var name.** `@ai-sdk/gateway@4.0.152` reads it natively (`dist/index.js`: `environmentVariableName: "AI_GATEWAY_API_KEY"`, documented as the second credential source after the `apiKey` option).
- **Bootstrap is a committed script** (`bash scripts/bootstrap.sh`), not a one-liner in the table: the `.env.local` logic is too long for a cell.
  - It runs `pnpm install --frozen-lockfile`.
  - It finds the main checkout through `git rev-parse --git-common-dir`, not a hard-coded path.
  - Then the first match wins: an existing `.env.local` is left alone; else the main checkout's `.env.local` is symlinked; else `AI_GATEWAY_API_KEY` (or the POC's `VERCEL_AI_GATEWAY_API_KEY`, renamed) is copied from the main checkout's `.env` into a mode-600 `.env.local`. The value is never printed.
  - **Copy branch, tested:** in this worktree and in the throwaway one it took the third branch (the main checkout has only `.env`). Result: `.env.local` with 1 `AI_GATEWAY_API_KEY=` line and 0 `VERCEL` lines, ignored by git.
  - **Symlink branch, tested without touching the user's checkout:** I built a scratch `git init` repo holding `package.json`, the lockfile, the script and a dummy `.env.local`, plus a worktree of it.
    - In the worktree: `bootstrap: symlinked .env.local -> …/bootrepo/.env.local`, and `ls -l` shows a symlink (`$S/bootstrap-symlink.txt`).
    - A second run printed `.env.local already present`. Run in the main repo itself, it left `.env.local` alone.
    - The scratch repo was removed afterwards.
- **The placeholder page has a right panel.** It exercises `AppShell`'s optional `aside`; otherwise that branch would ship unrendered.
- **The probe link sits in the sidebar under a "Diagnostics" label.** This exercises `SidebarSectionLabel` the way "RECENT RUNS" will.

## Deviations from the plan

- **CLAUDE.md wording.**
  - The AC says the Pipeline line reads "Harness: Vercel AI SDK (Flue/Pi deferred)"; T011 says "Harness: plain Vercel AI SDK + AI Gateway (Flue/Pi deferred)". I used T011's exact string.
  - The old sentence wrapped across two lines, so I put the new one on its own line. A single `grep` (gate 3) can then find it.
- **T001 before T002.** The test files were written first, but vitest couldn't run until the scaffold was installed. The first red run was therefore after the scaffold and before any loader or route existed (`red-0`).
- **`LayoutProps` swapped for an explicit `Readonly<{children: ReactNode}>`.** `pnpm typecheck` before any build failed with `src/app/layout.tsx(12,50): error TS2304: Cannot find name 'LayoutProps'`, because that global is generated by `next build`. With the explicit type, typecheck passes on a fresh tree before any build (`$S/fresh-typecheck-prebuild.txt`, exit 0).
- **The loader's file path is computed in two static shapes.** The first version, `path.join(dir, relPath)`, made Turbopack warn: "Dynamic filesystem access causes tracing of the whole project". After the change the build prints no warnings.
- **`server-only` added as a dependency** (not in the plan's list). The plan asks for a server-only loader, and Next resolves the package's `react-server` condition to an empty module. Vitest needed an alias to it.
- **The `/` acceptance criterion says "dev server"; I verified it under `pnpm build && pnpm start`.** `next dev` writes `AGENTS.md` at the repo root when it detects a coding agent (`node_modules/next/dist/server/lib/generate-agent-files.js`, dev-only via `syncAgentRulesForDev`). That would leave an untracked file in the chunk.
- **Removing the POC's dark token blocks also removed its `@custom-variant dark` line, which I restored.**
  - Without that line, the build compiled shadcn's `dark:` classes under `@media (prefers-color-scheme:dark)` (e.g. `.dark\:border-input`). So the copied Button/Badge, and every shadcn component added later, would switch styles in OS dark mode.
  - After restoring it: 0 `dark:` rules under the media query, and 17 under `:is(.dark *)` (`$S/dark-variant-check.txt`).
  - In Chrome emulating dark mode (`prefersDark: true`), the body stays `rgb(244,245,241)`, the button `rgb(23,60,81)` and the main panel `rgb(254,254,255)`.
- **Gate 3 has an extra positive needle, and gate 2 checks the traces.** A bare `grep outputFileTracingIncludes` would pass on a comment.

## Left alone

- **No `favicon.ico`.** The POC has one, but the plan doesn't ask for it.
- **`README.md` still reads `TBD`.** Not in this chunk's scope.
- **No status-badge or tone component.** The page maps tones to token classes inline. Chunk 04 owns the report badges and may want a shared `StatusBadge`; that would be a new file, not an edit to `shell/*`.
- **Teal is not tokenised.** `gcai-ui-notes.md` measures a teal pair, but T005 lists seven tones, and I added exactly those seven.

## Appendix: captured evidence

Generated by a script from the files in `$S/`; paths are shortened to `$S` and `<repo>`.

```text
### red-0 (import errors, no modules)
Error: Cannot find module './load' imported from <repo>/.worktrees/01-scaffold/src/lib/config/load.test.ts
Error: Cannot find module './route' imported from <repo>/.worktrees/01-scaffold/src/app/api/probe/stream/route.test.ts
 Test Files  2 failed (2)
      Tests  no tests

### red-1 (plausible-wrong stubs: unvalidated yaml.parse, unclamped Number(), empty route)
     × seconds=0 becomes 1 5ms
     × seconds=-3 becomes 1 1ms
     × seconds=500 becomes 120 0ms
     × seconds=abc becomes 5 0ms
     × seconds= becomes 5 1ms
     × seconds=null becomes 5 0ms
     × seconds=2.7 becomes 2 0ms
     × streams one tick line per second, then done 16ms
     × rejects a wrong type with an error naming the file and the field 9ms
     × names the nested field path, not just the top-level key 3ms
     × reports a YAML syntax error against the file 2ms
     × reports a missing file against the file 1ms
⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '' to match /^Config error in …/app\.yaml: appName: 
AssertionError: expected [Function] to throw an error
AssertionError: expected [Function] to throw error matching /^Config error in config\/a…/app\.yaml:  but got 'Flow sequence in block collection mus…'
AssertionError: expected [Function] to throw error matching /^Config error in confi…/missing\.yaml:  but got 'ENOENT: no such file or directory, op…'
AssertionError: expected +0 to be 1 // Object.is equality
AssertionError: expected -3 to be 1 // Object.is equality
AssertionError: expected 500 to be 120 // Object.is equality
AssertionError: expected NaN to be 5 // Object.is equality
AssertionError: expected +0 to be 5 // Object.is equality
AssertionError: expected 2.7 to be 2 // Object.is equality
AssertionError: expected '' to be 'tick 1\ndone\n' // Object.is equality
      Tests  12 failed | 5 passed (17)

### red-2 ({} stub)
     × returns the typed object for a valid file 7ms
     × reads config/ under process.cwd() by default, and the repo's app.yaml is valid 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected {} to deeply equal { appName: 'Reg Monitor', …(1) }
AssertionError: expected undefined to be 'Reg Monitor' // Object.is equality
      Tests  2 failed | 4 skipped (6)

### green
 Test Files  2 passed (2)
      Tests  17 passed (17)

### mut-1-noschema
     × rejects a wrong type with an error naming the file and the field 10ms
     × names the nested field path, not just the top-level key 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected '' to match /^Config error in …/app\.yaml: appName: 
AssertionError: expected [Function] to throw an error
      Tests  2 failed | 4 passed (6)
### mut-2-nofield
     × rejects a wrong type with an error naming the file and the field 10ms
     × names the nested field path, not just the top-level key 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 'Config error in config/app.yaml: Inva…' to match /^Config error in …/app\.yaml: appName: 
AssertionError: expected [Function] to throw error matching /^Config error in config\/neste…/nested\ but got 'Config error in config/nested/thing.y…'
      Tests  2 failed | 4 passed (6)
### mut-3-noclamp
     × seconds=500 becomes 120 5ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 500 to be 120 // Object.is equality
      Tests  1 failed | 10 passed (11)

### base gates
gate 1:  ERR_PNPM_NO_PKG_MANIFEST  No package.json found in $S/base
gate 2: FAIL: config/app.yaml missing
gate 3: FAIL: CLAUDE.md still claims Flue
gate 4: FAIL: no package.json — nothing to start

### gate 3 needles
needle A (Flue claim) on base:
11:(code) → Output (LLM) → `report.json`/`.md`. Harness: Flue (https://flueframework.com/),  
needle B (new harness line) on base count: 0
needle C (unmeasured) on base:
39:**Not yet measured — nothing is installed.** Chunk 01 of the bootstrap plan scaffolds the
finished tree: A=0 B=1 C=0

### canaries
canary-gate2-include: FAIL: config/app.yaml not traced into .next/server/app/api/probe/stream/route.js.nft.json 
canary-gate2-nokey: FAIL: next.config.ts declares no outputFileTracingIncludes 
canary-gate4: FAIL: probe did not finish: tick 1 tick 2 tick 3 fin 

### runtime config
meta (status time): before=200 0.008276 edited=200 0.006963 bad=500 0.011825
1c1
< config-max-window-days">7<!-- --> days<
---
> config-max-window-days">9<!-- --> days<
diff exit 1
Config error in config/app.yaml: appName: Invalid input: expected string, received number

### probe-90
meta: 200 90.124297
lines=91 ticks=90 last=done

### lint canary
  80:32  error  'x' is never reassigned. Use 'const' instead  prefer-const
  80:35  error  Unexpected any. Specify a different type      @typescript-eslint/no-explicit-any
✖ 2 problems (2 errors, 0 warnings)
  1 error and 0 warnings potentially fixable with the `--fix` option.

### dark variant
after fix: dark: utilities under prefers-color-scheme = 0
dark: utilities under .dark class = 17
remaining prefers-color-scheme rules (shadcn .shimmer only): 
before fix (built CSS at commit 5951ab2): '@media (prefers-color-scheme:dark){.dark\:border-input{border-color:var(--input)}' present

### bootstrap symlink branch
bootstrap: symlinked .env.local -> $S/bootrepo/.env.local

### final gates (after last code edit)
 Test Files  2 passed (2)
      Tests  17 passed (17)
gate 2 OK
gate 3 OK
gate 4 OK
ALL GATES PASSED

### fresh worktree (commit 82986a8)
bootstrap: wrote AI_GATEWAY_API_KEY to .env.local from <repo>/.env
      Tests  17 passed (17)
gate 2 OK
gate 3 OK
gate 4 OK
ALL GATES PASSED
```

## For the user: Vercel setup

1. **Environment variable:** set `AI_GATEWAY_API_KEY` to the AI Gateway key, for Production (and Preview if you use previews). The code never reads `VERCEL_AI_GATEWAY_API_KEY`.
2. **Project settings:** Framework preset **Next.js**, Root Directory **`/`** (the repository root), package manager **pnpm**. `packageManager: pnpm@9.15.4` is in `package.json`, and the install command is `pnpm install --frozen-lockfile`. Build command `pnpm build` (the preset default `next build` also works).
3. **Checks on the deployed URL:**
   - Open `https://<deploy>/`. It should show the cream shell with "Reg Monitor" in the sidebar and "Longest window: 7 days" in the panel. That value comes from `config/app.yaml`.
   - Run `curl -N "https://<deploy>/api/probe/stream?seconds=90"`. It must print `tick 1` … `tick 90`, one per second, then `done`. Locally under `pnpm start` this took 90.1 s. If it stops before `done`, the function limit is below 90 s, and the design's 300 s assumption (`maxDuration = 300`) does not hold on this plan.
