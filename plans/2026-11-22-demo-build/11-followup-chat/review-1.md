# Chunk 11 review, iteration 1: FAIL

Gates re-run by reviewer: `AI_GATEWAY_API_KEY= PORT=3811 bash .../11-followup-chat/gates.sh` -> `chunk 11 gates: OK`
(810 tests, 58 files; full suite run a second time: 810 passed). poc/ count: HEAD tree 0, branch commits 0.
Reviewer mutations (each restored with git checkout, tree clean): drop `maxRetries: 0` -> 1 red; drop
`assertPublicText(context)` -> 2 red; drop question-last check -> 1 red.
Built output: model id `claude-sonnet-5.5` and the system prompt text absent from .next/static and .next/server/app.

## Blocking
1. `streamFollowUp` (src/app/api/followup/followup.ts, pull loop) never reads the `finish` part, so any stream that ends
   without an `error`/`abort` part emits `{"type":"done"}`. Probe through the real `streamText` against a mock
   `doStream` (scratch, deleted): text "Partial ans" then (a) stream closed with no finish chunk, (b) finishReason
   `length`, (c) finishReason `error` all produced `[{"type":"text",...},{"type":"done"}]`. A dropped upstream connection
   (SDK finishReason "interrupted") or an answer cut by `maxAnswerTokens` (1000) therefore reads as complete and is saved
   to IndexedDB. This is the case the terminal-line design exists to catch (lead concern 2; rubric "fixed, plain failure
   message if the stream fails"). No test covers it (tests only cover `error` parts and thrown iterators).
   Fix at the boundary: track the `finish` part; no finish or finishReason other than `stop` -> `failed` line (or, for
   `length`, a deliberate choice recorded in the report), with a constructed-stream test for each.

## Warnings
- Known gap (concern 4): `assertPublicText` runs on the whole context including `profile`, which is the GC's own text.
  "Google/Apple Pay" matches `\bgoogle\//i` (checked), so one such custom profile makes every question a 400 reading
  "Reload the page and ask again" (a dead end). The report's claim that the run would have failed `assertPublic` the same
  way is not supported: the profile is not carried in any public event and nothing else checks a live profile. Rubric
  asks for the whole-context check, so not blocking; smallest fix: run the check on the context minus `profile` (the
  strict schema already bounds its shape) or give a distinct sentence.
- No output filter on streamed text (concern 3): acceptable given the system prompt forbids naming model/vendor and the
  guard covers every input; the lead's "which model are you?" live check stands.
- Screenshot 10 (390 px): report item text appears clipped at the card's right edge. Not this chunk's file; scrollWidth
  was reported 0. Worth a look in the layout owner's chunk.
- Report's `configHash` `179451fef1` not re-derived by reviewer.
