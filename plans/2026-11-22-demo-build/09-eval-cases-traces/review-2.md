# Review 2 - chunk 09 (tip db98f60)

Verdict: FAIL (one small blocking item, a comment the change made false). Everything else passes.

Re-run by reviewer (Node 24.13.0, keyless):
- 03-pipeline/gates.sh exit 0 (40 files / 521 tests, lint, build, typecheck, parity, no-fs-writes)
- 04-run-and-report/gates.sh exit 0 (Gate 5: 13 chunks, skip of optional /runs/new now logged)
- no-typed-numbers OK; verify-eval-bundle OK (9 suites, 22 user-view runs, 8 iterations)
- build-eval-bundle.sh rebuild: git status empty. poc in HEAD 0, in history 0, shell diff 0 lines
- Mutations on casesState.ts (restored, status clean): drop suite-not-in-bundle guard -> 1 red; activeFilter ignores offered choices -> 1 red
- Prod server 3922 (stopped): iterations 00-07, 99-nope, none -> filters/row counts identical to evidence/iterations-00-07.json; no console errors

Run-report items: rubric amended (N/A, chunk 06). i1 blocking 1 resolved. i1 blocking 2 resolved: CasesView logic is in casesState.ts with 14 tests.

Blocking:
1. src/lib/evals/story.ts:10-13: the extraction inserted iterationNumber between formatShare's doc comment ("A share as a percent ...") and formatShare. The share comment now documents iterationNumber's neighbour, and formatShare has none. Move iterationNumber (and its comment) above that comment.

Warnings:
- Lead's "no behaviour change" is slightly off: a recorded iteration with no setup/suite, or naming a suite the bundle lacks, now shows an error state (before: blank or endless "Loading"). Disclosed and tested; an improvement.
- project.md Layout line for casesState.ts makes an over-long line.
- completion-report has two gates.sh rows in the table.
