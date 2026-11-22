# Chunk 02 review, iteration 2: PASS

Tip df32868. Re-run by reviewer: `gates.sh` exit 0 (lint, build, parity OK, no-fs-writes OK 17 files, typecheck).
`pnpm test` x2: 11 files / 84 tests green both times. `git ls-tree -r HEAD | grep -c '^poc/'` = 0; same for
`git log --name-only feat/plan--demo-build..HEAD` = 0. No src/app, src/components, src/lib/pipeline changes.
Review-1 blockers: each deletion re-done by reviewer on config.ts lines 182, 251, 255, 259 (`if (false && ...`):
exactly the named config-validation test went red each time (1 failed / 7 passed); file restored, cmp clean,
git status clean.

## Lead's conclusion (chdir flakiness): not a defect, one note
- vitest 5.1.1, no pool config in vitest.config.mts -> default pool is forks, isolate on: one process per test
  file, so a chdir cannot leak across files. Also green with `--no-isolate --no-file-parallelism`.
- afterEach restores cwd unconditionally (runs after failing tests too); cwd is read before chdir, and chdir is
  the last fallible step in beforeEach except resetModules.
- `--pool=threads` fails (process.chdir unsupported in workers): 11 tests in config-validation AND fr-text.test.ts,
  which is a ported POC file that already used chdir. So the pattern is pre-existing, not introduced here.
## Warnings
1. Other defensive branches in ported, unchanged POC code still have no test whose input is off-fixture:
   config.ts 65 (filterVotes odd), 189 (Unknown company), 232/241, 256-257, 265-283 (validateAll model/method/
   areas/manifest/week/key checks); fr.ts:43 (`!res.ok` throw). Not new logic, review-1 did not list them.
2. project.md/config docs: `pnpm test` is forks-only in practice; threads pool breaks chdir tests. Worth one line
   or `pool: "forks"` pinned in vitest.config.mts so a future default change cannot silently break it.
3. Mutation survivors render-trim / hash-no-path acknowledged in report; hash-no-path covered only by a one-off.
