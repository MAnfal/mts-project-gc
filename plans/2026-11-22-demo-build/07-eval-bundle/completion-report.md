# Chunk 07 — Completion Report

Branch `feat/demo-build--eval-bundle`, base `9d08486` (`git merge-base HEAD feat/plan--demo-build`).
Bundle built from `poc` at `d9e69e02dec0cd70e1aaf32b7b7d0e26f884d730`. No model was called and
nothing was spent: export and grading read recorded runs only, and the POC's gateway key is set to
the dummy value `offline-no-model-calls` in every script that loads POC code.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `src/lib/evals/index-schema.ts` | created | zod contract for `public/evals/index.json` and `user-view/index.json`. Every live/baseline number is `{value, split, runs, suite}`; a `superRefine` also rejects a number filed under the wrong split slot. |
| `src/lib/evals/index-schema.test.ts` | created | Schema accepts a minimal index and rejects unlabelled, split-less, run-less, mis-slotted and suite-less numbers; validates the **real** committed `index.json` and `user-view/index.json`. |
| `src/lib/evals/loader.ts` | created | Browser reader: `loadIndex`, `loadSuiteRuns`, `loadTrace` (async generator), `USER_VIEW`. Uses fetch → `DecompressionStream("gzip")` → incremental line parse. A 0-byte file reads as an empty trace. |
| `src/lib/evals/loader.test.ts` | created | Loader against a constructed bundle in a temp dir via a fetch stub, plus one test reading the **real** shipped index, du8 runs and a du8 trace. |
| `scripts/poc-src.sh` | created | Sourced by the build and verify scripts. Locates the main checkout via `git rev-parse --git-common-dir`; creates `<main>/.worktrees/poc-src` (detached `poc`) if absent; fails if its HEAD ≠ `poc` or tracked files are edited; runs `pnpm install --frozen-lockfile` in its `poc/`. |
| `scripts/build-eval-bundle.sh` | created | T003: export all 9 suites with the POC's `export.mts`, then assemble `public/evals/`, then run the index builder. Documented at the top. |
| `scripts/build-eval-index.mts` | created | T004: derives `index.json`, `iterations/*/iteration.json` and `user-view/index.json` with the POC's `suiteReport`, reading only the shipped bundle. Build mode also appends any run `arenaRuns()` skipped (flagged `superseded`). `--check` recomputes everything and byte-compares. |
| `scripts/verify-eval-bundle.sh` | created | T005: the nothing-lost gate against `git archive poc`, plus `build-eval-index.mts --check`. Names every failing file, then exits 1. |
| `public/evals/**` | generated (745 files) | T006: committed in its own commit, `7b541e1`. |
| `.claude/resources/project.md` | edited | T007: Layout (the four scripts, `public/evals/` tree, `src/lib/evals/`), four Conventions (generated bundle, the POC checkout, labelled numbers, browser loader), and one Convention Map row for `public/evals/**` and the eval scripts (gate: `bash scripts/verify-eval-bundle.sh`), so later rubrics pick up the verify gate. Stack and Commands untouched (parallel wave). |
| `plans/2026-11-22-demo-build/07-eval-bundle/plan.md` | edited | Tasks ticked. |

**Commands line for the lead** (project.md → Commands, not applied by this chunk):

| Gate | Command |
| ---- | ------- |
| Rebuild the eval bundle | `bash scripts/build-eval-bundle.sh && bash scripts/verify-eval-bundle.sh` |

