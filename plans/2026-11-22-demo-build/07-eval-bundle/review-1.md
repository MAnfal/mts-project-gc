# Chunk 07 review, iteration 1: FAIL

Re-run by reviewer: lint/test/build/typecheck exit 0; verify-eval-bundle.sh OK (9 suites, 22 user-view, 8 iterations); du -sm = 111; no poc/ path in HEAD or branch diff; no poc-src/.worktrees import in src/; no react/node:/server-only in src/lib/evals non-test files.

## Blocking
1. Idempotence: rubric requires a second build to leave git status clean. Ran `bash scripts/build-eval-bundle.sh`: 9 `suites/*/manifest.json` modified (exportedAt only). Restored with `git checkout -- public/evals`; status clean after. Report and project.md document the churn, but the rubric item is unmet.
2. Defensive branches in scripts/build-eval-index.mts have no test that can go red: the superseded-append path (lines ~100-115, 0 real cases, report admits never exercised), the "misses eval sets" throw (~152), "no runs of setup" throw (~149), "expected one baseline setup" throw (~298). verify's canaries only mutate shipped data, none exercise these branches.

## Warnings
- README 94.6% relevance agreement is left unexplained (report says it did not trace the producer); rubric asks every difference explained.
- exportedAt fix idea: post-step in build script keeping the existing manifest when only exportedAt differs (no grading code edited).

## Lead's conclusions
(1) pooled baseline: labelled with both suites in `suite`, recomputed by `--check`; accept. (2) cost $0.1918: accept, explained by 72 vs 69 denominator. (3) judgePass runs 24: labelled; accept. (4) raw model ids in user-view runs: rubric requires byte-identical raw runs; no rubric item forbids; accept, chunk 06 projection. (5) build independent of poc-src: grep clean, build passes here.
