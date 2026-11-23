---
id: resources/project
description: The living record of what this project is — stack, commands, principles, conventions. Every phase of the loop reads it; plans keep it current.
---

# Project Facts

**This file is the single source of truth for what the project looks like.** Every phase of
the loop reads it, and nothing else in `.claude/` names a language, a framework, or a
command — they all defer here. Swap this file and the same framework drives a different
stack unchanged.

Keep it short and true. Delete what does not apply rather than leaving a placeholder that
reads as a fact.

## How this file stays current

It is written and maintained by the loop, not filled in once and left:

| When | Who | What changes |
| ---- | --- | ------------ |
| Before the first plan, if the stack is already known | You | Stack, Commands, Principles |
| Chunk 01 of a bootstrap plan, if it isn't | That chunk, as its deliverable | Stack, Commands, Principles, Convention Map, Layout |
| During a chunk that changes an architecture fact | The implementer, **in the same chunk** | Whichever section the change made false |
| At each wave boundary | The lead | Anything the merged wave invalidated |
| At delivery | `/plan:complete` Part 2 | Conventions learned, gotchas, promoted tribal knowledge |

**An architecture fact changed by a chunk is updated by that chunk.** A new dependency, a
new command, a new kind of file, a moved directory, a new principle — these are not
delivery-time cleanup. A stale Convention Map is read by `generate-chunk-rubric` when it
builds the *next* chunk's rubric, so staleness here compounds into unreviewed work.

**Every claim here is measured, never assumed.** Read versions off what is installed on
disk, and run each command before writing it into the table.
`.claude/resources/prompts/evidence.md` binds this file as much as any plan.

## Stack