No dependency was added. POC scripts run under the POC checkout's own `tsx` 4.23.15
(`<main>/.worktrees/poc-src/poc/node_modules/.bin/tsx`).

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| For every one of the 9 arena ids on `poc`, the run count in `runs.jsonl.gz` equals the count of `runs/*.json` | yes | `bash scripts/verify-eval-bundle.sh` prints `suite <id>: runs N, traces N` for all 9 and `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)`. It also checks every run record equals poc's JSON by id. Canary `drop-run-line` → exit 1. |
| Every trace on `poc` is in `traces/` with identical bytes | yes | `cmp` per trace, plus a file-count check (catches extras). Canaries `delete-trace`, `flip-trace-byte`, `extra-trace` → exit 1, naming the file. |
| Same for user-view (all 22 runs, failed included) | yes | Run files `cmp`'d; 13 of 22 have status `error`. 16 traces are plain `.jsonl` on poc: they ship gzipped and verify compares `gunzip -c` output with poc's bytes (see Deviations). Test `user-view/index.json validates and keeps the failed runs`. Canaries `edit-user-view-run`, `delete-user-view-trace` → exit 1. |
| Every `poc/data/iterations/*` dir has an entry | yes | 8 of 8 (00–07) have `iteration.json`, and every POC file in each dir is byte-identical. Canary `remove-iteration` → exit 1. |
| `index.json` validates against `index-schema.ts` | yes | Test `index.json validates and labels the live setup's pooled recall` parses the committed file. |
| `live.recall.all` equals `suiteReport` recomputed over that setup's runs in the two 06 suites, from the shipped `runs.jsonl.gz` and shipped keys | yes | `build-eval-index.mts --check` (in verify) sets `POC_CONFIG_DIR=public/evals/config`. It decodes runs from the shipped `runs.jsonl.gz` and points the POC's trace lookup at the shipped `traces/`. It then byte-compares the whole recomputed `index.json`. Inclusion rule = `suiteReport`'s own: 72 runs, 69 graded (3 `error` runs). Canaries `perturb-live-recall`, `readme-dev-precision`, `edit-shipped-key` → exit 1. The last one moves live recall to 0.892, so the recompute does read the shipped keys. |
| `public/evals` ships as static files; no route imports them into a server bundle | yes | After `pnpm build`: 0 of 4 `.nft.json` files list `public/evals`, and 0 of 118 files under `.next/server` match `runs\.jsonl\.gz\|arena-2026`. `pnpm lint && pnpm test && pnpm build && pnpm typecheck` passed with the POC checkout moved away (`git worktree move` to `poc-src-away` and back, on `2e38861`). Served by `pnpm start` as static files (below). |
| Bundle size reported, total under 150 MB | yes | 114,763,336 bytes, `du -sm` = 111 MB (tables below). |

### Per-suite counts and bytes

Generated from the bundle by a script (`find`, `stat -f %z`, `gunzip -c | grep -c .`), not typed:

| Suite | Runs (runs.jsonl.gz) | Traces | runs.jsonl.gz bytes | traces/ bytes | suite dir bytes |
| --- | --- | --- | --- | --- | --- |
| `arena-2026-11-21-18-40-w0i` | 90 | 90 | 6980397 | 14522070 | 21653766 |
| `arena-2026-11-21-20-41-gip` | 36 | 36 | 648051 | 5058200 | 5770825 |
| `arena-2026-11-21-21-04-ly9` | 1 | 1 | 49909 | 175770 | 231643 |
| `arena-2026-11-21-21-23-64r` | 72 | 72 | 1897900 | 10827399 | 12844594 |
| `arena-2026-11-21-21-45-cb0` | 18 | 18 | 4078181 | 4227475 | 8329729 |
| `arena-2026-11-21-22-04-jq4` | 72 | 72 | 1304629 | 10197717 | 11621662 |
| `arena-2026-11-21-22-48-27v` | 6 | 6 | 238481 | 3325682 | 3578599 |
| `arena-2026-11-21-22-52-l92` | 72 | 72 | 1937311 | 18928717 | 20985893 |
| `arena-2026-11-21-23-16-du8` | 72 | 72 | 1889274 | 18822069 | 20831504 |

| Part | Files | Bytes |
| --- | --- | --- |
| `suites/` | 475 | 105848215 |
| `user-view/` | 45 | 4915786 |
| `iterations/` | 193 | 967312 |
| `config/` | 31 | 2984001 |
| `index.json` | 1 | 48022 |
| **total** | 745 | 114763336 |

