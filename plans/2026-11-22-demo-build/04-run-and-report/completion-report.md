# Chunk 04 — Completion Report

Streaming run, Running and Report screens, IndexedDB history and Retry. Branch
`feat/demo-build--run-and-report`, base `df4549b` (`git merge-base HEAD feat/plan--demo-build`).
The preflight amendment (14 points) was followed wherever it overrides the plan body.

Evidence files referenced below live in the session scratch directory
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-04/`
(written `$S/` below). Nothing in this chunk spent Gateway credit. The live smoke test is lead-only
(amendment 14) and **was not run**.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `package.json`, `pnpm-lock.yaml` | edited | `fake-indexeddb` 6.2.8, pinned exactly, as a dev dependency for the store tests (amendment 7). |
| `src/components/ui/{table,tabs,collapsible}.tsx` | created by `pnpm exec shadcn add table tabs collapsible` | Amendment 12. CLI output, unedited. `button.tsx` is untouched (`git diff df4549b -- src/components/ui/button.tsx` is empty). |
| `src/lib/runs/types.ts` | created | Client-safe types: `RunRequest`, `StoredRun` `{id, createdAt, request, events, status, result, profile}` (amendment 2), `RunStatus` (`running` / `done` / `failed` / `interrupted`). |
| `src/lib/runs/store.ts` (+ test) | created | IndexedDB wrapper: DB `reg-monitor`, store `runs`. `save` / `get` / `list` (newest first) / `markInterrupted`. Every call goes through one wrapper that falls back to an in-memory copy and sets `persistent=false`, so the UI can show a notice. |
| `src/lib/runs/reduce.ts` (+ test) | created | `reduceEvents(events)`, the one events-to-screen-state reducer for live and reopened runs. It keeps everything `run.done` carries, plus `step.retry`, `step.progress` sub-items, and `run.failed` with or without a step (amendment 9). |
| `src/lib/runs/reader.ts` (+ test) | created | `readNdjson` (TextDecoder in stream mode). `createRunner({fetch, store, newId, now})` handles start, retry, load and list. The runner owns each stream, so a run keeps streaming across navigation. A stream with no terminal event is saved as `interrupted`, and so is a stale `running` record on load or list. |
| `src/lib/runs/report.ts` (+ test) | created | Writes, in code from the items: the heading, summary, counts (each from its own list, never by subtraction), sort order, why-tier text, deadline labels, one `mailto:` per owner, and the `.json` download. |
| `src/lib/runs/sidebar-user.ts` (+ test), `src/lib/runs/demo.ts` | created | The sidebar footer user is the demo preset's general counsel. `DEMO_RUN` is the fixed Ledgerly Nov 2–6 request that `/` starts. |
| `src/app/api/run/route.ts` (+ test) | created | `POST`: wiring only. `runtime = "nodejs"`, `maxDuration = 300`. The response is `application/x-ndjson; charset=utf-8`, or a 400 in `text/plain`. |
| `src/app/api/run/request.ts` (+ test) | created | zod body validation (amendment 3). Preset ids are checked against `presets()`. A custom body is a full `CompanySchema` profile. The window is counted inclusively, ≤ `app.yaml` `maxWindowDays`. Messages are plain. |
| `src/app/api/run/run-config.ts` (+ test) | created | The server-only RunConfig builder (amendment 1): `experiment().userView.setup` looked up in `setups()` with the POC `cellConfig` expressions, `asOf = windowEnd`, and a custom profile mapped to `"custom"`. |
| `src/app/api/run/stream.ts` (+ test) | created | NDJSON sink (amendment 4). It never adds to `RunFailed`. Any other error becomes one `run.failed` with `step: null`. There is never a second terminal event, and emit is a no-op after `cancel()`. The open spend-after-disconnect issue is documented in the JSDoc. |
| `src/components/gc/useRun.ts` | created | One runner per page load (amendment 7). Provides `useRun(id)`, `useRecentRuns()` and `startRun()`. |
| `src/components/gc/{GcSidebar,RunSteps,ReportView,SourcesPanel,RunView,StartRunButton}.tsx` | created | The screens, built from the hi-fi with theme tokens only. |
| `src/app/runs/[id]/page.tsx` | created | Server page (amendment 10): `await connection()`, `params` as a Promise, the wordmark and sidebar user from config, then the client `RunView`. |
| `src/app/page.tsx` | edited | `/` is a server component. It renders `GcSidebar` and a "Run Ledgerly · Nov 2–6" `StartRunButton` that carries the preset snapshot (amendment 11). The chunk 01 placeholder content is gone. |
| `.claude/resources/project.md` | edited | See "project.md changes" below. |
| `plans/.../04-run-and-report/gates.sh` | created | The chunk gates, including amendment 13. |
| `plans/.../04-run-and-report/plan.md` | edited | T001–T010 ticked. |

### project.md changes (Stack + Commands are this chunk's, per the shared-file audit)

- **Stack.** New row `fake-indexeddb` 6.2.8 (dev), read from `node_modules/fake-indexeddb/package.json`, plus a
  sentence in the provenance paragraph. No runtime dependency was added: I used raw IndexedDB, not `idb`.
- **Commands → Run a monitor pass.** This is the plan's curl, marked as spending ~$0.24 (the `setups.yaml` estUsd of
  `jev-sonnet-strict-passages`), with a note that `AI_GATEWAY_API_KEY=` set empty makes it free (it ends in `run.failed`).
  The file's rule is that a command is run before it is written down. I ran exactly this curl against
  `AI_GATEWAY_API_KEY= pnpm start -p 3401` (port changed only). Output is in `$S/curl-keyless.{ndjson,headers,meta}`:
  `200`, `content-type: application/x-ndjson; charset=utf-8`, and events `run.start, step.start scan, step.done scan,
  step.start rank, step.failed rank, run.failed rank`. Conflict flagged: the live (paid) form was not run (amendment 14).
- **Conventions.** Two new entries:
  - the browser imports only types from `events.ts`, enforced by Gate 4;
  - the live-run persistence model: the runner owns streams, the record shape, what `interrupted` means, no
    RunConfig in the browser, and `reduceEvents` as the single source of screen state.
- **Layout.** Added `app/api/run/`, `app/runs/[id]/`, `components/gc/`, `lib/runs/`, and the new `ui/` primitives.
  Replaced the stale "`/` — placeholder" line.

The prompt-engineering decision tree routes a resource-file edit to `conventions/ai-optimized-writing.md`. I followed it:
bullets for rules, the "why" stated, paths instead of code dumps, and no duplicated rule. The existing
`STEP_LABELS` / `assertPublic` convention is still true and was left as it is.

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| `POST /api/run` (ledgerly, Nov 2–6) answers `application/x-ndjson`, one RunEvent per line, ending in `run.done` or `run.failed`; `maxDuration = 300` | yes | `route.test.ts` › "one RunEvent per line, from run.start to exactly one terminal run.done": the real pipeline runs offline (decision stub → 0, frozen week), 466 decision calls, exactly one terminal event, no `fetch`. The "declares the 300 s function budget" test. Runtime: `$S/curl-keyless.*` (above). |
| A body that fails validation gets a 400 with a plain message and starts no run (unknown profileId, window > maxWindowDays, end < start, custom profile missing summary) | yes | `route.test.ts` › "rejected bodies get a plain 400 and start no run": 8 cases, including brightside, 2026-02-30 and non-JSON. Each asserts a 400, `text/plain`, no `Error` / `.ts:` / `config/` in the body, `runPipeline` calls = 0 (counted by a pass-through mock), and 0 model calls. `request.test.ts` has 25 cases. Gate 2 returns 400 at runtime. |
| A custom profile in the body is the profile the pipeline runs; the server writes it nowhere | yes | `route.test.ts` › "runs a custom profile from the body": `run.start.company` is the custom name, every decision-model state contains the custom summary, none mentions Ledgerly, and `config/companies` is byte-identical before and after. `no-fs-writes.sh` passes (52 files scanned). |
| Running: steps done / in progress / waiting with counts and timings; sub-items and a spinner that respects reduced motion; an `aria-live="polite"` status line; skeletons | yes | `reduce.test.ts` › "shows the step in progress with its sub-items so far…". `$S/shots/01-running-desktop.png` and `07-running-390-reduced-motion.png`. `$S/shots/runtime-checks.json`: the live region's HTML; spinner `animationName` is `["spin","spin"]` with no preference and `["none","none"]` with `prefers-reduced-motion: reduce`. |
| Report: "Worked for Ns" collapsible; heading and summary from items (no LLM); tier badges plus "Held back N"; table Priority / Rule and what to do with numbered chips / Deadline with Verified / Owner; "Why <tier>?"; "Draft email to <owner>" `mailto:`; "N not relevant · see why"; `.md` / `.json` downloads; Sources / Profile panel | yes | `report.test.ts` (21 tests, on the recorded replay items and constructed ones). `$S/shots/02-report-desktop.png` (expanded: steps, why-tier, not relevant), `02b-report-expanded-full.png`, `04-report-390.png`. The mailto `href` was captured in the a11y snapshot; it decodes to the owner's three items. |
| `run.failed`: the failed step shows its message under it with Retry; Retry starts a new run with the identical saved config | yes | `reduce.test.ts` › "keeps which step failed and its message…". `reader.test.ts` › "posts the stored request unchanged…" (byte-equal body). At runtime, a real click on a keyless server gave `$S/shots/03-failed-retry-desktop.png`, and clicking Retry created a second record with the identical request (`$S/shots/idb-after-retry.json`). |
| After a reload, "Recent runs" lists finished and failed runs from IndexedDB, and opening one re-renders from stored events with no network | yes | `store.test.ts` › "keeps runs across a reopen". The seeded replay record rendered the full report (`02-report-desktop.png`). The page reads only IndexedDB: `RunView` → `useRun` → `runner.load` → `store`, and no fetch exists on that path (`grep -n "fetch" src/components/gc/*.tsx` → no hits). |
| A reload during a run shows it as "Interrupted" with Retry, and the UI says a stream can't resume | yes | `reader.test.ts` › "marks a run left 'running' by a previous page (reload mid-run) as interrupted", and `createRunner: list`. At runtime, a run started by the real button (fetch stubbed to stream 18 replay events and hang) showed "interrupted" plus Retry after the page reloaded (`$S/shots/06-after-reload-390.png`). `05-interrupted-desktop.png` shows a seeded stale record. |

## Tests

Red first. The first red run was an **import red** for all 8 new files, before any implementation
(`$S/red/red-import.txt`: `Test Files 8 failed (8)`, `Tests no tests`, each `Cannot find module`). That only proves the
modules were absent. The discriminating evidence is the mutation table below: each guarantee was broken in a plausible
way, its test went red, and the file was restored by copy (the script asserts byte equality after restoring). Script:
`$S/mut/run_mutations.py`. Results: `$S/mut/{lib,api,late}-results.md`.

Green, final, after the last code edit: `bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh` → `Test Files 30
passed (30)`, `Tests 318 passed (318)` (`$S/gates-head.txt`). The baseline was 21 files and 204 tests.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| list newest first | `list` returns `getAll` unsorted | store › "lists runs newest first…" |
| fallback when IndexedDB is missing or refuses | open without try/catch | store › undefined / open throws / open request fails (3) |
| mid-session failure degrades | per-call catch removed | store › "degrades to memory… when the database goes away" |
| only `running` becomes interrupted | status check removed | store › "leaves a finished or failed run alone" |
| memory mirror | `memory.set` removed | 4 fallback tests |
| progress sub-items | `step.progress` ignored | reduce › "shows the step in progress with its sub-items" |
| failed step kept | `run.failed` mapped to step null | reduce › "keeps which step failed and its message" |
| retry tracked | `step.retry` ignored | reduce › "tracks the latest retry" |
| unlisted step kept | append removed | reduce › "adds a step that run.start did not list" |
| `run.done` kept whole | `screenedOut` dropped | reduce › "keeps everything run.done carries" |
| run-level failure stops spinner | running→failed removed | reduce › "keeps a run-level failure (step null)…" |
| multi-byte split | `decode(value)` without `{stream:true}` | reader › "parses every event exactly once when chunks split…" |
| trailing line | final flush removed | reader › "reads a last line that has no trailing newline" |
| non-OK not read as stream | `!res.ok` removed | reader › "not OK even though its body parses as JSON" |
| dropped stream → interrupted | final mark removed | 5 interrupted / list tests |
| retry re-posts stored request | rebuilt from `profile.id` | reader › "posts the stored request unchanged" |
| reload → interrupted | `load` uses `get` | reader › "marks a run left 'running' by a previous page" |
| saved before fetch | `save` in `start` removed | 3 reader tests |
| failed ≠ done | run.failed → "done" | reader › "ends failed…" |
| list marks only stale runs | marking removed / `streaming` check removed | reader › "createRunner: list" (both) |
| heading from items | hard-coded mockup heading | report › heading (3) |
| counts never by subtraction | notRelevant = scanned − … | report › "counts tiers… never by subtracting" |
| "Inc." gets no double full stop | `stop()` always appends | report › summary (4). This was also a real bug, found by the test's first green attempt. |
| mailto encoded | body unencoded | report › "encodes the body…" |
| one email per owner | all items in every email | report › draftEmails (2) |
| tier order | sort removed | report › sortItems, draftEmails, reportJson |
| unmatched citation said | count forced to 0 | report › summary (2) |
| held back said | sentence removed | report › summary (2) |
| maxWindowDays, inclusive | check removed / `+1` removed | request › 8-day, 30-day / "exactly maxWindowDays…" |
| reversed window | check removed | request › "ends before it starts" |
| presets only | brightside allowed | request › "an eval company…" |
| real dates | `.refine` removed | request › 2026-02-30, 2026-13-01 |
| custom profile schema | check removed | request › summary, owner email, non-object (3) |
| not both | check removed | request › "both… or neither" |
| non-object body | check removed | request › "a body that isn't an object" (4) |
| asOf = windowEnd | wall clock | run-config › recorded fields, "sets asOf…" |
| promptSet carried | dropped | run-config › recorded fields |
| custom → "custom" | profile's own id | run-config › custom |
| setup / method / pipeline-mode guards | each throw removed | run-config › one test each (3) |
| RunFailed adds nothing | instanceof check removed | stream › "adds nothing when the run fails with RunFailed" |
| one terminal event | `ended` guard removed | stream › "never sends a second terminal event" |
| no-op after cancel | `open` guard removed | stream › both disconnect tests |
| outside error → run.failed | emit removed | stream › "turns an error thrown outside the pipeline…" |
| sync throw caught | `Promise.resolve(run(emit))` | stream › same |
| route validates before running | body passed straight through | route › 8 × 400 tests |
| config error stays in-stream | config built before the stream | route › "a server-side config problem" |
| sidebar user | preferred preset ignored / null guard removed | sidebar-user (1 each) |

All 52 mutations (27 in `src/lib/runs`, 21 in `src/app/api/run`, 4 late ones for `runner.list` and `sidebarUser`) went red; none stayed green or failed to apply.

## Gates

Command: `bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh`. It runs chunk 03's `gates.sh` (lint, test, build,
typecheck last, Gate 2/3 greps, `parity.sh`, `no-fs-writes.sh`, `poc/` on HEAD) and then Gates 2–5 below. It was run
after the last code edit: exit 0, ending `chunk 04 gates: OK` (`$S/gates-head.txt`).

| Gate | Result on HEAD | Fails on base? |
| ---- | -------------- | -------------- |
| 1 · 03 `gates.sh` (lint, test, build, typecheck, parity, no-fs-writes, poc/ on HEAD) | OK: 318 tests, `parity: OK`, `no-fs-writes: OK (52 files)` | Passes on base (`$S/gates-base.txt`, 204 tests). It is the regression set, not a chunk-04 assertion. |
| 2 · 30-day window → 400 (port 3401, `next start` directly so `kill` reaches the server) | `400`, `Pick a window of at most 7 days.` | **Yes**, on a detached worktree of `df4549b` with a fresh offline install: exit 1, `FAIL: 30-day window not rejected (404)`. The failure text differs from HEAD's pass for the right reason: the route is absent. |
| 3 · no `poc/` in the HEAD tree or in `feat/plan--demo-build..HEAD` | OK | Base passes (vacuous), so each needle got a four-step canary in the base worktree (`$S/canaries.txt`). A committed `poc/canary.txt` gave `FAIL: poc/ path in HEAD tree`; reset gave OK. Added then deleted (tree clean) gave `FAIL: poc/ path in a commit since feat/plan--demo-build`; reset gave OK. |
| 4 · no value import from `pipeline/events` in GC client code (`src/lib/runs`, `src/components/gc`, `src/app` minus `api/`) | OK | Base exits 1 with `FAIL: src/lib/runs is missing`, which is absence and not discrimination, so canaries were run on HEAD. `import { STEP_LABELS }` appended to `report.ts` gave FAIL naming `report.ts:130`; restoring gave OK. `import { type RunEvent }` (inline form) in `RunSteps.tsx` gave FAIL; restoring gave OK. |
| 5 · no internal name in `.next/static` | OK | Base passes (vacuous: base has no GC client code). Canary: `var x="filter:jev"` in `.next/static/chunks/zz-canary.js` gave FAIL; removing it gave OK. |

Baseline was captured before any change at `$S/baseline/{types,lint,tests}.txt`: typecheck 0 errors, lint 0 problems,
204 tests passing. Delta: 0 type errors and 0 lint findings added, and +114 tests (204 → 318), all passing. Port 3401 was
confirmed free after every server stop (`lsof … | wc -l` → 0).

### Quoted payloads

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| Keyless monitor pass: status, content-type, event types | `$S/curl-keyless.{meta,headers,ndjson}` | The event list was printed by `node` from the `.ndjson` file, not typed. |
| 400 body | `$S/curl-400.txt` | `curl -o`; status from `-w`. |
| IndexedDB after Retry | `$S/shots/idb-after-retry.json` | Returned by `evaluate_script` on the page. The two `request` strings are identical by construction of the query output; the same equality is asserted in `reader.test.ts`. |

## How the report was rendered without spending

- **Failed + Retry.** The server ran as `AI_GATEWAY_API_KEY= pnpm start -p 3401`. `@next/env` 16.4.6 only fills
  variables that are `undefined`, so an empty variable is not overridden by `.env.local`. I read this in
  `node_modules/.pnpm/@next+env@16.4.6/.../dist/index.js` (`typeof p[t]==="undefined"`). A real click scanned the frozen
  week from `config/`, and `gateway()` threw at the first model resolution. Server log:
  `[Pipeline] failed: StepFailed: step rank failed … AI_GATEWAY_API_KEY is not set`.
- **Report and Interrupted.** I seeded IndexedDB through `evaluate_script` with a record built from `runReplay().events`
  (dumped once to `$S/replay-events.json`) and the Brightside profile snapshot.
- **Running.** I stubbed `window.fetch` in the page to stream the first 18 replay events and hang, then clicked the real
  Run button.

Screenshots are in `$S/shots/`: `01-running-desktop`, `02-report-desktop`, `02b-report-expanded-full`,
`03-failed-retry-desktop`, `04-report-390`, `05-interrupted-desktop`, `06-after-reload-390`,
`07-running-390-reduced-motion`. At 390 px: `innerWidth 390 = scrollWidth 390` on Report and Running, and no element
outside the table's own scroller passes the right edge (`$S/shots/390-overflow-check.json`). The table keeps the
hi-fi's `min-width: 680px` inside its own `overflow-x: auto` container (332 / 680).

## Judgment calls

- **Raw IndexedDB, not `idb`.** The store makes four calls on one object store. A 6-line request-to-promise helper
  covers it, and a runtime dependency would buy little.
- **The stream belongs to a module-level runner, not to a hook.** The button is on `/` and the run renders on
  `/runs/<id>`, so a reader owned by a component would die on navigation. This choice also makes "stored `running`
  but not streaming in this page" exactly the interrupted case.
- **Validation and builder modules sit under `src/app/api/run/`, not `src/lib/runs/`.** They import `@/lib/config`
  (server-only, fs). `src/lib/runs` must stay client-safe, and the Convention Map lets `route.ts` export only handlers
  and segment config.
- **`maxWindowDays` comes from `config/app.yaml`, as the plan says.** `experiment.yaml` `userView.maxWindowDays` is
  also 7 and is not used by the route.
- **The builder rejects a non-pipeline `userView.setup`.** `runPipeline` has no baseline mode, so a baseline setup would
  silently run the pipeline under another setup's name.
- **A non-OK response is saved as `interrupted`, and its body is not stored** (amendment 5). The record shape is fixed
  by amendment 2, so the 400 message is not shown to the GC. Chunk 05's form validates the same limits before posting.
- **The heading noun comes from the doc type** ("3 notices…") when all items share one, and is "items" otherwise. The
  owner is named when there is one, and counted ("for 2 owners") when there are several. The mockup's "sanctions" topic
  word can't be derived without a model, so it is not attempted.
- **The summary says "Every deadline and citation below matched"** only when every item has `citationVerified`.
  Otherwise it names the unmatched count. `deadline` is always a verified date (`assignTier` uses verified dates only).
- **The sidebar footer user is the demo preset's general counsel** (Jordan Blake, Ledgerly). `presets()` sorts by file
  name, so Hearth came first until I added `preferId`.
- **"Worked for Ns"** shows at least `1s`. The replayed run took 180 ms; a live one takes about 60 s.
- **The status line is the live region.** The ticking "Working for Ns" inside it is `aria-hidden`, and an `sr-only`
  span names the current step, so a screen reader hears step changes rather than every second.

## Deviations from the plan

- **The plan says "the worst case observed is 87 s".** That is stale (amendment 5). `retry.ts` documents about 240 s
  in a govinfo outage. The route comment says a timeout ends the stream with no terminal event, and the browser saves
  that as interrupted.
- **Gate 2 port.** The plan uses 3104. The lead assigned 3401–3409 to this wave, so `gates.sh` defaults to
  `PORT=3401`. It starts `./node_modules/.bin/next start` directly so `kill $SRV` reaches the server (a `pnpm start`
  wrapper PID would leave `next-server` running). It waits for readiness instead of `sleep 4`.
- **`STEP_LABELS` is not reused** (amendment 6). Labels come from `run.start.steps` and `step.start.label`.
- **The reducer test fixture is Brightside, 6 steps** (amendment 8), not Ledgerly with 7.
- **`ReportView.test.tsx` was replaced by `report.test.ts`** on the pure derivations (amendment 7).
- **The Download menu is a disclosure, not an ARIA menu.** A button toggles two items. I dropped `aria-haspopup`
  because the popup has no `role="menu"`.

## Surprises

- **A keyless run fails as "Something went wrong", not "No response after 3 tries."** In chunk 03's `RunCtx.jev`,
  `decisionModel(model)` is resolved *outside* `this.retry(...)` (`src/lib/pipeline/context.ts`), and the same holds for
  `languageModel` in `object()`. So a missing key fails on the first try with `UNEXPECTED_MESSAGE`. That is reasonable
  for a config error, but it means no screenshot shows the timeout message from a real run. The reducer and RunSteps
  render any message. I left chunk 03's code alone.
- **shadcn's new `table.tsx` and `tabs.tsx` import `cn` from the `cn` package** rather than `@/lib/utils`.
  `utils.ts` re-exports the same function, so I left the CLI output unedited.
- **A company name ending in "." produced "Ledgerly Inc.."** The first green attempt of `report.test.ts` caught it, and
  it is fixed with `stop()`.
- **The screenshot tool can only write inside workspace roots.** I wrote screenshots to `.shot-tmp/` in the worktree,
  moved them to `$S/shots/`, and removed the directory (`git status` clean).
- **Clearing the browser's viewport emulation reloads the page.** That reload turned a live (stubbed) run into a
  genuine reload-mid-run, which `06-after-reload-390.png` shows as interrupted.

## Left alone

- **A run keeps spending after a client disconnect.** There is no AbortSignal in `runPipeline` (amendment 4). This is
  documented in `stream.ts`.
- **Model resolution sits outside `withRetry`** in `RunCtx` (see Surprises). That is chunk 03's code.
- **The hi-fi's "Stop run" button and "Search runs ⌘K"** are not built. Neither is in the acceptance criteria, and stop
  needs the AbortSignal above.
- **The "All runs" (`/#recent-runs`) and "Company profiles" (`/`) sidebar rows are placeholders.** Chunk 05 builds
  `/runs/new` and the profiles store.
- **The held-back list itself and the "nothing affects you" memo with the closest calls** are chunk 06. This chunk
  shows the "Held back N" badge and a summary sentence.
- **The live smoke test.** Lead-only (amendment 14), not run.