Measured 2026-11-22 by chunk 01 of `2026-11-22-demo-build`: each version below was read from
`node_modules/<pkg>/package.json`, and `package.json` pins every one exactly (no ranges). The set
matches the POC's lockfile (`git show poc:poc/pnpm-lock.yaml`). Chunk 02 added `date-fns` the same way
(read from `node_modules/date-fns/package.json`, same version as the POC's lockfile), chunk 03 added `p-limit`
(read from `node_modules/p-limit/package.json`; the POC's lockfile resolves `^7.3.3` to 7.3.3), and chunk 04 added the
dev dependency `fake-indexeddb` (read from `node_modules/fake-indexeddb/package.json`).

| Layer | Package | Version |
| ----- | ------- | ------- |
| Runtime / package manager | Node (local) · pnpm (`packageManager`) | 24.13.0 · 9.15.4 |
| Framework | `next` (App Router, `src/`, Turbopack build) | 16.4.6 |
| UI | `react` · `react-dom` | 19.3.0 · 19.3.0 |
| Language | `typescript` | 5.9.3 |
| Styling | `tailwindcss` · `@tailwindcss/turbopack` · `tw-animate-css` | 4.3.3 · 4.3.3 · 1.4.0 |
| Components | `shadcn` (style `base-nova`) · `@base-ui/react` · `class-variance-authority` · `cn` · `lucide-react` | 4.23.0 · 1.9.0 · 0.7.1 · 0.5.2 · 1.77.0 |
| shadcn components in `src/components/ui/` | button, badge (chunk 01); sheet, table, collapsible, tooltip, chart (chunk 08); tabs (chunk 04); select, popover, input, textarea (chunk 05) — all via `pnpm exec shadcn add`, shadcn 4.23.0 | — |
| Model calls | `ai` · `@ai-sdk/gateway` | 7.0.179 · 4.0.152 |
| Config | `yaml` · `zod` | 2.9.1 · 4.6.7 |
| Dates (tiering, date verification) | `date-fns` | 4.4.0 |
| Concurrency limits (pipeline stages) | `p-limit` | 7.3.3 |
| Charts (eval view) | `recharts` (pinned; same version as the POC's `package.json`) | 3.8.0 |
| Trace list virtualization (eval view) | `@tanstack/react-virtual` (pinned; pulls `@tanstack/virtual-core`) | 3.14.26 |
| Server marker | `server-only` | 0.0.1 |
| Tests / lint | `vitest` · `eslint` · `eslint-config-next` | 5.1.1 · 9.39.5 · 16.4.6 |
| IndexedDB in tests (dev only) | `fake-indexeddb` | 6.2.8 |

- **Harness: plain Vercel AI SDK + AI Gateway (Flue/Pi deferred; no sandbox/shell needed).**
  The RFC named Flue, built on Pi. The POC pipeline already runs on the AI SDK, Flue/Pi would
  need its own server, and this workflow needs no sandbox, shell or code execution
  (`plans/2026-11-22-demo-build/ORCHESTRATOR.md`, Design Decision 1). Deferred, not rejected.
- **Hosting:** Vercel, Next.js preset, pnpm, repository root. Route functions may run up to 300 s
  on Hobby with Fluid compute (ORCHESTRATOR Design Decision 7); unverified until the first deploy.
- **Primary data source:** the Federal Register API. Web search may supply leads, but only items
  that resolve to a primary-source record are surfaced.

## Commands

The verification gates run these. Use the exact invocation, not a description of it. Mark
anything that does not exist yet as `N/A` — a gate skips an `N/A` command rather than
inventing one.

**Bootstrap** is what makes a newly created worktree able to run the gates: installing or
symlinking dependencies, linking gitignored files the app needs (`.env` and friends), and
any codegen. It runs once per worktree, before an implementer is dispatched into it. Get
this wrong and every chunk's first gate run fails for reasons unrelated to its work.

All commands run from the repository root.

| Gate | Command |
| ---- | ------- |
| Install | `pnpm install --frozen-lockfile` |
| Bootstrap a fresh worktree | `bash scripts/bootstrap.sh` — runs `pnpm install --frozen-lockfile`, then provides `.env.local`: symlinks the main checkout's `.env.local` if it exists, else writes `AI_GATEWAY_API_KEY` from the main checkout's `.env` (renaming the POC's `VERCEL_AI_GATEWAY_API_KEY`). Never prints the key. |
| Type check | `pnpm typecheck` (`tsc --noEmit`) |
| Lint | `pnpm lint` (`eslint`) |
| Unit tests | `pnpm test` (`vitest run`; discovers `src/**/*.test.ts`; `pool: "forks"`, because some tests call `process.chdir`, which worker threads reject) |
| Build | `pnpm build` (`next build`) |
| Run locally (dev server) | `pnpm dev` (`next dev`, port 3000; `-p <port>` to change) — after `pnpm install` and a `.env.local` with `AI_GATEWAY_API_KEY` (in a worktree, `bash scripts/bootstrap.sh` provides both). Keyless (`AI_GATEWAY_API_KEY= pnpm dev`) `/runs/new`, `/evals` and `/examples/<id>` load; requests that call a model fail. |
| Run a monitor pass (**spends real Gateway credit, ~$0.24 a run**, `setups.yaml` estUsd of the live setup; needs `pnpm build && pnpm start`) | `curl -sN -X POST localhost:3000/api/run -H 'content-type: application/json' -d '{"profileId":"ledgerly","windowStart":"2026-11-02","windowEnd":"2026-11-06"}'` — streams NDJSON `RunEvent`s ending in `run.done` or `run.failed`. With `AI_GATEWAY_API_KEY=` set empty on `pnpm start` it costs nothing and ends in `run.failed` at the ranking step. |
| Run the evals | N/A |
| Rebuild the eval bundle (needs the `poc` branch; writes `public/evals/`) | `bash scripts/build-eval-bundle.sh && bash scripts/verify-eval-bundle.sh` |
| Verify the shipped eval bundle | `bash scripts/verify-eval-bundle.sh` |
| Rebuild the GC's example runs (reads `public/evals/user-view/`; writes `public/examples/`; runs under the `poc-src` checkout's tsx) | `bash scripts/build-examples.sh` |

Local production server for runtime checks: `pnpm start -p <port>` after `pnpm build`. Use ports
3101 and up, and stop the server afterwards.

## Principles

The project's constitution: the rules a plan is checked against before it's approved, and
that a reviewer can cite. Keep the list short — five or six you would actually block a PR
over. Each one is a rule, not an aspiration, and each says what it forbids and what a
violation looks like.

Amend deliberately: a principle changed mid-plan invalidates the reasoning of every chunk
approved under it, so record the date and the reason when one changes, and note which
version each plan was checked against.

**Ratified 2026-11-22** (plan `2026-11-22-demo-build`, chunk 01), unchanged from the draft of
2026-11-21 derived from the Regulatory Monitoring RFC. Each restates an RFC requirement.

1. **Tier is assigned by code, never by a model.** A deadline under 90 days is Critical.
   Violation: a tier value produced by, or overridable by, an LLM output. Same input, same
   tier, every run.
2. **Only primary-source records are surfaced.** Web search may supply leads; an item that
   does not resolve to a primary-source record never reaches the output. Violation: an
   action item whose source link is not the official record.
3. **Every surfaced date and citation matches the primary source.** Each relevant document
   is re-fetched from its primary source, and any date or citation that does not match is
   dropped. Violation: a date or citation in the output that was not checked against the
   re-fetched record.
4. **No paid APIs, no state-level sources.** Violation: a paid fetch, or a state-level
   source, anywhere in the pipeline. (Also out of scope: scheduled runs, internal doc
   mapping.)

A chunk that violates a principle needs an explicit justification in the plan's Design
Decisions, or it doesn't ship. "This was easier" is not a justification.

## Convention Map

What each kind of file must satisfy. The `generate-chunk-rubric` skill reads this to build
each chunk's review checks, and the gates listed here are what a chunk touching that area
runs. A path matching several rows collects all of their checks.

Fill it in as the project grows — an empty map means every rubric is only as good as what
the planner remembered that day, and `generate-chunk-rubric` will say so out loud rather
than emit a thin rubric silently.

Globs are written relative to the repository root.

**The `Doc` column points at a bible leaf page** under `.claude/resources/bibles/` — the
page carrying the rule, found by following that bible's `decision-tree.md`. Never cite the
decision-tree itself; a reviewer handed a routing table grades from memory. Use `—` when no
page applies, and the review check ships without a citation rather than with an invented
one.

| Files | Gates | Review checks | Doc |
| ----- | ----- | ------------- | --- |
| `src/lib/**/*.ts` | `pnpm test`, `pnpm lint`, `pnpm typecheck` | Pure logic has a colocated `*.test.ts` that asserts what a caller receives. No React imports. Modules that touch the filesystem or secrets import `server-only`. | `.claude/resources/bibles/swe/testing.md` |
| `src/app/api/**/route.ts` | `pnpm test`, `pnpm build`, `pnpm typecheck` | Server-only. Request input (query, body) is parsed with zod before use. No secrets or stack traces in responses. Exports only HTTP handlers and segment config (`runtime`, `maxDuration`); helpers live in a sibling module with their own test. | `.claude/resources/bibles/swe/testing.md` |
| `src/components/**/*.tsx` | `pnpm lint`, `pnpm build` | Colours, radii and shadows come from theme tokens (`bg-primary`, `text-heading`, `bg-status-*-surface`, `rounded-lg`, `shadow-xs`), never raw hex or `rgba()`. Interactive elements are real `button` / `a` / `input`. Nothing overflows sideways at 390 px. `src/components/shell/*` is owned by chunk 01: compose it, don't edit it. | — |
| `src/lib/pipeline/**/*.ts`, `src/lib/fr.ts`, `src/lib/gateway.ts` | `pnpm test` (incl. `replay.test.ts`), `bash plans/2026-11-22-demo-build/03-pipeline/mutations.sh` | Decision expressions match `poc:poc/src/lib/pipeline/` (any difference is listed as intentional). Every public event is built from named fields, never by spreading an internal object. Every external call goes through `withRetry`; no SDK-level retries. Tests stub models with `installModels` (`src/lib/pipeline/__fixtures__/harness.ts`) and stub `fetch`. | `.claude/resources/bibles/swe/patterns/migration-verification.md` |
| `src/lib/runs/**/*.ts`, `src/components/gc/**/*.tsx`, `src/app/examples/**` | `pnpm test`, `bash plans/2026-11-22-demo-build/06-edge-states/gates.sh` (runs 05's, then 04's `gates.sh` first) | Browser code: no import of `@/lib/config`, a `server-only` module or a Node built-in, and only `import type { … }` from `pipeline/events` (Gate 4). Never reads the eval bundle: no `lib/evals`/`components/evals` import, no `/evals` URL (06 Gate 4). Screen state comes from `reduceEvents` (then `applyConfirmed`); sentences and counts shown to the GC are derived in `src/lib/runs/report.ts` / `memo.ts` with tests, not inside components. A new IndexedDB object store bumps the `reg-monitor` version and creates only the stores the old version lacks. | `.claude/resources/bibles/swe/testing.md` |
| `config/**/*.yaml` | `pnpm test`, `pnpm build` | Has a zod schema (`src/lib/config/schemas.ts` or the owning module's schema file). Read only through `readYaml`. A test loads the real file and asserts the parsed value. | `.claude/resources/bibles/swe/testing.md` |
| `src/app/evals/**`, `src/components/evals/**`, `config/eval-story.yaml` | `pnpm test`, `pnpm build`, `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh` | No metric number is typed in a component, page or the story YAML: numbers come from `index.json` via `loader.ts`, prose numbers via `{{placeholders}}` (`story.ts`) or verbatim quotes (`resolveQuote`). Every number shown names its split, runs and suite (tooltip or footnote). Server pages read YAML only; no server module reads `public/evals`. Tests of eval view logic run against the shipped bundle (`__fixtures__/shipped.ts`), not hand-made suites. | `.claude/resources/bibles/swe/testing.md` |
| `public/examples/**`, `scripts/build-examples.*`, `src/lib/pipeline/recorded*.ts`, `src/lib/runs/recorded-view.ts` | `pnpm test`, `bash plans/2026-11-22-demo-build/06-edge-states/gates.sh` | `public/examples/` is generated by `scripts/build-examples.sh`, never hand-edited: the gate rebuilds it and requires a clean `git status`, and scans every file for internal names. Every emitted event passes `assertPublic`. A recorded run is mapped once: `recordedView` (`recorded-view.ts`) then `recordedEvents` (`pipeline/recorded-events.ts`, browser-safe). The GC examples (`recorded.ts`) and the reviewer report both use that pair rather than reading record fields themselves. | `.claude/resources/bibles/swe/testing.md` |
| `public/evals/**`, `scripts/*eval*`, `scripts/poc-src.sh` | `bash scripts/verify-eval-bundle.sh`, `pnpm build` | `public/evals/` is generated: a diff there comes from re-running `scripts/build-eval-bundle.sh`, never from a hand edit, and the verify gate passes on the result. No `poc/` path is committed. No route or server module imports `public/evals` (it ships as static files). POC grading code runs unmodified from the detached `poc-src` checkout. | — |

**Anything under `.claude/` is governed by the prompt-engineering bible** whether or not a
row above matches it. `generate-chunk-rubric` adds those citations on its own — see that
skill's "When the chunk touches `.claude/` itself".

## Conventions

Things an implementing agent would otherwise get wrong. Add to this as they surface — a
convention learned during execution belongs here in the same change that learned it, not in
a follow-up.

- **Gateway key: `AI_GATEWAY_API_KEY`.** `@ai-sdk/gateway@4.0.152` reads this name on its own
  (`node_modules/@ai-sdk/gateway/dist/index.js`, `environmentVariableName: "AI_GATEWAY_API_KEY"`),
  so no code passes the key explicitly. Set this variable in Vercel (Project → Settings →
  Environment Variables). The POC read `VERCEL_AI_GATEWAY_API_KEY` from `../.env`; nothing here
  reads that name except `scripts/bootstrap.sh`, which renames it.
- **Config is read only through `readYaml(relPath, schema)`** (`src/lib/config/load.ts`). It reads
  `config/<relPath>` under `process.cwd()` at call time and throws
  `Config error in config/<relPath>: <field.path>: <message>`. Keep the default path statically
  scoped to `config/`: a computed directory makes Turbopack trace the whole project (build warning
  "Dynamic filesystem access"). `next.config.ts` adds `config/**` to every route's trace with
  `outputFileTracingIncludes`; check `.next/server/app/**/*.nft.json` when adding a config file.
  The JSON data under `config/evalsets/` (frozen weeks, answer keys) is not YAML: read it only through
  `frozenWeek()` / `loadKey()` in `src/lib/config.ts`.
- **Config is byte-identical to `poc:poc/config/` on the decision path — change it only with a
  recorded reason.** The recorded eval numbers describe the POC's pipeline, so they describe the demo
  only while it runs the same inputs. Decision path: `prompts.yaml`, `prompt-sets/`, `pipeline.yaml`,
  `setups.yaml`, `judges.yaml`, `experiment.yaml`, `companies/` and `evalsets/`, plus
  `src/lib/{tier,verify,prompts}.ts`. The one recorded difference is `use: eval` in
  `companies/brightside.yaml` (chunk 02). Check with
  `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh`, which diffs every one against the `poc`
  branch. The pipeline (`src/lib/pipeline/{run,stages,excerpts}.ts`) is on the decision path too, but carries
  intentional non-decision changes, so it is checked by behaviour instead: `src/lib/pipeline/replay.test.ts`
  replays a recorded POC run (`__fixtures__/replay-06*`) and requires every decision, prompt, tier, owner and item
  to match.
- **The browser imports only types from `src/lib/pipeline/events.ts`** (`import type { … }`, never a value): a value
  import would bundle `STEP_LABELS`, whose keys and patterns name internal components. Step labels reach the browser in
  `run.start.steps` and `step.start.label`. Gate 4 of `plans/2026-11-22-demo-build/04-run-and-report/gates.sh` checks
  `src/lib/runs`, `src/components/gc` and `src/app` (routes under `src/app/api` excepted).
- **Live runs live in the browser.** `src/lib/runs/reader.ts` (`createRunner`) owns each run's stream, not a component,
  so a run started on one page keeps streaming after navigation; `src/components/gc/useRun.ts` holds one runner per page
  load. Every event is appended to the IndexedDB record (`src/lib/runs/store.ts`: database `reg-monitor`, store `runs`,
  record `{id, createdAt, request, events, status, result, profile, confirmed?}`; version 2 (chunk 05) adds store `profiles`, record
  `SavedProfile {key, savedAt, profile}`, the GC's own profiles keyed apart from `profile.id` because an edited preset
  keeps the preset's id; version 3 (chunk 11) adds store `chats`, record `StoredChat {id, savedAt, turns}` keyed
  `live:<runId>` or `example:<exampleId>`, because an example has no run record). A record still `running` that this page isn't
  streaming was cut off by a reload, so it is marked `interrupted`: it can be retried, never resumed. The record never
  holds the server's `RunConfig` or decisions (model ids, internal scores). Screen state always comes from
  `reduceEvents(run.events)` (`src/lib/runs/reduce.ts`), live or reopened.
- **A held-back item enters the report only when the GC confirms it, and never gets a tier.** `run.done.dropped` items
  (relevant, but a date or citation failed the re-fetch) render above the table (`HeldBack`). "Add after checking" stores
  the document number in `StoredRun.confirmed` through `runner.confirmHeldBack` (not `store.save`: the runner's in-page
  copy would go stale). `applyConfirmed(reduceEvents(events), confirmed, profile.generalCounsel)` moves it to
  `view.checkedByYou`: a `CheckedRow` (no tier, no deadline, owner the GC, link `frDocUrl(n)`), rendered "Not tiered" ·
  "Confirmed by you". The run's events are never edited, there is no `RunEvent` for it, and a record without `confirmed`
  reads as none confirmed (no IndexedDB version bump). Report sentences stop saying "below matched the Federal Register"
  once such a row is in the table.
- **GC pages read the example runs only from `public/examples/`, never `public/evals/`.** `scripts/build-examples.sh`
  projects each finished run in `public/evals/user-view/` (`projectRecordedRun`, `src/lib/pipeline/recorded.ts`,
  server-only) into public `RunEvent`s plus the run's profile, so `/examples/[id]` renders them with `reduceEvents` +
  `ReportView` like a live run. Rebuild it whenever the eval bundle or a step label changes, and commit the result.
  The reviewer's run report (`/evals/reports/[suiteId]/[runId]`) reads `public/evals` through `loadRecordedRun`, maps it
  with the same `recordedView` + `recordedEvents`, and renders chunk 04's `ReportView` with `readOnly` (no draft emails,
  no memo); its step labels add the internal stage id (`reviewerLabel`).
- **GC-facing text comes only from `STEP_LABELS` and item fields; `assertPublic` guards every event**
  (`src/lib/pipeline/events.ts`). `RunCtx.emit` runs it on each event, so a leak fails the run instead of reaching
  the browser. Build events from named fields: a `FilterDecision` carries the internal relevance score, and stage
  ids contain the internal model's name. A failure's text is a fixed message (`TIMEOUT_MESSAGE`,
  `UNEXPECTED_MESSAGE`), never `error.message`: SDK errors name model ids. Internal detail goes to the server log
  (`[Pipeline]` prefix; the full internal trace with `DEBUG_PIPELINE=1`).
- **Every external call is tried at most 3 times, through `withRetry`** (`src/lib/pipeline/retry.ts`: 2 s then
  4 s). Model calls retry in `RunCtx` (and in `src/app/api/suggest-areas/suggest.ts` and `src/app/api/followup/followup.ts`,
  which take the policy as a parameter so tests pass `{attempts: 3, delaysMs: [0, 0]}`). `streamText` (`ai` 7.0.179) returns
  before the request is made and puts failures inside its stream, so `withRetry` around the call alone never retries:
  `followup.ts` awaits the first text part inside it. Federal Register and govinfo fetches retry in `fr.ts` (thrown fetch, 5xx,
  429 only) and report to the run through `withRetryScope`. The AI SDK's own retries are off (`maxRetries: 0`):
  setting them back would multiply the attempts past 3.
- **Tests never call a model or the network.** `installModels` (`src/lib/pipeline/__fixtures__/harness.ts`)
  swaps the gateway for the AI SDK's mock models through `setModelsForTests`; tests stub `fetch`. It stubs only `doGenerate`;
  streamed calls use `stubStreamingModel` (`src/app/api/followup/__fixtures__/stream-model.ts`, a mock `doStream`). A refused
  request there is a retryable `APICallError`: a plain `Error` is never retried by the SDK, so it can't show `maxRetries: 0` works. `fr.ts` caches
  listings and texts in memory per module, so a test that runs the pipeline twice uses `vi.resetModules()` or
  distinct windows and document numbers.
- **`configHash()` covers every `.yaml` under `config/` except `evalsets/`**, chunk 01's `app.yaml`
  included, so adding or editing any config YAML changes the hash stamped on a run. The POC's final
  config hashes to `9a0f857741`; this repo's config hashed to `a113914a72` at chunk 02 (brightside's
  `use: eval` plus `app.yaml`), to `242bd91ef7` at chunk 08 (`eval-story.yaml` plus `evalTargets` in
  `app.yaml`), to `36599b6308` at chunk 05 (`defaultPreset` and `suggestAreas` in `app.yaml`), to `bc2b5bdec1` at chunk 10
  (the `models` section of `eval-story.yaml`; measured on chunk 10's branch, so a later merge that also edits config moves it
  again) and to `179451fef1` at chunk 11 (`followUp` in `app.yaml`). Compare hashes only between runs of this repo.
- **No filesystem writes in server code.** Vercel functions can't persist files, so anything a
  server module needs to remember lives in memory for the life of the process (see the HTTP cache in
  `src/lib/fr.ts`), and runs persist in the browser. Gate:
  `bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh`. It scans every non-test
  `.ts`/`.tsx` under `src/` for calls to any fs API that creates, changes or deletes a file or folder
  (`writeFile`, `mkdir`, `rm`, `rename`, `copyFile`, `createWriteStream`, …). Tests may write temp
  fixtures under `os.tmpdir()`.
- **UI-only settings live in `config/app.yaml`, never in a decision-path file** — UI-only prompts and model ids included
  (`suggestAreas: {model, prompt}`, chunk 05; `followUp: {model, system, suggestions, maxTurns, maxMessageChars,
  maxContextChars, maxAnswerTokens}`, chunk 11). `prompts.yaml` and `experiment.yaml` must stay byte-identical to the POC.
  Each key gets its own slice schema in `src/lib/config/schemas.ts` (`NewRunConfigSchema`, `SuggestAreasConfigSchema`,
  `FollowUpConfigSchema`, and `FollowUpSuggestionsSchema` for the pages), so a page reads only the slice it needs; a page
  passes the browser single values as props, never a parsed slice that names a model. Keep each `model:` at two spaces:
  chunk 05's and 11's gates read every `^  model:` line of `app.yaml` as a needle.
- **The follow-up chat answers from the report the browser sends, and the server checks it twice.** The browser builds
  the context with `buildFollowUpContext(view, profile)` (`src/lib/runs/followup-context.ts`): named fields copied from
  the `applyConfirmed` view, never a spread, so verification quotes and internal scores stay out. `/api/followup` re-parses
  it with a strict zod schema (an unknown field is a 400), then runs `assertPublicText` on it minus `profile` (the GC's
  own words: "Google/Apple Pay" matches the vendor pattern, and the profile is in no public event) and on the configured
  system prompt, and enforces the `followUp` caps, all before resolving the model. The answer streams as NDJSON
  (`FollowUpLine`): `text` pieces, then exactly one `done` or `failed` line, because the SDK's text stream just stops on
  an error. `done` only when the stream's `finish` part says `stop`; no finish (dropped upstream), `length` (cut at
  `maxAnswerTokens`, its own sentence) or any other reason is `failed`. The browser saves only a pair that ended in `done`. The chat mounts through `ReportView`'s `followUp` prop only when the run's status
  is `done` (`followUpChatId`), in `RunView` and `ExampleView`, never on the reviewer's `/evals/reports/**`.
- **The run window is checked by one function on both sides.** `validateWindow` / `windowDays` (inclusive count) in
  `src/lib/runs/weeks.ts` serve the new-run screen and `src/app/api/run/request.ts`. "Today" for the week buttons is
  New York's date (`todayInNewYork`), computed on the server and passed as a prop, so server and browser render the
  same weeks.
- **Server-component props reach the HTML as an escaped RSC payload** (`\"ledgerly\"`, measured on `/runs/new`), so a
  gate grepping a page for a quoted id must accept both quotings for presence, and use a bare word for absence.
- **`@/lib/config` is the module `src/lib/config.ts`; `@/lib/config/load` and
  `@/lib/config/schemas` are files in the `src/lib/config/` folder.** A file beats a folder in
  module resolution, and the folder has no `index.ts`. Don't add one: it would make `@/lib/config`
  ambiguous to a reader.
- **Pages that read config must render per request.** Call `await connection()` (from
  `next/server`) before reading; otherwise the page is prerendered at build and never re-reads the
  YAML. Segment `export const dynamic` is not used (removed when Cache Components is on in Next 16).
- **Theme tokens live only in `src/app/globals.css`**, in shadcn's variable names plus `--heading`,
  `--caption`, `--status-{red,orange,yellow,green,blue,purple,neutral}-{surface,fg}` and the
  `--elev-*` shadows. GC AI's radius scale is set explicitly: `rounded-sm` 4 px, `rounded-md` 6 px
  (buttons, nav rows), `rounded-lg` 12 px (panels), `rounded-xl` 16 px. Light theme only:
  `@custom-variant dark (&:is(.dark *))` keeps shadcn's `dark:` classes inert (no `.dark` is ever
  set). Without it Tailwind 4 applies them under `prefers-color-scheme: dark`.
