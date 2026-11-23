# Chunk 04 review, iteration 1: PASS

Re-run by the reviewer on HEAD d454de0 (no Gateway key, ports 3411 only, server killed, `git status` clean).

- `PORT=3411 AI_GATEWAY_API_KEY= bash .../04-run-and-report/gates.sh`: exit 0, `chunk 04 gates: OK` (03 gates, 400 on a 30-day window, no `poc/`, no value import from `pipeline/events`, no internal name in `.next/static`).
- `no-typed-numbers.sh` OK; `verify-eval-bundle.sh` OK. `pnpm test` twice: 34 files / 404 tests green both times. Also green with global `fetch` replaced by a thrower (temp vitest config in scratch).
- Mutations I applied and restored: stream `ended` guard removed -> "never sends a second terminal event" red; reader final flush removed -> "reads a last line that has no trailing newline" red; inclusive `+ 1` removed -> 2 request tests red.
- Seeded IndexedDB (recorded replay events, Brightside profile) on `pnpm start`: Report renders every required part; `scrollWidth` 1280 and 390 (no sideways scroll); reopening `/runs/<id>` made no `/api/` request; a stale `running` record loads as `interrupted` with Retry and the can't-resume sentence; stored record keys are `id,createdAt,request,events,status,result,profile` and the events contain no model id or score.
- Keyless live POST: events `run.start, step.start scan, step.done scan, step.start rank, step.failed rank, run.failed rank`, exactly one terminal event, `application/x-ndjson`. Disconnect (`curl --max-time 1`) left the server serving, no unhandled/invalid-state error in the log. Bodies: brightside 400, 8-day 400, 7-day accepted, `x` 400, malformed custom 400.
- Screenshots: `.../scratchpad/review-04-i1/report-desktop.png`, `report-390.png`, `stale-390.png`.

Warnings are in the verdict message.
