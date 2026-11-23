# Review 1 — chunk 03 — PASS

Observed by reviewer: gates.sh exit 0 (lint, test, build, typecheck, gate 2, gate 3, parity, no-fs-writes); unit suite run
3x (204 tests, 21 files, green); pipeline tests green with global fetch replaced by a thrower (no network);
`>=` -> `>` at run.ts:106 turns replay.test.ts red (3 failures), restore green, git status clean;
no `poc/` path in HEAD or the range; no `Jev p=`, saveRun, spentUsd, dotenv, VERCEL_AI_GATEWAY in src;
fixture trace and markdown cmp-identical to the POC files (run zxuc: done, cell jev-sonnet-strict-passages, 3 items).
Diffs vs POC: excerpts.ts identical; stages.ts differs only by server-only, imports, progress emit, itemReason, item.confirmed,
web-leads removal; run.ts differs only by event emission, retry scope, removed baseline/save. Cut and merge lines verbatim.
`ai@7.0.179`: generateText and decide both take maxRetries; sdk-retries mutations (9 / 12 calls) prove 0 is honoured.

Lead conclusions: (1) fr.ts retry not a decision change; getDoc -> null and govinfo -> FR fallback preserved, 4 tests in fr.test.ts.
(2) Not blocking; see warnings. (3) holds. (4) holds: replay asserts chunk counts and picked passages, unrecorded empty. (5) holds.

Warnings
- retry.ts RETRY comment says the 87 s run "stays far inside" 300 s; false under a govinfo/FR outage (up to ~240 s extra, sequential reads). Reword to the healthy case.
- A function-timeout at 300 s emits no run.failed; chunk 04 should handle a dropped stream (and consider a run-wide deadline).
- assertPublic `\bJEV\b` (case-sensitive) would fail a live run on a title containing "JEV" (an actual virus acronym); accepted tradeoff, rare.
- Replay stub answers 404 for an unrecorded URL rather than throwing; safe only because the test asserts `unrecorded` is empty.