- **shadcn components** are added with `pnpm exec shadcn add <name>` (`components.json`, style
  `base-nova`, Base UI primitives). `src/components/ui/button.tsx` is adjusted to GC AI's 34 px /
  6 px primary button; re-adding it with `--overwrite` would undo that.
- **`server-only` under vitest:** `vitest.config.mts` aliases it to its empty module, because the
  package throws outside Next's react-server build. Don't remove the alias.
- **Don't rely on Next's generated global types** (`LayoutProps`, `PageProps`): they exist only
  after `next build`/`next dev`, so `pnpm typecheck` on a fresh tree fails. Type props explicitly.
- **`AGENTS.md` is hand-written and committed; `agentRules: false` keeps `next dev` out of it.** It
  carries `CLAUDE.md`'s rules for non-Claude agents and points here. Without the option, Next 16 injects
  its own block into `AGENTS.md` at the repo root whenever it detects a coding agent
  (`node_modules/next/dist/server/lib/generate-agent-files.js`; option documented in
  `node_modules/next/dist/server/config-shared.d.ts`), which dirties every worktree that runs `pnpm dev`.
  Keep the option. When a rule in `CLAUDE.md` changes, change it in `AGENTS.md` too.
- **The eval bundle is generated: never hand-edit `public/evals/`; rebuild it from `poc`** with
  `bash scripts/build-eval-bundle.sh && bash scripts/verify-eval-bundle.sh`. The verify script
  recomputes `index.json` with the POC's `suiteReport` and byte-compares every run, trace and
  iteration against the `poc` branch, so a hand edit fails it. A rebuild from an unchanged `poc`
  leaves `git status` clean: `export.mts` stamps a fresh `exportedAt` on each `manifest.json`, and
  the build keeps the committed manifest when that stamp is the only change
  (`keepManifest` in `src/lib/evals/bundle-build.ts`).
