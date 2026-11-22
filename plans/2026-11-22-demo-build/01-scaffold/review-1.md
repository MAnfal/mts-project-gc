# Chunk 01 review, iteration 1: FAIL (one blocking issue)

Observed: `PORT=3111 bash gates.sh all` exit 0 (all four gates, nothing left on 3111). No `poc/` path in HEAD or in any commit of feat/plan--demo-build..HEAD. `/` shows as dynamic (f) in the build output, not static: the lead's conclusion (2) was wrong, and the report (connection()) is right.

## Issue
- `src/lib/config/load.ts` `(root)` branch (`issue.path.length ? ... : "(root)"`) has no test. An empty or scalar YAML file (data null) reaches it; no test in load.test.ts has such input (grep "root" in the test file: 0 hits). Rubric: every defensive branch needs a test the committed fixture cannot supply. Add a test (empty file -> `Config error in config/x.yaml: (root): ...`).
- Same family: `.refine(Number.isFinite)` in seconds.ts is never exercised (no "Infinity" case; grep: 0). Either test it or delete it if zod already rejects Infinity.

## Warnings
- route.test.ts "keeps every clamped value inside 1-120" asserts constants equal [1,5,120]; it checks nothing about behaviour.
- Browser measurements (390 px no sideways scroll, computed styles) were not saved; the report says so itself. Not reproduced by me.
- maxDuration test passed against the stub, as the report admits; it only guards regressions.
