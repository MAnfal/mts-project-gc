# Chunk 06 review, iteration 1 — verdict FAIL (2 blocking, both small)

Evidence scratch: /private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/review-06-i1/

Re-run by reviewer: `AI_GATEWAY_API_KEY= PORT=3611 bash .../06-edge-states/gates.sh` exit 0 (681/681 tests, parity OK, no-fs-writes OK,
Gate 5 18 chunks, verify-eval-bundle OK, Gates 2-6 OK, typecheck); `pnpm test` second run 681/681; `03-pipeline/mutations.sh` all red->green, no FAIL;
poc counts 0 and 0; no src/components/shell path in the diff; no secrets; git status clean afterwards; server on 3612 stopped.

## Lead conclusions
1. Confirmed. Keyless `next start`, 390 px: `/examples/<l14a>` and `/examples/<t6m4>` scrollWidth 390 = clientWidth 390. Requests: the document, `/examples/index.json`,
   `/examples/<id>.json`, RSC prefetches of `/` and `/runs/new`; 0 URLs containing `/evals`; every body (13 JS chunks, JSON, HTML, RSC) clean against
   jev|typesafe-ai|claude-|anthropic/|openai/|google/|moonshotai/|stage ids|"cell/setup/model/prompt/calls/decisions". Control: the same harness on `/evals/runs` flags jev/"setup" bodies, so it can fail.
2. Confirmed. `CheckedRow` has no tier/deadline; row shows "Not tiered", deadline "None", owner = profile GC; seeded IndexedDB run: after Add + reload stored
   `confirmed:["2026-22246"]`, `events.length` stayed 12, tiers of items unchanged, "Held back 0"; no RunEvent type added.
3. Confirmed. Only the two message strings changed; replay/parity/mutations green; grep of src/config/design finds no "step again"/"only the failed step" copy (only a comment saying it must not).
4. Confirmed. Mutating `LEAKED_REASON` to `/^$/` -> the constructed-leak test goes red (assertPublic throws on the leaked name); to `/.*/` -> 2 tests red (real items change). Anchored shape, only matches `<word> p=<n> (no LLM reason)`.
5. Partly. One mapping (`recordedView`) feeds `recorded.ts` and `RecordedReport`. Reachable in 2 clicks (Evals -> Runs -> Report) for a suite run, an example run and the failed run czeo; read-only (0 buttons); no GC links. BUT see Issue 1.
6. Confirmed. Gate 3 rebuild leaves `public/examples` clean (gate output "Gate 3: 10 files ... scanned").

## Blocking
1. `src/components/evals/RecordedReport.tsx`: rubric item "renders the report ... in chunk 04's `ReportView`, sharing the examples' mapping (items, closest calls, held back, steps)" is FAIL.
   It hand-builds its own table (imports only `TIER_TONE` from ReportView), shows no closest calls, and renders its own held-back list. Plan amendment 8 did not name ReportView; the rubric wins.
   Fix at this boundary: render via ReportView (internal names allowed here) or have the lead rule in writing that the bespoke table is accepted; add closest calls.
2. Rubric: "the report lists the click count from /evals for one suite run, one example run and one failed run". `completion-report.md` has no such line (grep "click" hits only IndexedDB-click steps).
   Reviewer measured 2 clicks for all three (above); the report must state it.

## Warnings
- Rubric asks the confirmation round-trip and legacy-record cases in `store.test.ts`; they are in `reader.test.ts` (real fake-IndexedDB store, reload and "saved before confirmations existed" cases). Equivalent coverage, different file.
- Records stored before this chunk keep the old "Retry runs this step again" text in their stored `run.failed` message (events are never rewritten). Cosmetic; unflagged in the report.
- A recorded item with an empty `reason` (POC emits "" when no probability) is not given the neutral reason; none of the 9 shipped examples has one (checked), so latent only.
- `/examples/<missing>.json` answers 500 under `next start` when a file is deleted after boot (report says so); not reachable with committed files.

## Guidance
Fix Issue 1 (reuse ReportView or get the waiver, add closest calls) and Issue 2 (record click counts), re-run gates, then re-review; everything else holds.