- **POC code runs only from `<main checkout>/.worktrees/poc-src`**, a detached checkout of `poc` that
  `scripts/poc-src.sh` creates and checks (HEAD equals `poc`, no edits to tracked files). It sits
  outside every chunk worktree, so no `poc/` path can be staged. Run POC scripts with that
  checkout's own `poc/node_modules/.bin/tsx`; this repo has no `tsx` dependency. The app's build
  and runtime never read it.
- **Eval numbers come from `index.json`, labelled.** Every live/baseline number is
  `{value, split, runs, suite}` (`src/lib/evals/index-schema.ts`). `runs` is the denominator
  `suiteReport` used: graded runs for key-graded metrics, finished runs for `traceChecks` and
  `secondsPerRun`, all runs for `costPerRunUsd`, and runs carrying a judge panel for `judgePass`.
  The POC judges only the first repeat, so `judgePass` rests on about a third of the runs (live: 24
  of 69). Live pools both iteration-06 suites; baseline pools `w0i` + `cb0`, because neither suite
  alone covers all four weeks.
- **Eval prose lives in `config/eval-story.yaml`; eval numbers come only from `public/evals/index.json`.** The
  YAML holds no digits outside `{{placeholders}}` (`EvalStorySchema` rejects them). A placeholder is filled by
  `storyContext` in `src/lib/evals/story.ts`; a number in a "what moved" item is a quote resolved verbatim from
  the iteration's recorded `decision`/`notes` by number-free `start`/`before` anchors. Targets are
  `config/app.yaml` → `evalTargets`; the headline is computed by `computeVerdict` (`src/lib/evals/verdict.ts`).
  To add an iteration, add its entry to `eval-story.yaml`: `story-schema.test.ts` fails until the ids match.
