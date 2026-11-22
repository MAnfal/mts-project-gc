---
chunk: 07
title: Eval data bundle — every recorded suite, example run and iteration as static files
branch: feat/demo-build--eval-bundle
base: feat/plan--demo-build
execution: parallel
depends: [01]
file-limit-waived: true
file-limit-reason: "The ~900 data files under public/evals/ are generated output and don't count. Hand-written: the build script, the verify script, the index types + test, the loader + test, and project.md. That is about 7."
---

# Chunk 07 — Eval data bundle

## Context

The eval view (chunks 08–10) shows the POC's recorded evaluation. It cost ~$125 and is
never re-run. It lives on the `poc` branch, tracked in git:

- `poc/data/evals/<arenaId>/runs/*.json`: run records, 9 suites;
- `poc/data/evals/<arenaId>/traces/*.jsonl.gz`;
- `poc/data/user-view/{runs,traces}/`: 22 example runs, including failed ones with status
  `error`;
- `poc/data/iterations/NN-slug/`: `spec.yaml`, `iteration.yaml`, `error-analysis.json`,
  `system.diff`, `config.diff`, and a config snapshot. `07-next` has evidence only.

**User requirement: lose nothing.** All 9 suites, all runs, all traces, all example runs
and all iterations ship.

Measured on the `poc` tree: traces total ~82 MB (already gzipped), run records ~13 MB
gzipped, example runs ~2 MB, iterations 1.3 MB; about 900 files. Vercel's 100 MB cap
applies to CLI uploads; Git-triggered builds have no source cap, and the file cap is 15,000
([Vercel limits](https://vercel.com/docs/limits)). The user deploys through Git.

**Don't use `poc/data/exports/`.** It is gitignored and covers only 2 of the 9 suites.
Build from the tracked data, using the POC's **own** grading code so the numbers match
what the POC reported. That code is `scripts/export.mts`, which calls `suiteReport`
(`src/lib/suite.ts`) and `checkTrace` (`src/lib/trace-checks.ts`). It runs inside a
checkout of the `poc` branch.

Target layout, which is the contract chunks 08–10 read. Each path is served at the same
URL path:

```
public/evals/
  index.json                        suites[], setups[], iterations[], live{}, baseline{}, counts{}
  config/                           one copy of poc:poc/config (incl. evalsets keys) — not one per suite
  suites/<arenaId>/manifest.json    from export.mts
  suites/<arenaId>/report.json      suiteReport(runs): per-setup metrics, per-evalset, totals
  suites/<arenaId>/trace-checks.json
  suites/<arenaId>/runs.jsonl.gz    every run record
  suites/<arenaId>/traces/<runId>.jsonl.gz
  user-view/index.json              [{id, profileId, window, status, items, setup}]
  user-view/runs/<runId>.json
  user-view/traces/<runId>.jsonl.gz
  iterations/<NN-slug>/iteration.json   iteration.yaml + spec.yaml merged, as JSON
  iterations/<NN-slug>/{error-analysis.json,system.diff,config.diff}
```

`index.json.live` holds the live setup's pooled numbers: `jev-sonnet-strict-passages`
over both iteration-06 suites (`arena-2026-11-21-22-52-l92` and
`arena-2026-11-21-23-16-du8`, 69 runs in the POC README). Compute it with the POC's
`suiteReport` on the combined runs, split all / dev / test. Do **not** copy figures out of
the README. `index.json.baseline` is the baseline setup computed the same way on the
latest suite where it ran; record which suite. Every number carries `{value, split, runs,
suite}`.

## Acceptance Criteria

- Given `public/evals/`, When the verify script runs, Then for every one of the 9 arena IDs
  in `git ls-tree --name-only poc poc/data/evals/`:
  - the run count in `runs.jsonl.gz` equals the count of `runs/*.json` on `poc`;
  - every trace on `poc` exists in `traces/` with identical bytes;
  - the same holds for `user-view` (all 22 runs, failed ones included);
  - every `poc/data/iterations/*` directory has an entry.
- Given `index.json`, Then it validates against `src/lib/evals/index-schema.ts`, and
  `live.recall.all` equals `suiteReport` recomputed over that setup's runs in the two 06
  suites. The folders hold 72 runs of that setup and the README reports 69 usable, so use
  `suiteReport`'s own inclusion rule and report the count. The test recomputes it from the
  shipped `runs.jsonl.gz` and the shipped keys.
- Given `pnpm build`, Then `public/evals` ships as static files. Check that no route
  imports them into a server bundle.
- Given the whole bundle, Then its size is reported in the completion report, and the
  total stays under 150 MB.

## What To Do

### Tasks

- [x] T001 — write failing tests:
  - `src/lib/evals/index-schema.test.ts`: the zod schema accepts a minimal valid index and
    rejects a number missing `split` or `runs`.
  - `src/lib/evals/loader.test.ts`: `loadIndex()`, `loadSuiteRuns(id)` and
    `loadTrace(suiteId, runId)` against a small constructed bundle in a temp dir.
    `loadTrace` must decompress a `.jsonl.gz` and parse lines lazily, as an async
    iterator.
- [x] T002 — create `src/lib/evals/index-schema.ts` (types + zod) and
  `src/lib/evals/loader.ts`. The loader is browser-side and fetch-based, using
  `DecompressionStream("gzip")`; see the POC README "For the real build".
- [x] T003 — create `scripts/build-eval-bundle.sh`. It is idempotent and documented at
  the top:
  1. `git worktree add .worktrees/poc-src poc` if absent, then `pnpm install` inside its
     `poc/` dir.
  2. For each of the 9 arena IDs, run `npx tsx scripts/export.mts <arenaId>` there.
  3. Assemble `public/evals/` in the layout above, from those exports and from
     `poc/data/{user-view,iterations}`. Drop the per-suite `config/` copies and keep one
     shared `config/`.
  4. Run `scripts/build-eval-index.mts`.
  5. Remove nothing from the POC worktree.

  If `export.mts`'s `arenaRuns()` skips any run file (e.g. superseded runs), also copy
  those raw records into `runs.jsonl.gz` with a `superseded: true` flag. Losing data is the
  failure this chunk exists to prevent.
- [x] T004 — create `scripts/build-eval-index.mts`. Run it inside the POC worktree (it
  imports the POC's `suiteReport`). It writes `index.json`: suites with their setups and
  evalset weeks, iterations from `iteration.json` (id, title, decision, setup, comparedTo,
  results), `live`, `baseline`, and `counts{suites, runs, traces, userViewRuns,
  iterations}`.
- [x] T005 — create `scripts/verify-eval-bundle.sh` with a non-zero exit on any mismatch.
  It runs:
  - the count and byte-equality checks from the acceptance criteria, against `poc`;
  - the `live` recompute, inside the POC worktree, over runs decoded from the shipped
    `public/evals/suites/*/runs.jsonl.gz`.
- [x] T006 — run `scripts/build-eval-bundle.sh` and commit `public/evals/**`.
- [x] T007 — edit `.claude/resources/project.md`. **This chunk runs in parallel with 02,**
  so do **not** edit Stack or Commands. Put the Commands addition in the completion
  report for the lead:
  `bash scripts/build-eval-bundle.sh && bash scripts/verify-eval-bundle.sh` ("Rebuild the
  eval bundle").
  Do edit Layout (`public/evals/`, `scripts/`) and Conventions: "The eval bundle is
  generated: never hand-edit `public/evals/`; rebuild it from `poc`".

Judgement call: `build-eval-index.mts` may live on `main` and import the POC's modules
through a path into `.worktrees/poc-src`, or be copied into the POC worktree at build
time. Explain your choice. Either way, the grading code that runs must be the POC's,
unmodified.

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `index-schema.test.ts` | every number labelled with split and run count | a schema with plain `number` fields accepts `{recall: 0.898}` |
| `loader.test.ts` › trace decompress | gz trace streaming | a loader using `res.json()` throws on gzip bytes |
| `loader.test.ts` › suite runs | `runs.jsonl.gz` parsing | a loader that splits on `\n` without dropping the trailing empty line yields a parse error |
| `verify-eval-bundle.sh` › live recompute | `index.live` matches the POC's `suiteReport` run in the POC worktree over the runs read back **from the shipped `runs.jsonl.gz`** | an index built from README figures differs from the recomputation, e.g. on dev precision |
| `verify-eval-bundle.sh` (gate) | nothing lost | a bundle built from `data/exports` misses 7 suites |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| missing split on a metric | `{value:0.9, runs:3}` | `index-schema.test.ts` |
| empty trace file | 0-byte gz | `loader.test.ts` |

## Reuse Audit

Reuse: the POC's `scripts/export.mts`, `suiteReport`, `checkTrace` and `SCHEMA.md` formats,
run unmodified in a POC worktree. New: the assembly script, the index builder, the verify
script, and the browser loader. The loader follows the POC README's "stream + window"
guidance.

## Reference Files

| File | Why |
| ---- | --- |
| `git show poc:poc/scripts/export.mts` | The per-suite bundle format and the POC grading calls |
| `git show poc:poc/SCHEMA.md` | Every file format in the bundle |
| `git show poc:poc/README.md` | The 9-suite history, what "live" means, and the "For the real build" serving guidance |
| `.claude/resources/bibles/swe/testing.md` | Test against the real shipped data, not hand-made numbers |

## External Dependencies

- Vercel static asset serving for `.gz` files. Serve them as `application/gzip` and let the
  client decompress. Don't rely on `Content-Encoding`.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: nothing lost
bash scripts/verify-eval-bundle.sh

# Gate 3: size budget
size=$(du -sm public/evals | cut -f1); echo "bundle MB: $size"
[ "$size" -lt 150 ] || { echo "FAIL: bundle $size MB" >&2; exit 1; }
```

Prove gate 2 can fail. Delete one trace file from `public/evals/suites/*/traces/` and
confirm it exits non-zero naming that file. Restore the file and confirm it passes.

## Deliverables

- [ ] `completion-report.md`, committed. It includes:
  - per-suite run, trace and byte counts;
  - the total size;
  - the `live` and `baseline` numbers with their split and run counts, side by side with
    the POC README's figures, explaining any difference;
  - the Commands line for the lead.
- [x] **Local stand-in for user checkpoint 2** (amended 2026-11-22; the deployed check is
      deferred to the final PR): under `pnpm build && pnpm start`, `/evals/index.json` and
      one trace file are served, with the status and content-type recorded.

## Artifacts Checklist

- ☑ New tests
- — Existing tests: none affected
- ☑ Docs / conventions updated
- ☑ Generated output committed (`public/evals/**`)
- ☑ `.claude/resources/project.md` updated (Layout, Conventions; Commands via the lead)
