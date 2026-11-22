---
chunk: 01
title: Scaffold, theme, config loader and deploy probe
branch: feat/demo-build--scaffold
base: feat/plan--demo-build
execution: sequential
depends: []
file-limit-waived: true
file-limit-reason: "Bootstrap. The framework scaffold (package.json, tsconfig, next/eslint/vitest/postcss configs, components.json) is generated boilerplate. Hand-written files are about 10: globals.css, layout, page, probe route, config loader + test, shell primitives, project.md, CLAUDE.md, .gitignore."
---

# Chunk 01 — Scaffold, theme, config loader and deploy probe

## Context

`main` holds only `.claude/`, `CLAUDE.md`, `README.md` and `plans/`. This chunk creates the
app every later chunk builds on, and proves on Vercel the two runtime facts the design
depends on:

1. A route can read YAML config from the repo at request time.
2. A streamed response can stay open for about 90 s (the POC's worst-case run was 87 s)
   inside the deployed function.

**Amended 2026-11-22:** the hard stop is deferred. The user deploys once at the end of the
plan; this chunk proves the probe locally under `pnpm start` (gate 4), and the deployed-URL
check moves to the final PR's "Deferred to deploy" list.

The stack mirrors the POC on the `poc` branch (read it with
`git show poc:poc/package.json`): Next.js 16 App Router, React 19, TypeScript 5,
Tailwind 4, shadcn on Base UI, the `ai` SDK v7 with `@ai-sdk/gateway`, zod 4, yaml 2,
vitest, ESLint 9, pnpm 9. The app lives at the **repository root**, not under `poc/`.

The theme is GC AI's visual language, measured from their app; the tokens are in this
plan's `design/gcai-ui-notes.md`:

- Inter
- cream canvas `#f4f5f1`, white surface `#fefeff`
- navy primary `#173c51`, midnight text `#061118`
- stone `#ede2d8` for table headers and callouts
- navy-tinted borders
- radii 4 / 6 / 12 / 16 px
- paired status colours

## Acceptance Criteria

- Given a fresh clone of the plan branch with this chunk, When `pnpm install && pnpm build` runs,
  Then it succeeds with no network call to any model.
- Given the dev server, When `/` loads, Then it renders a placeholder inside the GC shell
  (cream sidebar with "Reg Monitor", floating white panel) using the GC AI tokens, and
  shows a value read from `config/app.yaml` on the server.
- Given `GET /api/probe/stream?seconds=90`, When called, Then it streams one line per
  second for 90 s and then a final `done` line. On Vercel this proves the function
  survives that long. The route declares `maxDuration = 300`.
- Given a malformed `config/app.yaml`, When the loader runs, Then it throws an error naming
  the file and the failing field (zod), not a generic parse error.
- Given `.claude/resources/project.md`, When this chunk merges, Then:
  - Stack, Commands, Convention Map and Layout describe what was actually installed.
  - The Flue/Pi harness line is replaced by "plain Vercel AI SDK + AI Gateway", with the
    reason.
  - The draft Principles are ratified with today's date.
- Given `CLAUDE.md`, When this chunk merges, Then its Pipeline line says
  "Harness: Vercel AI SDK (Flue/Pi deferred)". All its other sections are unchanged.

## What To Do

### Tasks

- [x] T001 — write failing test `src/lib/config/load.test.ts`. It loads a temp
  `app.yaml` fixture with a wrong type and asserts that the thrown message contains the
  file name and the field path. It fails today because no loader exists to reject the
  value. Also test that a valid file returns the typed object.
- [x] T002 — scaffold Next.js 16 at the repo root with pnpm, TypeScript, Tailwind 4,
  ESLint, App Router and the `src/` dir. Then run `pnpm dlx shadcn@latest init` (Base UI
  primitives). Add `vitest`, `zod`, `yaml`, `ai`, `@ai-sdk/gateway` and `lucide-react`.
  Pin exact versions and record them in `project.md` as read from `node_modules`, not
  from the manifest ranges.
- [x] T003 — create `src/lib/config/load.ts`: a server-only `readYaml(relPath, schema)`
  that reads `config/<relPath>` under `process.cwd()`, parses it with `yaml`, validates
  with zod, and throws `Config error in <file>: <path>: <message>`.
  - Reuse: the POC's `yamlFile` in `git show poc:poc/src/lib/config.ts`. Port its shape,
    not its prompt-set AsyncLocalStorage, which chunk 02 handles.
  - It must work on Vercel. Add `outputFileTracingIncludes` for `config/**` in
    `next.config.ts`, so the YAML ships inside the function bundle.
- [x] T004 — create `config/app.yaml` (`appName: Reg Monitor`, `maxWindowDays: 7`) and
  its zod schema in `src/lib/config/schemas.ts`. Later chunks add the POC's files beside it.
- [x] T005 — edit `src/app/globals.css`: define the GC AI tokens as CSS variables in
  shadcn's variable names. Use these values:

  | Variable | Value |
  |---|---|
  | `--background` | `#f4f5f1` |
  | `--card` | `#fefeff` |
  | `--foreground` | `#061118` |
  | `--primary` | `#173c51` |
  | `--primary-foreground` | `#f4f5f1` |
  | `--muted` / `--secondary` | `#ede2d8` |
  | `--muted-foreground` | `#494849` |
  | `--border` | `rgba(21,57,78,0.14)` |
  | `--ring` | `#7ec5e6` |
  | `--radius` | `0.375rem` |

  Also add status pairs (`--status-{red,orange,yellow,green,blue,purple,neutral}-{surface,fg}`),
  shadow tokens and the heading colour `#173c51`. Load Inter via `next/font/google`.
  Light theme only, since GC AI ships light.
- [x] T006 [P] — create `src/components/shell/AppShell.tsx`. It takes `sidebar`, `children`
  and an optional `aside` and renders the three-pane layout from
  `design/HiReport.dc.html`:
  - a cream sidebar 220–264 px wide;
  - a white panel with 8 px margin, 12 px radius and a `shadow-xs`;
  - an optional right panel;
  - at narrow widths, the panes wrap into a column and the page never scrolls sideways.

  Also create `src/components/shell/SidebarNav.tsx` with the wordmark, nav item (icon +
  label, active state) and section label ("RECENT RUNS" style), styled from the hi-fi.
  This chunk owns these shell files; later chunks compose them and must not edit them.
- [x] T007 — edit `src/app/page.tsx`: a placeholder in `AppShell` that shows `appName` read
  server-side via `readYaml`, a navy primary button, a status badge from each tone, and a
  link to the probe.
- [x] T008 — create `src/app/api/probe/stream/route.ts`:
  - Node runtime, `export const maxDuration = 300` (Vercel Hobby's Fluid compute max is
    300 s; the POC's worst-case run was 87 s).
  - Returns a `ReadableStream` that writes `tick N` once a second for `seconds` (default
    5, clamped 1–120), then `done`.
  - Add a test for the clamp: inputs `0`, `500` and `abc` all become a valid value.
- [x] T009 — edit `.gitignore`: keep `.worktrees/` and the existing entries; add `.next/`,
  `node_modules/`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel` and `.env*.local`.
- [x] T010 — edit `.claude/resources/project.md`:
  - **Stack:** the measured versions, plus "Harness: plain Vercel AI SDK + AI Gateway
    (Flue/Pi deferred; no sandbox/shell needed)".
  - **Commands:** fill every row with an exact, run-verified command. Install
    `pnpm install --frozen-lockfile`. Bootstrap: `pnpm install --frozen-lockfile` plus
    symlinking `.env.local` from the main checkout if present. Type check `pnpm typecheck`
    (add `"typecheck": "tsc --noEmit"`). Lint `pnpm lint`. Unit tests `pnpm test`
    (`vitest run`). Build `pnpm build`. "Run a monitor pass" and "Run the evals": `N/A`
    until a later chunk adds them.
  - **Principles:** change "Draft, 2026-11-21" to "Ratified 2026-11-22"; the text is
    unchanged.
  - **Convention Map:** add rows for `src/lib/**/*.ts` (pure logic needs a colocated
    `*.test.ts`; no React imports), `src/app/api/**/route.ts` (server-only; validate
    request input with zod; no secrets in responses), `src/components/**/*.tsx` (uses
    theme tokens, never raw hex; interactive elements are real `button`/`a`/`input`) and
    `config/**/*.yaml` (has a zod schema; loaded only through `readYaml`). Cite
    `.claude/resources/bibles/swe/testing.md` where it applies, `—` elsewhere.
  - **Conventions:** the Gateway key's env-var name. Default to `AI_GATEWAY_API_KEY`, which
    the AI SDK reads natively; the POC used `VERCEL_AI_GATEWAY_API_KEY`. State the chosen
    name, and that it is the variable to set in Vercel.
  - **Layout:** the actual tree.
- [x] T011 — edit `CLAUDE.md`: replace "Harness: Flue (https://flueframework.com/), built
  on Pi." with "Harness: plain Vercel AI SDK + AI Gateway (Flue/Pi deferred)". Change
  nothing else.

You may use `create-next-app` and then prune, or write the configs by hand. Explain your
choice in the completion report.

Verify the Next 16, shadcn and AI SDK v7 API surfaces against the installed packages
before relying on them; docs and reality diverge.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `load.test.ts` › rejects wrong type with file + field | loader error contract | a stub that returns `yaml.parse` output unvalidated returns the bad value instead of throwing |
| `load.test.ts` › returns typed object | happy path | a stub returning `{}` fails the `appName` equality |
| `route.test.ts` › clamps `seconds` | probe guard | an unclamped stub returns 500 for input `500` |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| zod validation | `appName: 42` in a temp file | `load.test.ts` |
| seconds clamp | `0`, `500`, `abc` | `src/app/api/probe/stream/route.test.ts` |

## Reuse Audit

Reuse: the POC's YAML+zod loader pattern from `poc:poc/src/lib/config.ts` (`yamlFile`) and
its shadcn setup in `poc:poc/components.json`. New: the shell primitives and the probe
route; none exist on `main`.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Sections this chunk fills; how each fact must be measured |
| `.claude/resources/bibles/swe/testing.md` | Assert the resolved value, not the input; fixtures must be real |
| `plans/2026-11-22-demo-build/design/gcai-ui-notes.md` | The measured GC AI tokens and component specs |
| `plans/2026-11-22-demo-build/design/HiReport.dc.html` | The shell layout to reproduce (sidebar, floating panel, right panel) |
| `git show poc:poc/package.json` | The versions the POC ran on |
| `git show poc:poc/src/lib/config.ts` | The loader pattern to port |

## External Dependencies

- Next.js 16, Tailwind 4, shadcn CLI (Base UI) — scaffold and theming
- `ai` v7 + `@ai-sdk/gateway` — installed only; first used in chunk 02
- Vercel — the user wires up deploys after merge; check the `maxDuration` and
  `outputFileTracingIncludes` behaviour against current docs

## Verification Gates

Write the gates to `plans/2026-11-22-demo-build/01-scaffold/gates.sh` and commit them.

```bash
set -e
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm typecheck

# Gate 2: config ships with the server bundle
test -f config/app.yaml
grep -q "outputFileTracingIncludes" next.config.ts

# Gate 3: no Flue claim left in the harness line
if grep -q "Harness: Flue" CLAUDE.md; then echo "FAIL: CLAUDE.md still claims Flue" >&2; exit 1; fi
if grep -qi "Not yet measured" .claude/resources/project.md; then echo "FAIL: Stack still unmeasured" >&2; exit 1; fi

# Gate 4: the probe streams (local)
pnpm start -p 3101 & SRV=$!; sleep 4
out=$(curl -sN "http://localhost:3101/api/probe/stream?seconds=3")
kill $SRV
echo "$out" | grep -q "done" || { echo "FAIL: probe did not finish" >&2; exit 1; }
```

Run each gate against the base commit (the `feat/plan--demo-build` tip this chunk was cut from) before your work and against the finished tree. Record the
command, both exit statuses and the error text. Gates 1 and 4 fail on the base because there
is no `package.json`. Make sure that's the error you see: if both runs show the same text,
the gate is broken, not the tree.

## Deliverables

- [x] `completion-report.md` in this directory, committed, written from
      `.claude/resources/templates/completion-report.md`
- [x] The completion report ends with a **"For the user: Vercel setup"** section:
  - the env var name to set;
  - framework preset Next.js, root `/`, pnpm;
  - two checks on the deployed URL: open `/`, and
    `curl -N https://<deploy>/api/probe/stream?seconds=90` must reach `done`.

## Artifacts Checklist

- ☑ New tests for new behavior
- — Existing tests updated: none exist on the base
- ☑ Docs / conventions updated: `project.md`, `CLAUDE.md`
- — Generated code: n/a
- ☑ `.claude/resources/project.md` updated (Stack, Commands, Principles, Convention Map, Conventions, Layout)
