# Chunk 11 — Completion Report

Follow-up chat on a finished report. Branch `feat/demo-build--followup-chat`, base `085ae33`
(`git merge-base HEAD feat/plan--demo-build`). No Gateway spend: every server ran with
`AI_GATEWAY_API_KEY=` empty, and every test stubs the model. The one live answer check is the lead's, after merge.

**Scratch root** (every `scratch/…` path below):
`/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-11/`

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `config/app.yaml` | edited | `followUp: {model, maxTurns 20, maxMessageChars 6000, maxContextChars 60000, maxAnswerTokens 1000, suggestions[2], system}`. `model:` kept at two spaces (05's gate reads every `^  model:` line). |
| `src/lib/config/schemas.ts` | edited | `FollowUpConfigSchema` (strict; system must contain `{{report}}`; caps positive ints) and `FollowUpSuggestionsSchema` (the pages' slice: chips only). |
| `src/lib/runs/types.ts` | edited | `ChatTurn`, `StoredChat {id, savedAt, turns}`. |
| `src/lib/runs/store.ts` | edited | VERSION 3 adds store `chats` (keyPath `id`); upgrade creates only missing stores; `saveChat`/`getChat` with a memory fallback. Turns never go on the run record. |
| `src/lib/runs/reader.ts` | edited | `readNdjson<T = RunEvent>`: generic over the line type so the chat reuses the run's NDJSON reader (no second reader). |
| `src/lib/runs/followup-context.ts` | created | Browser side: `buildFollowUpContext(view, profile)` (named-field whitelist, items in `sortItems` order numbered like the source chips, GC-confirmed items as `tier: "Not tiered"`), `followUpChatId` (the mount condition), `askFollowUp` (POST, stream through `onText`, save only a `done` answer), the shared sentences. |
| `src/app/api/followup/followup.ts` | created | Server-only: strict zod body schema typed against `FollowUpContext`, caps, `assertPublicText` on the context and on the rendered system prompt, `streamFollowUp` (first text awaited inside `withRetry`, `maxRetries: 0`, `maxOutputTokens`, NDJSON with a terminal `done`/`failed` line; `abortSignal` from the request: an abort before the first text throws and `withRetry`'s `stopped` ends the tries, an abort part-way closes with no terminal line). |
| `src/app/api/followup/route.ts` | created | Handlers and segment config only (`runtime = "nodejs"`, `maxDuration = 60`): config → 500, body → 400, model/before-first-text failure → 503, else the stream. |
| `src/app/api/followup/__fixtures__/stream-model.ts` | created | `stubStreamingModel` (mock `doStream` behind `setModelsForTests`; refused requests are retryable `APICallError`s; optional chunk delay for the abort tests) and `readLines`. |
| `src/components/gc/FollowUpChat.tsx` | created | Chips, composer (labelled textarea, Enter sends, Shift+Enter newline), streamed turns, failure alert, "Clear conversation". Store via `getRunner()` (no second open). |
| `src/components/gc/RunView.tsx` | edited | `suggestions` prop; chat passed through `ReportView`'s `followUp` only in the `done` branch, keyed by `followUpChatId("live", …)`. |
| `src/components/gc/ExampleView.tsx` | edited | `suggestions` prop; the loaded report split into exported `ExampleReport` (a test seam: `ExampleView` loads in an effect); chat keyed `example:<id>` when the view is `done`. |
| `src/app/runs/[id]/page.tsx`, `src/app/examples/[id]/page.tsx` | edited | Read `FollowUpSuggestionsSchema` and pass `suggestions: string[]` only. |
| Tests: `src/lib/runs/followup-context.test.ts`, `src/app/api/followup/{followup,route}.test.ts`, `src/components/gc/FollowUpMount.test.ts` | created | See Tests. |
| `src/lib/runs/store.test.ts` | edited | chats store round-trip, separation from runs, replace/clear, memory fallback, v2 → v3 upgrade. |
| `plans/2026-11-22-demo-build/11-followup-chat/gates.sh` | created | Gate 1: 06's gates keyless; Gate 2: the mount test; Gate 3: keyless curls of `/api/followup`; Gate 4: `poc/` count; typecheck last. |
| `.claude/resources/project.md` | edited | Store record (VERSION 3 `chats`), `followUp` + schemas in the UI-settings convention and the two-space `model:` rule, the `streamText`-retry fact, the streaming test stub, a follow-up chat convention, `configHash` `179451fef1`, Layout entries. |
| `plans/.../11-followup-chat/plan.md` | edited | T001–T007 ticked. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Finished or example run → chips and composer render under the report | yes | `FollowUpMount.test.ts` › "shows the chips and the composer under a finished run's report" / "… under a recorded example's report"; screenshots `01`, `02`, `05`. |
| Running, failed or interrupted run → no chat UI | yes | `FollowUpMount.test.ts` › "renders no chat while the run is running / failed / interrupted", "… example whose events end in a failure"; `followup-context.test.ts` › `followUpChatId` null for those statuses; screenshots `03`, `04`, `07`, `07b`, `08` (DOM check on each: `chat: false`). Reviewer page `06` (not mounted; `/evals/reports/**` untouched). |
| Question streams token by token (`streamText` via `/api/followup`, `maxDuration` set); the pair is saved under the run's id and comes back after a reload | yes | `followup.test.ts` › "streams the answer as NDJSON text lines, then a done line"; `route.test.ts` › "streams the answer as NDJSON…", "runs on Node with a set maxDuration…"; `followup-context.test.ts` › "posts the context … streams the answer, and saves the pair" (multi-byte chunks); `store.test.ts` › "saves a conversation and reads it back after a reopen". Screenshots `01`/`05` are seeded turns read back from IndexedDB by the real page after navigation. |
| Route rejects (400): context failing the public check; conversation over the configured limit (20); missing `items` | yes | `route.test.ts` › 400 cases (not JSON, no items, internal field, internal name in a title, 21 turns, question over the cap), each with 0 model calls; Gate 3 on the built server. |
| Context builder on a real recorded example has no probability fields, model ids or prompt text | yes | `followup-context.test.ts` › "carries only whitelisted fields, and nothing that names a score, a model or a prompt" (t6m4), whitelist key set + regex; "drops an internal field added to an item, a deadline, the view or the profile". |
| System prompt instructs "That isn't in this report" (checked in the rendered prompt) | yes | `followup.test.ts` › "the rendered prompt tells the model to say a question isn't covered, and carries the report" (real `app.yaml`). Model behaviour itself is the lead's live check. |

## Tests

Red run (before any implementation), `pnpm exec vitest run` on the five new/changed test files, captured at
`scratch/red-1.txt`: `Test Files 5 failed (5)`, `Tests 9 failed | 19 passed (28)`.

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `followup-context.test.ts` | import error: `Cannot find module './followup-context'` (absence only; discrimination shown by mutations below) | 20 passed |
| `followup.test.ts`, `route.test.ts` | import error: `Cannot find package '@/lib/runs/followup-context'` | 26 + 11 passed |
| `store.test.ts` › chats (5 tests) | assertion-level: `TypeError: store.saveChat is not a function` | 20 passed |
| `FollowUpMount.test.ts` › finished run | assertion: `expected false to be true` (no chat rendered) | passed |
| `FollowUpMount.test.ts` › example / FollowUpChat | `Element type is invalid … got: undefined` (no `ExampleReport`), `Cannot find module …/FollowUpChat` | passed |
| `FollowUpMount.test.ts` › running/failed/interrupted | **passed on base** (no chat anywhere): absence tests are vacuous until the chat exists; their discrimination is the "mount outside the done branch" mutation below | passed |

Full suite after the last code edit: see the generated block under Gates (baseline `Tests  740 passed (740)`, 54 files).

Two test fixes before green, both test bugs, not behaviour: the chip regex needed escaping (`?` in "come close?"),
and the `ExampleReport` seam takes `view`/`items` from its caller. After green, two tests were tightened because a
mutation showed them blind: the streaming stub's refused request became a retryable `APICallError` (a plain `Error`
is never retried by the SDK, so deleting `maxRetries: 0` stayed green), and the failed-line test uses its own sentence
(it used `FOLLOWUP_FAILED`, so ignoring the route's sentence stayed green).

A review pass after the first report found branches no mutation had touched; each got a test and a mutation
(`scratch/mutations-2.txt`, 9 of 9 red): `datesShown` copied as `{date, kind}` (the shipped examples predate
`datesShown`, so the real-example fixture only exercised the fallback), the `view.company ?? profile.name`
fallback, a stream broken after some text (`FOLLOWUP_FAILED`, not "unavailable"), an empty plain refusal and a
bodiless 200, `followUp` config strictness, and both abort paths. The abort probe
(`scratch/abort-probe.txt`: `mid: start start-step text-start text-delta(A) abort calls=1`) showed an abort is a
stream part, not a throw, and that the first version of `streamFollowUp` answered an abort before the first text
with a bare `done` line. Fixed: it now throws inside `withRetry`, whose `stopped` reads the signal (1 try, not 3).

### Mutations (every guard, shown red with its branch broken)

`scratch/mutate.py`: replaces exactly one asserted occurrence, runs the named tests, writes the original
bytes back and asserts they match (no git). Outputs `scratch/mutations.txt` (33) and `scratch/mutations-2.txt` (9):
**42 of 42 red** (count generated below), tree clean after each.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| Whitelist, not spread | `...i` into the item copy; `...profile` into the profile; `deadline: i.deadline` | "drops an internal field added to an item, a deadline, the view or the profile" |
| Confirmed items included, untiered | `checkedByYou` mapped from an empty list | "includes held-back items the GC confirmed, marked untiered…" |
| Chat only when done | `followUpChatId` returns a key unless `failed` | "is null while the run is running, and after it failed or was interrupted" |
| Live mount only in the done branch | chat id for any status + chat rendered after the status switch in `RunView` | "renders no chat while the run is failed / interrupted / running" |
| Example mount only when done | `followUpChatId("example", id, "done")` | "renders no chat for an example whose events end in a failure" |
| Client: blank never sent; foreign bodies never shown; route's failed sentence shown; no-`done` and empty answers fail; nothing saved on failure | each branch deleted / loosened; save moved before the checks | the matching `askFollowUp` test each time |
| Server: strict context / strict item; question last; blank question; maxTurns; maxMessageChars; maxContextChars; `assertPublicText` on context | each check removed | the matching `parseFollowUpBody` test (route 400 tests also red for strict, turns, message cap, public check) |
| `assertPublicText` on the system prompt | removed | "throws when the configured prompt names an internal model…" |
| Retry wraps the first text | `withRetry` replaced by a direct call | "retries a call that fails before its first text…", "gives up after 3 tries…", and 2 more |
| SDK retries off | `maxRetries: 0` removed | "gives up after 3 tries in all: … sent exactly 3 times" |
| Error before text retried; error after text signalled | either `throw p.error` removed | "gives up after 3 tries…" / "a failure after the answer started ends the stream with the fixed failure line…" |
| Answer cap passed | `maxOutputTokens` removed | "streams the answer as NDJSON…" |
| Keyless 503; body guard before the key | 503 → 500; model resolved before the parse | "with no Gateway key: a plain 503…" / "a bad body is refused with 400 before the missing key…" |
| chats store | store not created; VERSION 2; no memory fallback | chats tests / v2 → v3 upgrade / memory test |
| `datesShown` as date and kind; company fallback | `??` fallback only; dates copied whole; `?? ""` | "a live run's item lists every date it shows…"; "falls back to the profile's name…" |
| Broken stream after text; empty refusal | catch always "unavailable"; `message: text` | "a connection that breaks after some text…"; "an ok answer with no body, or a plain refusal with no sentence…" |
| Config strict | `.strict()` removed | "rejects a key it doesn't know…" |
| Abort | `stopped` removed; abort-before-text throw removed; abort-mid close removed | "an answer aborted before its first text … is not retried" (`attempts` 1); "an answer aborted part-way ends with no done line…" |
| `{{report}}` required | refine removed | "rejects a system prompt without the placeholder…" |

## Gates

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| All (final, after the last code edit) | `bash plans/2026-11-22-demo-build/11-followup-chat/gates.sh` | see "Final run" below | yes: exit 1 at Gate 2 |
| 1: 06's gates, keyless | `AI_GATEWAY_API_KEY= bash plans/2026-11-22-demo-build/06-edge-states/gates.sh` (inside, PORT 3801 exported) | `chunk 06 gates: OK` (lint, full test suite, build, parity, no fs writes, browser imports, GC bundle names, examples rebuild clean, pages 200, no poc/, typecheck) | inherited regression gate: passes on base by design (`base-gates.txt`: `chunk 06 gates: OK`) |
| 2: mount condition | `pnpm exec vitest run src/components/gc/FollowUpMount.test.ts` | 8 passed (generated block) | yes, exit 1: `No test files found, exiting with code 1` (`base-gates.txt`); its assertions' discrimination is the mount mutations above |
| 3: keyless `/api/followup` | curl 5 bodies to `next start -p 3801` keyless; `gate_followup_answers` | `Gate 3: /api/followup answers 503 keyless and 400 to each bad body, naming nothing internal` | yes, exit 1: base config has no `maxTurns` → `FAIL: no followUp maxTurns in config/app.yaml`; with that read stubbed (`gate3-curl-only.sh`), `FAIL: /api/followup 'ok' answered 404, not 503` (`base-gate3-curl.txt`) |
| 4: no `poc/` | `git ls-tree -r --name-only HEAD` and `git log --name-only --format= feat/plan--demo-build..HEAD` counted with `grep -c '^poc/'` | `Gate 4: no poc/ path` | absence gate: passes on base by design; canary below |
| Type check (last) | `pnpm typecheck` | exit 0 | — |

**Gate 3 caught a real bug on its first full run:** the gate's minimal body lacked `checkedByYou`, and the strict
schema answered `FAIL: /api/followup 'ok' answered 400, not 503` (`gates-run1.txt`). Fixed in the gate body
(`f8135d1`). The browser-built context passes the same schema on the real server: a keyless question from the
seeded live page got the 503 sentence, not a 400 (screenshot `09`).

### Canaries (`scratch/canaries.sh`, output `canaries.txt`: 17 ok, 0 bad)

Gate functions sourced with `GATES_LIB_ONLY=1`, fed planted captures; clean input passes before and after.

| Needle / assertion | Planted | Fired |
| ------------------ | ------- | ----- |
| each status (ok 503, noitems/long/internal/notjson 400) | 200 or 500 in one `.code` | `FAIL: /api/followup 'ok' answered 200, not 503` (and one per name) |
| plain-text content type | `text/html` | `… content-type 'text/html', not a plain sentence` |
| non-empty body; capture present | empty `.txt`; deleted `.txt` | `… answered an empty body`; `no captured answer for 'long'` |
| `AI_GATEWAY`, `followUp`, model id | each in a body | `'AI_GATEWAY' in the 'ok' answer…`, `'followUp' …`, `'anthropic/claude-sonnet-5.5' …` |
| needles supplied | none | `FAIL: no needles given` |
| `poc/` count | `poc/data/x.json` in the list | `FAIL: 1 poc/ path(s) in planted list` |

Baseline (`scratch/baseline/`): typecheck 0 errors, lint 0 warnings, tests 54 files / 740 passed.
Delta: +4 test files (58), 0 new lint or type diagnostics; test count in the generated block.

### Final run (generated)

`bash plans/2026-11-22-demo-build/11-followup-chat/gates.sh` re-run after the last code edit (tree at `98ff4a3`),
captured to `scratch/gates-final.txt`. Every later commit touches only `plans/…/11-followup-chat/`; check with
`git diff --stat 98ff4a3..HEAD`. The block below is written by `scratch/selfcheck.sh` from the captured files, not typed.

<!-- BEGIN GENERATED (selfcheck.sh) -->
```
# gates-final.txt (bash plans/2026-11-22-demo-build/11-followup-chat/gates.sh)
 Test Files  58 passed (58)
      Tests  810 passed (810)
chunk 04 gates: OK
chunk 05 gates: OK
chunk 06 gates: OK
 Test Files  1 passed (1)
      Tests  8 passed (8)
Gate 2: mount condition tested
Gate 3: /api/followup answers 503 keyless and 400 to each bad body, naming nothing internal
Gate 4: no poc/ path
chunk 11 gates: OK
exit 0
# canaries.txt
OK   clean: answers (before) -> Gate 3: /api/followup answers 503 keyless and 400 to each bad body, naming nothing internal
OK   canary fires: ok answered 200 -> FAIL: /api/followup 'ok' answered 200, not 503
OK   canary fires: 21 turns answered 200 -> FAIL: /api/followup 'long' answered 200, not 400
OK   canary fires: internal name answered 200 -> FAIL: /api/followup 'internal' answered 200, not 400
OK   canary fires: no items answered 200 -> FAIL: /api/followup 'noitems' answered 200, not 400
OK   canary fires: not JSON answered 500 -> FAIL: /api/followup 'notjson' answered 500, not 400
OK   canary fires: HTML content-type -> FAIL: /api/followup 'ok' answered with content-type 'text/html', not a plain sentence
OK   canary fires: empty body -> FAIL: /api/followup 'noitems' answered an empty body
OK   canary fires: missing capture -> FAIL: no captured answer for 'long' in /var/folders/hp/kkx1k_vx0lzdk1brvx4p1_f80000gn/T/tmp.SPP7oDxyQP
OK   canary fires: key variable in body -> FAIL: 'AI_GATEWAY' in the 'ok' answer of /api/followup
OK   canary fires: config key in body -> FAIL: 'followUp' in the 'internal' answer of /api/followup
OK   canary fires: model id in body -> FAIL: 'anthropic/claude-sonnet-5.5' in the 'notjson' answer of /api/followup
OK   canary fires: no needles given -> FAIL: no needles given
OK   clean: answers (after) -> Gate 3: /api/followup answers 503 keyless and 400 to each bad body, naming nothing internal
OK   clean: poc count (before) -> 
OK   canary fires: poc/ path planted -> FAIL: 1 poc/ path(s) in planted list
OK   clean: poc count (after) -> 
canaries: 17 ok, 0 bad
# mutations.txt + mutations-2.txt
RED: 42   NO RED: 0
```
<!-- END GENERATED -->

### Transcript self-check

| Quoted payload | Captured at | Self-check |
| -------------- | ----------- | ---------- |
| Every `FAIL:` / test-count / probe line quoted in this report (17 quotes) | `scratch/{base-gates,base-gate3,base-gate3-curl,gates-run1,red-1,gates-final,canaries,stream-probe,abort-probe}.txt`, `scratch/baseline/tests.txt` | `bash scratch/selfcheck.sh <report>` greps each verbatim (`grep -F`) in its own file; result below |
| The generated block | `scratch/gates-final.txt`, `canaries.txt`, `mutations*.txt` | written by the same script |
| Non-vacuity | the same checks pointed at a copy of the scratch dir with `base-gates.txt` replaced by `gates-final.txt` | must exit 1 naming the missing base quotes; result below |

```
# selfcheck.txt
self-check: 17 quotes, 0 missing
generated block written (42 mutations red, 0 not)
selfcheck exit 0
# selfcheck-nonvacuous.txt (base-gates.txt replaced by gates-final.txt)
MISSING in base-gates.txt: No test files found, exiting with code 1
self-check: 17 quotes, 1 missing
non-vacuity exit 1
```

## Screenshots

Keyless `pnpm build` + `next start -p 3802`, IndexedDB seeded in the page (`scratch/seed.js`): a done and a
failed live run built from example `…t6m4`'s public events, and chat turns for `live:seed-done` and
`example:…t6m4`. **The answers in the screenshots are hand-written seed data, not model output** (no spend); the page
read them back from the `chats` store. Files in `scratch/shots/`:

| File | Shows |
| ---- | ----- |
| `01-live-done-desktop.png` | finished live run: report, two saved turns (CEO summary; "That isn't in this report." on crypto), chips, composer |
| `02-live-done-390.png` | same at 390 px; `scrollWidth - clientWidth = 0` |
| `03-live-failed-390.png`, `04-live-failed-desktop.png` | failed run: no chat (`chat: false`) |
| `05-example-desktop.png` | example page with its own saved turn, chips, composer |
| `06-reviewer-report-no-chat.png` | `/evals/reports/user-view/…t6m4`: report, no chat |
| `07-live-running-no-chat.png` | a real keyless run held at "Working for 12s" (the browser's `/api/run` fetch delayed in-page): no chat |
| `07b-live-failed-keyless-no-chat.png`, `08-live-interrupted-no-chat.png` | keyless run failed at ranking; an interrupted run: no chat |
| `09-keyless-question-503.png` | a real question from the live page to the keyless server: the alert shows "Answers aren't available right now. Try again in a minute.", the question returns to the composer, the saved turns stay (4) |

**Stubbed success path in the browser** (`11-stubbed-answer-after-reload.png`, keyless server on 3804, built from
`98ff4a3`): on `/examples/…0wdc` the page's `fetch` was patched for `/api/followup` only, answering four canned NDJSON
text lines 400 ms apart then `done` (labelled "STUBBED ANSWER (not a model)"). Clicking the "Summarize for the CEO
in 3 lines" chip: one second in, the answer showed its first pieces only (`midHasPartial: true`); at three seconds,
the full answer. The request body had exactly `context` and `messages`, with the 11 whitelisted context keys and
2 items. After a reload the page read the pair back from IndexedDB: `["Summarize for the CEO in 3 lines", "STUBBED
ANSWER (not a model): two items for Hearth this week, both owned in the report."]`. The SDK and the route are not
in this path; they are covered by `followup.test.ts` / `route.test.ts` and the lead's live check.

`02` was taken before `Clear conversation` was set to `whitespace-nowrap` (it wrapped onto two lines at 390 px).
`10-example-390-after-fix.png` is the rebuilt app at 390 px after the fix: one line (button height 24 px), page
`scrollWidth - clientWidth = 0`, the example's saved turn read back.

## How the three hard parts work

- **Retry that retries.** `streamText` (`ai` 7.0.179) returns before the request and reports failures in its stream
  (measured with mock models, `scratch/stream-probe.txt`: a rejected `doStream` yields `start, error`; an
  error chunk yields `start, start-step, error, finish-step, finish`; a thrown stream rejects the iterator). So
  `withRetry` wraps "start `streamText`, read parts until the first `text-delta`": an `error` part or a throw before
  any text retries (3 tries, 2 s / 4 s, policy injectable). The same iterator then feeds the response.
- **Streaming.** NDJSON lines `{type:"text"}`… then exactly one `{type:"done"}` or `{type:"failed", message}`.
  The client reuses `readNdjson` (now generic) with `fetch`; no new dependency.
- **Failure signal.** After text has gone out, an `error` part or a thrown iterator ends the stream with
  `{type:"failed", message: FOLLOWUP_FAILED}` (the SDK error, which can name a model, goes to the server log only).
  A stream that ends without `done` counts as failed in the browser too. Failed answers are not saved; the question
  goes back into the composer.

## Judgment calls

- **Caps** — `maxTurns 20` (messages, both roles, per request: 10 questions), `maxMessageChars 6000`,
  `maxContextChars 60000` (largest shipped example context ~25k; a test requires every example under half the cap),
  plus **`maxAnswerTokens 1000`**, a seventh key the amendment didn't list: without an output cap an answer could
  exceed `maxMessageChars` and make every later question a 400. A config test requires `maxAnswerTokens × 6 ≤
  maxMessageChars`.
- **At the turn limit** the route's sentence says "Clear it to ask more", so the composer offers "Clear conversation"
  (saves an empty chat). The pages pass only `suggestions` (amendment 1), so the browser does not know `maxTurns`.
- **Confirmed items** sit in their own `checkedByYou` list with `tier: "Not tiered"` rather than mixed into `items`,
  so the strict item schema keeps a required `tier`.
- **Strict server schema plus `assertPublicText`.** The plan's `{debug:{model:…}}` case is refused by the schema; the
  public check gets its own test with an internal name inside a whitelisted field (`screenedOut[0].title`), so each
  guard is caught only by itself. 400 sentences are fixed; the matched name goes to the server log.
- **`abortSignal: req.signal`** is passed to `streamText`, so a closed tab stops the answer (04's retro noted runs
  keep spending after a disconnect).
- **Answers render as plain text** (`whitespace-pre-wrap`); the system prompt asks for plain text and simple lists.
  No markdown renderer was added.

## Deviations from the plan

- **Test file names.** The Test Plan's `context.test.ts` / `route.test.ts` / `prompt.test.ts` became
  `followup-context.test.ts`, `followup.test.ts` (parse, prompt, stream) and `route.test.ts` (wiring), per T001 and
  the route-plus-sibling convention.
- **`ExampleView` split.** `ExampleReport` was extracted so the example mount condition is testable; `ExampleView`
  loads in an effect and a static render shows only "Loading".
- **`readNdjson` made generic** (reader.ts), reuse over a second NDJSON reader.

## Left alone

- **A profile whose text contains a vendor-style id** (`google/`, `openai/`, …, the `INTERNAL` patterns in
  `src/lib/pipeline/events.ts`), for example a custom profile mentioning "google/android", makes every question on
  that run a 400 whose sentence says to reload. This follows from amendment 3 (`assertPublicText` on the whole
  context); the run itself would have failed `assertPublic` the same way if such text reached an event.
- **`!res.body` in `askFollowUp`** is behaviour-equivalent to the `catch` below it (reading a null body throws, and
  with no text yet the catch answers `FOLLOWUP_UNAVAILABLE`), so no mutation of it can go red; it stays for the type
  narrowing `readNdjson` needs.

- The model could still name itself if asked; the system prompt forbids it, but no output filter runs on streamed
  text (a match would arrive split across pieces). The lead's live check should include "which model are you?".
- `/evals/reports/**` and `src/components/shell/*` untouched.