- **Models are compared only within one suite** (`/evals/models`, chunk 10). `modelComparisons` (`src/lib/evals/models.ts`)
  groups each suite's own `suiteResults` entries (never a pooled one) and compares a suite only when it ran more than one model;
  rows are setups, not models. Model labels carry digits, so prose names them through `{{models.*}}` placeholders
  (`modelsContext` in `story.ts`), as it does the price-parity date (`index.json` → `priceParity`), the like-for-like pair (same method and prompt, the live model against another),
  each difference's direction and the lowest pipeline recall. The judge panel is read with `judges()` (`src/lib/config.ts`).
  In the shipped bundle only `w0i` ran two models, and the live setup never ran in it, so the page highlights the live
  *model's* rows. A suite that lists a setup with no result of its own is an error, not a smaller table. The Cases page opens one setup in one suite with `?suite=&setup=`; `?iteration=` wins when both are given
  (`casesState.ts`).
- **Agreement and noise are computed by the bundle builder, not the browser.** `relevanceAgreement` and
  `tierAgreement` (`repeatAgreement` in `bundle-build.ts`) group finished, non-superseded repeats by suite and
  eval set and skip groups with fewer than two. `tierAgreement` is repeat-to-repeat; `tierRight` is against the
  answer key; never label one as the other. `noiseBand` is the live iteration's control re-run in both live
  suites; a "within/beyond noise" verdict is shown only for suites of the same eval-set size (`bandApplies`).
