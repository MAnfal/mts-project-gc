# Review 1 - chunk 09 (tip afdd423)

Verdict: FAIL (rubric items below; code and gates otherwise sound).

Re-run by reviewer (Node 24.13.0, keyless):
- 03-pipeline/gates.sh exit 0 (39 files / 507 tests, build, parity, no-fs-writes)
- 04-run-and-report/gates.sh exit 0 (Gate 5: 13 GC chunks scanned)
- Gate 5 canary: `typesafe-ai` appended to src/components/gc/RunView.tsx, rebuild, gate exit 1 "internal name in a chunk a GC page loads"; restored.
- no-typed-numbers OK; verify-eval-bundle OK; poc tree 0 / history 0 (explicit counts)
- build-eval-bundle.sh rebuild leaves `git status` clean
- cases.test.ts 36 passed (per-suite report.json sums)
Browser (playwright-core, headless chromium, prod server on 3913, stopped):
- /evals/runs: 461 Raw trace links, 0 runs.jsonl.gz requests, 0 trace prefetches, only runs-index.json + trace-checks.json per suite
- Cases -> row -> "Run 3" link = 3 clicks for later repeat (8kdc, 1,933 events) and failed repeat (wqxz, 453 events)
- 2,104-event trace: 28 <li> rows at top and at bottom (last row #2103); search by doc number 3 hits, key-only word 0
- user-view trace: "No trace checks recorded"; 390 px scrollWidth 390 on trace, cases (row selected), runs

Blocking:
1. Rubric Run panel: "links 'Open this run's report'" and Run report section ("Open this run's report" renders items/tiers/owners/dates) are not implemented (plan amendment 2 moved it to chunk 06). Rubric wins; lead must amend the rubric or accept FAIL on these two items.
2. Rubric "any logic left in a component has a test": src/components/evals/CasesView.tsx:96-148 (iteration resolution, unknown iteration / evidenceOnly / no-comparedTo states, try/catch around casesForIteration) has no test; only browser JSON evidence. No *.test.* under src/components/evals.

Warnings:
- Gate 5 narrowing is correct under Decision 9 (GC-facing bundle only) and can fail (canary above, plus 0-chunk/missing-manifest dies in gates.sh:60-70). Residual: optional `runs/new/page?` silently skipped until it exists.
- evalsetInfo module not seen red first (admitted in report).
- Frame time measured by reviewer was vsync-bound (16.7 ms median); rows-in-DOM is the real evidence.
