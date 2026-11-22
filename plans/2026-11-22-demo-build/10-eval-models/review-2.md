# Chunk 10 review, iteration 2 (tip 5a10c2d): PASS

Scratch: /private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/review-10-i2/

## Observed (by the reviewer)
- git status empty at start and end (mutations restored by cp, status checked).
- Gate block (PORT=3721, keyless): exit 0, 48 files / 658 tests, no-typed-numbers OK, verify-eval-bundle OK, poc tree 0 / history 0 (gates.out).
- Node v24.13.0: `bash scripts/build-eval-bundle.sh` exit 0, `git status --short` empty (idempotent).
- Fix 1 (silent drop): models.ts throws "suite X lists setup Y, but index.json has no result for it in that suite" (boundary guard); constructed-index test present and also asserts the whole suite compares both. Mutation `if (false && missing) throw` -> that named test red (1 failed / 20 passed).
- Fix 2 (parity date): priceParity() in bundle-build.ts reads comment lines only containing "price parity" and "checked <date>", throws on none or on two dates; build-eval-index.mts writes index.json priceParity; schema requires it. Shipped index.json diff is +4 lines (priceParity only). Verify canaries: only `checkedOn` edited to 2026-11-22 -> "FAIL: index.json differs from the recomputation"; setups.yaml line 2 deleted -> "config/setups.yaml has no comment recording a price-parity check date". Mutation removing the two-date throw -> its test red. Date reaches the page through {{models.priceCheckedOn}}; story-schema.test.ts asserts the real sentence over the real YAML/bundle; story.test.ts shows a different date (2027-01-05) flows through. No date typed in YAML or components (needle added for it).
- Lead conclusions: parse reads comments only (test with a value line) and fails loudly; verify recomputes; "One suite" caveat uses {{models.suite}}, {{models.suiteWeeks}}, {{models.suiteEvalsets}}; key-bias counts are {{models.lowest.count}} / {{models.otherVendor.count}}; the guard surfaces an error through ModelsView LoadState, not "single model". All confirmed by reading.
- Rubric re-graded fresh: all items PASS (390 px and Cases drill-down runtime checks carried from review-1, rendering code unchanged since apart from caveat text; no shell, prompt, setups, judges or evalsets path in the diff).

## Issues
None.

## Warnings
- liveRule, the table footnote (judges judged only the first repeat; cost over every run) and the judges sentence ("grades the wording of every setup's actions alike") are typed claims about the shipped data, not computed. True now; no number in them.
- project.md configHash `bc2b5bdec1` not re-measured by the reviewer (config.ts imports server-only under tsx).
- The rendered priceParity sentence was verified through the tests over the real YAML and bundle, not re-screenshotted this iteration.
- project.md Models bullet is long and mixes several facts; passes the filter test but is a candidate to trim.

## Guidance
Merge-ready for the lead. Optional follow-ups: compute or drop the typed liveRule/footnote claims; re-measure configHash after chunk 06 merges.