- **Read the bundle in the browser with `src/lib/evals/loader.ts`.** `.gz` files are served as
  `application/gzip` with no `Content-Encoding` (measured under `pnpm start`), so the loader gunzips
  them with `DecompressionStream`. Traces stream as an async iterator; never `res.json()` a `.gz`.
  No route imports `public/evals`, so the files ship as static assets, not inside function bundles.
- **Per-case eval results are computed in the browser by `src/lib/evals/cases.ts`, graded like the POC
  (subset grading).** Only docs the answer key labels are graded: a flag on a `relevant` doc is a hit, on a trap a
  trap hit, and a flag outside the key is `unlabeled` and never penalised. Finished, non-superseded repeats only;
  a "changed" case is a different hit *rate* (2/2 vs 3/3 is no change). `cases.test.ts` requires per-case sums to
  equal every shipped suite's `report.json` counts, so there is no second grader to drift. Key normalisation
  (`keyedDocs`, `trapIds`) lives in `bundle-build.ts`; import it, don't copy it.
- **List runs from `runs-index.json`, never from `runs.jsonl.gz`.** The build writes one per suite and one for
  `user-view` (`runsIndex` in `bundle-build.ts`: runId, setup, profileId, window, repeat, status, superseded;
  ~20 KB a suite vs megabytes of run records), and `verify-eval-bundle.sh` recomputes them. Load with
  `loadRunsIndex(suiteId | USER_VIEW)`. Example runs have no trace checks: `loadTraceChecks(USER_VIEW)` is
  null. Only the first repeat of a setup carries a judge `panel`; the judges' reasons are in
  `panel.judges[].votes`.
- **Rebuild the eval bundle under the project's Node (24.13.0).** `export.mts` gzips `runs.jsonl.gz` with
  Node's zlib: under Node 26 the bytes differ (same content), so a rebuild is byte-stable only on Node 24.

## Layout

Where things live, and what belongs where.

