# Chunk 11 review, iteration 2: PASS

Tip 31769d4. Gates: `AI_GATEWAY_API_KEY= PORT=3821 bash .../11-followup-chat/gates.sh` -> `chunk 11 gates: OK` (re-run by reviewer).
`pnpm test` twice: 58 files, 816 passed both times. poc/ count: HEAD tree 0, branch commits 0. No shell, evals, ReportView,
pipeline, gateway or decision-config path in the diff. Ports 3821-3829 free after the run. Tree clean.

Reviewer mutations on src/app/api/followup/followup.ts (each restored with git checkout):
- `finishReason === "stop"` -> `true`: 3 red (no finish, length, error cases).
- `length` branch -> plain FOLLOWUP_FAILED: 1 red (the length sentence test).
- context check on `context` instead of `report` (profile back in): 2 red (Google/Apple Pay parse and route tests).
- context check removed: 2 red (internal model in a whitelisted field, parse and route).
The finish tests drive the real `streamText` against MockLanguageModelV4 `doStream` (fixture `finish: "none"|"length"|"error"`).

Lead concern: the rendered prompt is `config.system` (checked statically by assertPublicText) plus `JSON.stringify(context)`;
`{{report}}` is its only placeholder (schema-enforced), so nothing else is added. The context check minus `profile` still
covers items (titles, reasons, actions, citations, urls = sources), checkedByYou, heldBack, screenedOut, company, window.
Only the profile, the GC's own text, is unchecked; it is in no public event.

Warnings: profile unchecked for internal names (accepted trade-off, documented in project.md); unchanged i1 warnings
(no output filter on streamed text; 390 px screenshot clipping in report item text, not this chunk's file).
