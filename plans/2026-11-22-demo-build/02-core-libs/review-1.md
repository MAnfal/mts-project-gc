# Chunk 02 review, iteration 1: FAIL

Re-run by reviewer: `bash plans/.../02-core-libs/gates.sh` exit 0 (lint, 76/76 tests, build, parity OK,
no-fs-writes OK 9 files, typecheck). `git ls-tree -r HEAD | grep -c '^poc/'` = 0; same for
`git log --name-only feat/plan--demo-build..HEAD` = 0. Changed paths outside plans/config/src/lib:
.claude/resources/project.md, package.json, pnpm-lock.yaml (all in scope).
`config-hash-repro.sh` re-run: a-poc 9a0f857741, +brightside 0be380ec97, +app.yaml 34469504cc,
both a113914a72 = repo config/. git status clean afterwards.

## Blocking
1. Defensive branches in src/lib/config.ts have no test; deleting each leaves 76/76 green (reviewer
   mutations, restored, cmp-verified):
   - companies(): `id "x" must match the file name` throw (replaced by `if (false)`) -> 76 pass.
   - validateAll(): duplicate setup id check removed -> 76 pass.
   - jsonFile(): catch that wraps errors as `Config error in config/<rel>` replaced by `throw e` -> 76 pass.
   - readCached(): missing-file branch (new in this chunk) replaced by a throw -> 76 pass.
   Rubric: "for each defensive branch ... a test whose input cannot come from the committed fixture".
   The last two are new code written by this chunk.
2. No test shows config.ts rejecting a malformed config (rubric Test Coverage: "malformed fixture being
   rejected"). `validateAll()` is only asserted `[]` on the committed files. The report admits there is
   none and justifies it as "POC has none", but the rubric requires it. Only readYaml (chunk 01) tests
   rejection, not config.ts's own schemas.

## Warnings
- no-fs-writes.sh regex `writeFile|appendFile|mkdirSync|fs\.mkdir|writeFileSync` misses bare `mkdir(`
  (destructured import), `fsp.mkdir`, `createWriteStream`, `rename`, `rm`, `copyFile` (all MISS in a
  grep check). The rubric lists `mkdir`. Inherited from the plan's grep; widen it.
- project.md says "No filesystem writes in server code" but the gate scans only src/lib.
- Rubric asks for the hash difference "as the brightside edit alone"; the report says brightside plus
  chunk 01's app.yaml. The report is the accurate one; rubric wording is wrong.
- Report says POC has no malformed-fixture test; fine, but see Blocking 2.

## Lead's conclusions
1. gates.sh exit 0: confirmed.
2. configHash difference: sound. Reproduced the 4-row table; decision-path files byte-identical per
   parity.sh; project.md text matches measurements.
3. Scoping the gate to non-test files: legitimate. Plan's literal grep fires on chunk 01's
   load.test.ts:23-24 and tests write to os.tmpdir() only. Not weakening, apart from the regex gap above.

## Guidance
Add config.test.ts (or sibling) tests using a temp cwd/config copy or direct calls: malformed JSON week
-> `Config error in config/...`; missing file message; company id/file mismatch; duplicate setup id,
unknown prompt set, minAgree > judges via validateAll on a mutated copy; a schema rejection (e.g.
bad `use` value). Show each red under a deletion mutation. Widen the gate regex.