```
.claude/                      The spec-driven loop: prompts, bibles, skills, and this file.
plans/                        Plan directories — one per plan, with SPEC, chunks and retro.
config/                       Runtime YAML, validated by zod at load, shipped in every function bundle.
                              app.yaml and eval-story.yaml are this repo's own; everything else is copied from
                              poc:poc/config/, with one recorded `use: eval` line in companies/brightside.yaml
                              (see Conventions).
  app.yaml                    App-wide settings (appName, maxWindowDays, evalTargets for /evals, defaultPreset and
                              suggestAreas {model, prompt} for /runs/new, followUp {model, system, suggestions, caps} for
                              the follow-up chat).
  eval-story.yaml             The eval view's prose: verdict, CARL rows, measure labels, per-iteration label,
                              outcome, one-line summary and why/change gists, "what moved" items, the summary cards'
                              live line (cards), the Models page (models) and the Live setup page (liveSetup)
                              (EvalStorySchema; no typed numbers).
  prompts.yaml                Every prompt's wording, with {{placeholders}}.
  prompt-sets/                Partial prompt overrides a setup opts into (strict, strict-v2, strict-v3).
  pipeline.yaml               Tier rules (90 / 30 days, critical doc types), batch sizes, text limits.
  setups.yaml · judges.yaml · experiment.yaml   Models/methods/setups, judge panel, live setup.
  companies/                  One profile per file; `use: demo` = preset (hearth, ledgerly), `use: eval`.
  evalsets/                   manifest.yaml, weeks/ (frozen Federal Register input), keys/ (answer keys).
  README.md                   The POC's guide to these files (mentions POC-only pinConfig).
scripts/bootstrap.sh          Fresh-worktree setup: install + .env.local with AI_GATEWAY_API_KEY.
scripts/build-eval-bundle.sh  Rebuilds public/evals/ from `poc` with the POC's own export.mts.
scripts/build-eval-index.mts  Derives index.json, iteration.json, user-view/index.json (POC suiteReport).
scripts/verify-eval-bundle.sh Nothing-lost check against `poc` + index recompute (--check).
scripts/poc-src.sh            Sourced by the eval scripts and build-examples.sh: the detached poc checkout and its tsx.
scripts/build-examples.{sh,mts}  Rebuilds public/examples/ from public/evals/user-view/ (projectRecordedRun; react-server
                              condition for `server-only`). Idempotent, no timestamps.
public/evals/                 GENERATED eval bundle, served as static files (never hand-edit):
  index.json                  suites, setups, iterations (+ measured, evidence), live, baseline, suiteResults,
                              noiseBand, evalSet, counts, priceParity (the check date config/setups.yaml's comment
                              records; bundle-build.ts → priceParity) (index-schema.ts).
  config/                     One copy of poc/config, answer keys included.
  suites/<arenaId>/           manifest/report/trace-checks.json, runs.jsonl.gz, traces/<runId>.jsonl.gz,
                              runs-index.json (one small row per run, for the Runs page).
  user-view/                  index.json, runs-index.json, runs/<runId>.json, traces/<runId>.jsonl.gz (all 22,
                              failed too).
  iterations/<NN-slug>/       iteration.json + the POC's files verbatim (spec, record, diffs, evidence, config/).
public/examples/              GENERATED by scripts/build-examples.sh (never hand-edit): index.json (sidebar listing) and
                              <runId>.json per finished example run (public RunEvents + profile). The only files GC pages fetch.
public/submission/            The submission page, hand-written static HTML served at /submission (next.config.ts rewrite):
  index.html                  Links, design, and the build timeline. Prose only; no eval numbers (they'd drift).
  design-screens.html         The lo-fi, mid-fi and hi-fi screens (one self-contained export).
  transcripts/stepN-<slug>/   Claude Code session exports (index.html + page-NNN.html), copied verbatim.
src/
  app/                        Next.js App Router.
    layout.tsx                Root layout: Inter via next/font, globals.css.
    page.tsx                  `/` — redirects to /runs/new.
    runs/new/page.tsx         The new-run screen (server page: presets, maxWindowDays and New York's date as props).
    runs/[id]/page.tsx        One run from this browser's IndexedDB (server page; renders the client RunView).
                              `/runs/new?from=<runId>` ("Edit settings") fills the new-run form from that stored run.
    examples/[id]/page.tsx    `/examples/<id>` — a recorded example run in the GC's Report screen (client ExampleView reads
                              /examples/<id>.json only).
    evals/page.tsx            `/evals` — eval Summary (reviewer view, separate sidebar; the GC sidebar has no link).
    evals/iterations/[id]/    `/evals/iterations/<id>` — one iteration. Both read YAML per request; the
                              bundle loads client-side.
    evals/cases/              `/evals/cases?iteration=<id>` — cases one iteration changed + run panel (default:
                              the live iteration); `?suite=<arenaId>&setup=<key>` — one setup's cases in one suite (from
                              Models). Company/week/split names come from config/ (evalsetInfo.ts).
    evals/models/             `/evals/models` — why the live model, one table per multi-model suite, single-model suites,
                              caveats, judge panel (prose from eval-story.yaml, panel from judges.yaml).
    evals/setup/              `/evals/setup` — the setup every GC run executes, read from config/ per request through
                              buildRunConfig (liveSetupView, src/lib/evals/liveSetup.ts): facts, each stage's prompts
                              in full, and a prompt-set override side by side with its default (lineDiff.ts).
    evals/runs/               `/evals/runs` — every suite run and example run, each with a raw-trace link.
    evals/traces/[suiteId]/[runId]/  One run's raw trace (`suiteId` = arena id or `user-view`).
    evals/reports/[suiteId]/[runId]/ One run's read-only report (RecordedReport → ReportView readOnly; failed runs show
                              their steps and error); linked from /evals/runs and the cases run panel.
    globals.css               GC AI theme tokens (the only place raw colour values live).
    api/probe/stream/         Deploy probe: route.ts streams `tick N` lines then `done`;
                              seconds.ts parses ?seconds= (zod, clamped 1–120).
    api/run/                  POST: one live run as NDJSON RunEvents (maxDuration 300). route.ts wires request.ts
                              (body validation), run-config.ts (RunConfig from experiment.yaml userView.setup) and
                              stream.ts (NDJSON sink: exactly one terminal event, no-op after disconnect).
    api/suggest-areas/        POST {description} → {areas}: route.ts (wiring, fixed failure messages), suggest.ts
                              (body guard, prompt from app.yaml, one structured model call through withRetry).
    api/followup/             POST {context, messages} → the answer as NDJSON (maxDuration 60): route.ts (wiring, fixed
                              sentences), followup.ts (strict body guard, caps, assertPublicText, system prompt from
                              app.yaml, streamText with the first text awaited inside withRetry), __fixtures__/stream-model.ts.
  components/
    shell/                    AppShell (three-pane layout) and SidebarNav parts. Owned by chunk 01.
    gc/                       GC screens: GcSidebar (recent runs from IndexedDB, Examples), RunView (Running / Report /
                              Failed / Interrupted), RunSteps, ReportView, SourcesPanel, StartRunButton, useRun (the page's
                              runner, saved profiles, confirm); edge states: EmptyReport, HeldBack, FailedStep (Retry + Edit
                              settings); ExampleView (+ ExampleReport); FollowUpChat (chips, composer, streamed turns, under a
                              finished report); download.ts (saveText); new-run screen: NewRunForm, ProfilePicker, WeekPicker, ProfileEditor,
                              OwnersTable (render only: decisions come from src/lib/runs/new-run.ts).
    ui/                       shadcn primitives (button, badge, sheet, table, tabs, collapsible, tooltip, chart, select,
                              popover, input, textarea).
    evals/                    Eval view: EvalSidebar, EvalSummary (+ useEvalIndex), CarlTable, Scoreboard,
                              ProgressChart (Recharts), IterationView, DiffSheet, ErrorAnalysisSheet;
                              CasesView, CasesTable, RunPanel, RunsView, TraceViewer (@tanstack/react-virtual),
                              RecordedReport (one run's report); ModelTable (+ ModelsView, the Models page).
  lib/
    config/                   load.ts (readYaml) and schemas.ts (zod schemas for config/*.yaml).
    config.ts                 POC config port: schemas for the POC files, companies/presets, prompts and
                              prompt sets, render, frozenWeek/loadKey, validateAll, configHash.
    fr.ts                     Federal Register + govinfo client; frozen weeks read from config/, live
                              windows fetched (transient failures retried), responses cached in memory per process.
    gateway.ts                AI Gateway model resolution (key checked at call time) and the test seam.
    grade.ts                  majority() only, for the LLM filter's vote.
    pipeline/                 The live pipeline, ported from the POC: run.ts (runPipeline: wiring and the
                              relevance cut), stages.ts, excerpts.ts, context.ts (RunCtx: retries, trace, emit),
                              events.ts (RunEvent, STEP_LABELS, assertPublic; no server imports), retry.ts.
      recorded.ts             Server-only: a recorded example run → public RunEvents (build-examples.sh): strict labels,
                              neutral reason, assertPublic.
      recorded-events.ts      Browser-safe: recordedView → RunEvents, shared by recorded.ts and the reviewer's run report.
      __fixtures__/           replay-06*: a recorded POC run, the FR/govinfo responses it read, its report.
                              harness.ts / replay.ts: model and fetch stubs for tests.
    tier.ts · verify.ts       Deterministic tiering and quoted-date verification (POC, verbatim).
    prompts.ts                Prompt builders that render config/prompts.yaml (POC, verbatim).
    types.ts                  Shared shapes (FrDoc, CompanyProfile, ActionItem, RunRecord, …).
    __fixtures__/             recorded-prompts.json: prompts the POC arena sent (golden prompt parity).
    evals/                    index-schema.ts (zod contract for public/evals/index.json),
                              loader.ts (browser fetch + gunzip reader for the bundle, loadIteration/File, loadRecordedRun),
                              bundle-build.ts (pure decisions of scripts/build-eval-index.mts, no fs),
                              verdict.ts · story.ts · chartSeries.ts (pure, client-safe view logic),
                              cases.ts (per-case hits, subset grading) · casesState.ts (Cases page states),
                              runFacts.ts (filter reason, judges, passages) · traceIndex.ts (trace filter/search),
                              runList.ts (Runs page rows), models.ts (Models page: per-suite model groups, the
                              like-for-like pair, lowest pipeline recall),
                              evalsetInfo.ts (server-only: eval-set names from config/),
                              story-schema.ts (zod for config/eval-story.yaml), __fixtures__/eval-index.ts,
                              __fixtures__/shipped.ts (node reads of public/evals + stubFetch for tests).
    runs/                     Browser-side runs, pure and client-safe (no config/fs imports): types.ts (StoredRun,
                              RunRequest, StoredChat), store.ts (IndexedDB runs/profiles/chats + in-memory fallback), reader.ts (NDJSON reader, runner:
                              start/retry/load/list), reduce.ts (events → screen state), report.ts (heading, summary,
                              counts, why-tier, mailto drafts, .json download), sidebar-user.ts, weeks.ts (last full
                              weeks, window check, New York today), profileForm.ts (form ⇄ CompanyProfile, owner emails),
                              new-run.ts (picker options, switch-confirm reducer, what Run sends, screen sentences,
                              prefill from a stored run), memo.ts (no-action memo, held-back section), examples.ts
                              (/examples reader, sidebar labels), recorded-view.ts (the one recorded-run mapping, zod),
                              suggest-client.ts (the browser's suggest-areas request, every outcome a value),
                              followup-context.ts (the follow-up chat's context whitelist, which runs get a chat, and
                              askFollowUp: one question's request, stream and save).
    utils.ts                  `cn` class merging.
next.config.ts                Tracing includes for config/, Tailwind via Turbopack, agentRules: false, /submission rewrite.
AGENTS.md                     CLAUDE.md's rules for non-Claude agents; points to this file.
vitest.config.mts             `@` alias, server-only alias, discovers src/**/*.test.ts.
components.json               shadcn settings.
```

Tests sit next to the module they cover as `*.test.ts`. A component render test is a `.ts` file too (vitest runs in node and
discovers only `*.test.ts`): it builds elements with `createElement` and renders them with `react-dom/server`'s
`renderToStaticMarkup` (`src/components/evals/ModelTable.test.ts`).