du -sm public/evals: 111 MB; du -sh: 111M

### Local stand-in for user checkpoint 2

`pnpm build && pnpm start -p 3702` (re-run after the final code commit), captured with `curl -D/-o/-w` to separate files; this block was
generated from those files:

`/evals/index.json` — `curl -w "%{http_code} %{content_type} %{size_download}"`:

```
200 application/json; charset=UTF-8 48022
```

`/evals/suites/arena-2026-11-21-23-16-du8/traces/2026-11-21T23-16-59-577Z_pipeline_84s4.jsonl.gz` (request sent `Accept-Encoding: gzip, br`):

```
200 application/gzip 150516
```

Trace response headers, verbatim:

```
HTTP/1.1 200 OK
Accept-Ranges: bytes
Cache-Control: public, max-age=0
Last-Modified: Sun, 22 Nov 2026 18:47:44 GMT
ETag: W/"24bf4-1a20495ed81"
Content-Type: application/gzip
Content-Length: 150516
Date: Sun, 22 Nov 2026 18:59:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Content-Encoding header lines in the trace response: 0.

`cmp` of served bytes to the files on disk: index exit 0, trace exit 0.

The server was killed afterwards; `lsof -iTCP:3702 -sTCP:LISTEN` returned 0 lines.

Self-check of this report: the status/content-type lines in this section, and the stats and numbers
tables, were inserted into this file by a script from the captured files (`index.meta`,
`trace.meta`, `stats.md`, `numbers.md`); none were typed. `grep -qxF "$(cat index.meta)"` and the
same for `trace.meta` both exit 0 against this file. As a non-vacuity probe, the altered line
`200 application/gzip 150517` is not found (exit 1).

## Live and baseline numbers vs the POC README

Generated from the shipped `index.json` by a script. `runs` is the denominator `suiteReport` used
(graded / finished / all / panel-bearing, per metric; see `project.md` → Conventions).

**live** `jev-sonnet-strict-passages` over `arena-2026-11-21-22-52-l92` + `arena-2026-11-21-23-16-du8`; runCounts all {"total":72,"finished":69,"graded":69}, dev {"total":36,"finished":34,"graded":34}, test {"total":36,"finished":35,"graded":35}

| Metric | all (runs) | dev (runs) | test (runs) |
| --- | --- | --- | --- |
| recall | 0.8981 (69) | 0.9123 (34) | 0.8824 (35) |
| precision | 0.8151 (69) | 0.9123 (34) | 0.7258 (35) |
| trapAvoidance | 0.9757 (69) | 0.9887 (34) | 0.9633 (35) |
| datesRight | 1.0000 (69) | 1.0000 (34) | 1.0000 (35) |
| tierRight | 1.0000 (69) | 1.0000 (34) | 1.0000 (35) |
| ownerRight | 0.9897 (69) | 0.9808 (34) | 1.0000 (35) |
| judgePass | 0.8601 (24) | 0.8605 (12) | 0.8596 (12) |
| consistency | 0.9124 (69) | 0.9232 (34) | 0.9015 (35) |
| traceChecks | 1.0000 (69) | 1.0000 (34) | 1.0000 (35) |
| score | 0.9349 (69) | 0.9490 (34) | 0.9215 (35) |
| costPerRunUsd | 0.1918 (72) | 0.2066 (36) | 0.1770 (36) |
| secondsPerRun | 63.0 (69) | 63.2 (34) | 62.9 (35) |

**baseline** `baseline-sonnet` over `arena-2026-11-21-18-40-w0i` + `arena-2026-11-21-21-45-cb0`; runCounts all {"total":36,"finished":36,"graded":36}, dev {"total":18,"finished":18,"graded":18}, test {"total":18,"finished":18,"graded":18}

| Metric | all (runs) | dev (runs) | test (runs) |
| --- | --- | --- | --- |
| recall | 0.6333 (36) | 0.6364 (18) | 0.6296 (18) |
| precision | 0.6909 (36) | 0.6774 (18) | 0.7083 (18) |
| trapAvoidance | 0.9639 (36) | 0.9573 (18) | 0.9705 (18) |
| datesRight | 0.7895 (36) | 0.7143 (18) | 0.8824 (18) |
| tierRight | 0.9474 (36) | 0.9524 (18) | 0.9412 (18) |
| ownerRight | 0.9474 (36) | 0.9048 (18) | 1.0000 (18) |
| judgePass | 0.5500 (12) | 0.4783 (6) | 0.6471 (6) |
| consistency | 0.8701 (36) | 0.8652 (18) | 0.8750 (18) |
| traceChecks | 0.9167 (36) | 0.9222 (18) | 0.9111 (18) |
| score | 0.7942 (36) | 0.7744 (18) | 0.8195 (18) |
| costPerRunUsd | 0.5195 (36) | 0.5236 (18) | 0.5154 (18) |
| secondsPerRun | 37.7 (36) | 40.9 (18) | 34.4 (18) |

| README figure (poc `README.md`, "Findings") | README | Shipped `index.json` | Match |
| --- | --- | --- | --- |
| Live recall (dev / test) | 89.8% (91.2 / 88.2), "69 runs pooled" | 0.8981 (0.9123 / 0.8824), 69 graded of 72 | yes |
| Live precision (dev / test) | 81.5% (91.2 / 72.6) | 0.8151 (0.9123 / 0.7258) | yes |
| Live dates / tier / trace checks | 100% / 100% / 100% | 1.0 / 1.0 / 1.0 | yes |
| Live cost per run | $0.20 | $0.1918 over 72 runs | **no**, see below |
| Baseline recall / precision / dates / cost | 63% / 69% / 79% / $0.52 | 0.6333 / 0.6909 / 0.7895 / $0.5195 (36 runs, w0i + cb0) | yes |
| "Relevance agrees across 3 runs" | 94.6% of keyed docs | not in index; `consistency` 0.9124 is a different measure | n/a — see below |
| Previous live (`strict`), same two suites | recall 86.3%, precision 78.9% | `suites/*/report.json` (not in `live`); a probe with the POC's suiteReport gave 0.863 / 0.789 | yes |

Differences, explained:

- **Agreement (94.6%) vs `consistency` (0.9124).** `consistency` is `suiteReport`'s pass^k at the
  largest k (`suite.ts`: `pass[pass.length - 1].value`), the share of cases right in every repeat.
  The README's 94.6% is per-doc relevance agreement across repeats. No field of `suiteReport`'s
  output computes it, and this chunk did not trace which POC script produced it (`grep -rln agree
  scripts src/lib` on poc finds only `error-analysis.mts`, `panel.ts`, `trace-checks.ts` and
  `pipeline/stages.ts`, none of which emits that figure under that name). The index doesn't carry
  it, and no README figure was copied in.
- **Cost per run: $0.1918 vs the README's $0.20.** `suiteReport`'s `costPerRun` divides the
  pooled cost by all 72 runs. The 3 failed runs spent money too, so they stay in the
  denominator. Dividing by the 69 finished runs gives 0.2001 (measured from the shipped
  `runs.jsonl.gz` with the same cost sum as `suite.ts`), which is the README's figure. The index
  keeps `suiteReport`'s value and labels it `runs: 72`. For the baseline both ways give 0.5195,
  because none of its 36 runs failed.
- **"69 runs".** The folders hold 72 runs of the live setup. Three ended in `error` (Gateway outages:
  2 in dev, 1 in test), so `suiteReport` graded 69. Both counts ship: `runCounts.all = {total 72,
  finished 69, graded 69}`.

## Tests

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| `index-schema.test.ts` (all 8) and `loader.test.ts` (all 10) | `Error: Cannot find module './index-schema'` / `'./loader'`; `Test Files 2 failed (2)`, `Tests no tests`. **Import red only.** | `Tests 18 passed (18)` |
| `the shipped public/evals bundle` › 3 real-data tests | After the implementation, before the bundle existed: `ENOENT: no such file or directory, open '…/public/evals/index.json'` (and `user-view/index.json`); `Tests 3 failed \| 15 passed (18)`. Absence red. | green after T006; full suite `Tests 40 passed (40)` |

Import and absence reds prove nothing about the assertions, so each contract was also broken on
purpose (final code, one mutation at a time, restored with `cp`, `cmp` confirmed):

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| A number without `runs` is rejected | `runs: z.number()…` → `.optional()` | `rejects a number missing its run count` |
| A number without `split` is rejected | `split: SplitSchema.optional()` **and** slot refine disabled (either one alone still rejects it, because the refine also fires on a missing split) | `rejects a number missing its split`, `rejects a number filed under the wrong split` |
| Metrics are labelled numbers, not plain | `METRICS.map((m) => [m, z.any()])` | all 5 rejection tests, including `rejects a plain number where a labelled number is required` |
| Trace is gunzipped, not `res.json()` | `loadTrace` yields `await res.json()` | 6 trace tests plus the real-bundle test |
| Trailing newline doesn't produce a parse error | final remainder parsed unconditionally | `parses every run in runs.jsonl.gz, ignoring the trailing newline export.mts writes` (+4) |
| Lines are parsed lazily | buffer the whole body, then parse | `parses lazily: the first event arrives before a later bad line is reached` |
| 0-byte trace = empty | `if (bytesIn === 0) return;` removed | `yields nothing for a 0-byte trace file` |
| User-view traces resolve under `user-view/` | `suiteId === USER_VIEW` → `false` | `reads user-view traces from user-view/traces/` |

## Gates

Baseline before any change (`pnpm typecheck`, `pnpm lint`, `pnpm test` on `9d08486`): 0 type
errors, 0 lint problems, `Tests 22 passed (22)`. Logs are in the session scratchpad under `chunk-07/baseline/`.
Every gate below was re-run after the last code edit; the type check ran last in the standard block.

| Gate | Command | Result | Fails on base? |
| ---- | ------- | ------ | -------------- |
| Standard | `pnpm lint && pnpm test && pnpm build && pnpm typecheck` | exit 0; `Tests 40 passed (40)` (22 base + 18 new). Also exit 0 with the POC checkout moved away; that run was on `2e38861`, before the `judgePass` label fix, which touched only the index script, a schema comment, `project.md` and `index.json`. | The new tests don't exist on base, so on base this proves nothing about the chunk. The chunk's own red runs are in Tests above. |
| 2: nothing lost | `bash scripts/verify-eval-bundle.sh` | exit 0: `verify-eval-bundle: OK (9 suites, 22 user-view runs, 8 iterations)`, `index check: 10 generated files match` | Base tree: exit 1, `FAIL: …/public/evals does not exist`. Per-assertion canaries below. |
| 3: size budget | `size=$(du -sm public/evals \| cut -f1); [ "$size" -lt 150 ]` | `bundle MB: 111` | Base tree: exit 1, `du: public/evals: No such file or directory` … `FAIL: bundle  MB`. That fails on absence, not size. Size comparison probe (threshold 100 on the real bundle): exit 1, `FAIL: bundle 111 MB`. |

**Gate 2 canaries** (`verify-eval-bundle.sh`, one per assertion, each restored with `cp`, never git; the final clean run was exit 0 and `git status` was clean):

| Canary | Exit | First FAIL line |
| ------ | ---- | --------------- |
| delete a du8 trace (plan's required probe) | 1 | `FAIL: suite arena-2026-11-21-23-16-du8: missing …/traces/2026-11-21T23-16-59-577Z_pipeline_84s4.jsonl.gz` |
| flip one byte in that trace | 1 | `… traces/2026-11-21T23-16-59-577Z_pipeline_84s4.jsonl.gz differs from poc` |
| add an extra trace | 1 | `FAIL: suite arena-2026-11-21-23-16-du8: 73 trace files shipped, poc has 72` |
| drop the last line of du8 `runs.jsonl.gz` | 1 | `FAIL: suite arena-2026-11-21-23-16-du8: runs.jsonl.gz has 71 runs, poc has 72` |
| remove `iterations/06-passages` | 1 | `FAIL: iteration 06-passages: missing iterations/06-passages/iteration.json` |
| set `live.recall.all.value = 0.899` | 1 | `FAIL: index.json differs from the recomputation over the shipped bundle` |
| set `live.precision.dev.value = 0.912` (README's rounded figure) | 1 | `FAIL: index.json differs from the recomputation over the shipped bundle` |
| append a byte to a user-view run | 1 | `FAIL: user-view: runs/2026-11-21T19-22-35-745Z_pipeline_xzrc.json missing or differs from poc` |
| delete a user-view trace | 1 | `FAIL: user-view: missing …/user-view/traces/2026-11-21T19-22-35-745Z_pipeline_xzrc.jsonl.gz` |
| drop one `relevant` doc from shipped key `skyhop_2026-11-02_2026-11-06` | 1 | `FAIL: config/ differs from poc/config`, then 6 `report.json` and `index.json` recompute failures (live recall → 0.892) |

**Idempotency.** Built twice, then `diff -rq` between the two outputs: the only differences are the 9
`suites/*/manifest.json`, all on `exportedAt` (e.g. `18:45:18.576Z` vs `18:46:32.597Z`).

**No `poc/` path committed:** `git diff --cached --name-only | grep '^poc/' | wc -l` → 0 before
the data commit; `git status --short | grep ' poc/'` was empty before every commit.

## Judgment calls

- **`build-eval-index.mts` lives on this branch and imports the POC modules from the POC checkout
  by path.** It doesn't copy itself into the POC worktree. The imports are computed (`import(path.join(pocDir,
  "src/lib/suite.ts"))`), so `tsc`, eslint and `next build` never follow them, and the app builds
  without the checkout (measured). It runs under the POC's own `tsx`, so `suite.ts`, `config.ts` and
  their dependencies resolve from the POC's `node_modules`, unmodified. `poc-src.sh` refuses to run
  if the checkout differs from `poc` or has edited tracked files. Copying the script in would have
  left untracked files in a checkout that "removes nothing", and put the reviewed code off this
  branch.
- **One code path for build and verify.** The index builder reads the shipped bundle, not the POC's
  `data/`: runs from `runs.jsonl.gz`, keys from `public/evals/config` via `POC_CONFIG_DIR`, traces
  through a temp `data/evals/<id>/traces` symlink view for the POC's trace checks. So `--check` is
  the same computation over what ships, and it also confirms that each `report.json` from `export.mts`
  is reproduced exactly.
- **Baseline pools `w0i` + `cb0`, not "the latest suite where it ran"** (see Deviations).
- **Live suites are a constant, live setup comes from config.** `LIVE_SUITES` names the two 06
  suites, as the plan does. The setup is read from the shipped `experiment.yaml` → `userView.setup`;
  the baseline setup is the single `method: baseline` setup in `setups.yaml`. The builder throws if
  the pooled runs miss any eval set in the manifest, so a wrong suite list fails loudly.
- **Metric denominators.** `runs` on each number is what `suiteReport` averaged over. That is graded
  runs for key-graded metrics and `score`, finished runs for `traceChecks` and `secondsPerRun`, all
  runs for `costPerRunUsd`, and, for `judgePass`, the runs that carry a judge panel. The POC
  judges only the first repeat (`arena.ts`: `!w.run.config.repeatIndex`), so live `judgePass` rests
  on 24 runs (12 dev / 12 test), not 69, and baseline on 12, not 36. The first build labelled
  `judgePass` with the finished count. That was caught in review and fixed in `53fc0a1`/`3752e05`:
  only the six `judgePass.runs` fields changed, no value did. `suite` is an array, because pooled numbers
  span two suites.
- **Iterations ship verbatim, plus `iteration.json`.** The layout lists only `iteration.json` and
  three evidence files. "Lose nothing" covers each iteration's `spec.yaml`, `iteration.yaml` and
  `config/` snapshot too (193 files, 0.97 MB), so all are copied and verified byte for byte.
  `iteration.json` = `spec.yaml` overlaid by `iteration.yaml`. `07-next` (evidence only) gets
  `{id, evidenceOnly: true}`.
- **Loader scope.** Beyond the three planned functions, `loadTrace` takes `USER_VIEW` to reach
  `user-view/traces/`. Without that, the 22 example traces this chunk ships would have no reader.
  It is one line, and tested.

## Deviations from the plan

- **Baseline: "latest suite where it ran" → pooled `w0i` + `cb0`.** (Messaged to the lead
  mid-chunk; no reply came, so the chunk proceeded on it.) No single suite ran
  `baseline-sonnet` on all four weeks. `w0i` has only the November weeks and `cb0` (the latest) only
  the October weeks, while live covers all four. `cb0` alone gives recall 0.444 / precision 0.444 on
  half the weeks, which is not comparable. The pooled 36 runs give 0.633 / 0.691, matching the README
  and Design Decision 10's scoreboard 63/69. Each single-suite figure is still in that suite's
  `report.json`. It is one constant (`BASELINE_SUITES`) to switch.
- **User-view traces: 16 of 22 are plain `.jsonl` on `poc`.** The layout wants `.jsonl.gz`, so these are
  gzipped with `gzip -n -9`, which is byte-stable. Their "identical bytes" check compares the decompressed
  bytes with poc's file. The other 6, and all 439 suite traces, are byte-identical as files.
- **Size: 114.8 MB (`du -sm` 111), not ~97 MB.** It is under the 150 MB gate. Measured against the
  plan's estimate: suite traces 86.1 MB (est. ~82), `runs.jsonl.gz` 19.0 MB (est. ~13), user-view
  4.9 MB (est. ~2), shared `config/` 3.0 MB (not in the estimate), iterations 0.97 MB, and
  per-suite `manifest`/`report`/`trace-checks` JSON 0.74 MB. That is 745 files, well under Vercel's
  15,000-file cap. It is above the 100 MB CLI cap, which the plan says doesn't apply to Git deploys.
- **Superseded runs: 0.** `arenaRuns()` skipped no run file in any suite (every run's
  `config.arena` matches its folder; none has a `Superseded` error). The append-with-`superseded`
  path is implemented but **has not been exercised** against real data. Verify still guards the
  outcome: run ids and count must equal poc's.
- **`export.mts`'s per-suite `user-view/` output is not used.** It contains only `status === "done"`
  runs (9 of 22). User-view is taken from `poc/data/user-view` directly.

## Left alone

- **Model ids reach the browser through example runs.** `user-view/runs/*.json` are the POC's raw run
  records (byte-identical, as required), so they contain model ids such as
  `anthropic/claude-sonnet-5.5` and internal stage names. Chunk 06 serves example runs on GC-facing
  pages, where Design Decision 9 forbids internal names in network responses. Chunk 06 needs to
  read a projection, or the lead needs to decide; this chunk keeps the raw records.

- `manifest.json`'s `exportedAt` makes 9 files churn on every rebuild. That is POC code, which must
  run unmodified.
- The loader doesn't sniff for an already-decompressed body. Locally, `.gz` is served without
  `Content-Encoding`, so the manual gunzip is right. If Vercel ever sets `Content-Encoding: gzip` on
  these files, the browser would decompress them first and the loader would throw "not valid gzip".
  This belongs in the deferred deploy check.
- `<main>/.worktrees/poc-src` is left in place (detached at `poc`, clean) for the next rebuild. The
  main checkout's untracked `poc/` was not touched.
