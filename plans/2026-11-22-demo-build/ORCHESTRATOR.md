---
owner: Anfal
created: 2026-11-22
plan_branch: feat/plan--demo-build
source_branch: main
---

# Regulatory Monitoring Demo Build — Orchestrator

The POC on `poc` proved the workflow and produced ~$125 worth of recorded evals. This plan
builds the deployable demo on `main`. The end state is a Vercel app where a GC can run a
live weekly triage, a reviewer can follow the eval story down to any trace, and a GC can
ask follow-up questions about a report. The design is locked, in GC AI's visual language,
in `design/`.

## How to use this file

This is a **resumable state machine**. Any agent can cold-start here:

1. Read this file fully — the State table says where things stand.
2. Read `.claude/resources/prompts/execute.md` and follow it from the current state.
3. Read `retro.md` in this directory for carry-forward learnings from earlier chunks.

If resuming mid-execution, do not redo completed chunks — and inside a chunk that was
already started, its Tasks list is the resume point. The ticked boxes say what landed;
re-deriving that from the diff is how work gets done twice.

Every state transition gets two writes: a row in the Execution Log below, and a journal
entry in `retro.md`. The log is structured data; the journal is everything the log can't
hold.

## Spec

See `SPEC.md` in this directory.

## State

| Chunk | Story | Status | PR | Blocker |
| ----- | ----- | ------ | -- | ------- |
| 01 | Foundation | Merged | local merge e719139 (pre-PR rule; branch pushed) | — |
| 02 | US1 | Merged | (pre-PR rule; branch pushed) local merge 64e9c4f | — |
| 03 | US1 | Merged | [#1](https://github.com/MAnfal/mts-project-gc/pull/1) | — |
| 04 | US1 | Merged | [#3](https://github.com/MAnfal/mts-project-gc/pull/3) | — |
| 05 | US1 | Not started | — | — |
| 06 | US1 | Not started | — | — |
| 07 | US2 | Merged | local merge 89e61d3 (pre-PR rule; branch pushed) | — |
| 08 | US2 | Merged | [#2](https://github.com/MAnfal/mts-project-gc/pull/2) | — |
| 09 | US2 | Not started | — | — |
| 10 | US2 | Not started | — | — |
| 11 | US3 | Not started | — | — |

Every chunk names the story it serves. A chunk that serves no story is either scaffolding
that belongs inside another chunk, or scope that crept in.

**Status values**: `Not started` → `In progress` → `In review` → `PR open` → `Merged`.
Also `Blocked` and `Dismissed`.

A filled Blocker column means the chunk cannot proceed — surface it, skip to the next
unblocked chunk, re-evaluate after each state change.

Add an `Extra` row for any PR that merges during this plan but isn't a numbered chunk
(a mid-execution cleanup, an absorbed idea). Otherwise it vanishes from the record.

When every chunk is `Merged`, run `/plan:complete`.

## Execution Log

| Date | Event | Chunk | Detail |
| ---- | ----- | ----- | ------ |
| 2026-11-22 | user_checkpoint | — | User: execute all chunks autonomously into the plan branch; Vercel checks deferred to one deploy at the end; no `poc/` ever committed. Plan amended. |
| 2026-11-22 | wave_started | 01 | Wave 0 |
| 2026-11-22 | chunk_dispatched | 01 | implementer chunk-01 |
| 2026-11-22 | gates_passed | 01 | lead re-run gates.sh all exit 0 |
| 2026-11-22 | review_iteration | 01 | i1 FAIL: untested (root) fallback; dead refine; constants-only test |
| 2026-11-22 | review_passed | 01 | i2 PASS |
| 2026-11-22 | pr_merged | 01 | merged --no-ff into feat/plan--demo-build (e719139) |
| 2026-11-22 | wave_merged | 01 | Wave 0 |
| 2026-11-22 | wave_started | 02,07 | Wave 1 (rubrics regenerated against Convention Map) |
| 2026-11-22 | chunk_dispatched | 02 | implementer chunk-02 |
| 2026-11-22 | chunk_dispatched | 07 | implementer chunk-07 |
| 2026-11-22 | review_iteration | 02 | i1 FAIL: untested config.ts defensive branches; no malformed-config test |
| 2026-11-22 | review_passed | 02 | i2 PASS |
| 2026-11-23 | pr_merged | 02 | merged --no-ff into feat/plan--demo-build (64e9c4f); plan-tip gates exit 0 |
| 2026-11-23 | chunk_dispatched | 03 | implementer chunk-03 (cut after 02 merged; plan amended at preflight) |
| 2026-11-23 | review_iteration | 07 | i1 FAIL: rebuild not idempotent (manifest exportedAt); untested index-script branches |
| 2026-11-23 | review_passed | 07 | i2 PASS |
| 2026-11-23 | pr_merged | 07 | merged --no-ff into feat/plan--demo-build (89e61d3); Commands line applied by lead; plan-tip gates exit 0 |
| 2026-11-23 | wave_merged | 02,07 | Wave 1 |
| 2026-11-23 | user_checkpoint | 07 | Checkpoint 2 local stand-in: /evals/index.json 200 application/json, trace 200 application/gzip (reviewer-observed); deployed check deferred |
| 2026-11-23 | user_checkpoint | — | User: every chunk lands via a GitHub PR into the plan branch, merged by the lead |
| 2026-11-23 | wave_started | 08 | chunk 08 dispatched (depends on 07 only; plan amended at preflight) |
| 2026-11-23 | review_passed | 03 | i1 PASS (one comment-only follow-up) |
| 2026-11-23 | pr_created | 03 | #1 |
| 2026-11-23 | pr_merged | 03 | #1 → 846328b; plan-tip gates exit 0 |
| 2026-11-23 | chunk_dispatched | 04 | implementer chunk-04 (plan amended at preflight, 14 points) |
| 2026-11-23 | review_passed | 08 | i1 PASS (+5 small follow-ups) |
| 2026-11-23 | pr_created | 08 | #2 |
| 2026-11-23 | pr_merged | 08 | #2 → d843dcb; plan-tip gates exit 0 |
| 2026-11-23 | chunk_dispatched | 09 | implementer chunk-09 (plan amended at preflight, 13 points) |
| 2026-11-23 | review_passed | 04 | i1 PASS (+2 small follow-ups) |
| 2026-11-23 | pr_created | 04 | #3 |
| 2026-11-23 | pr_merged | 04 | #3 → 6215846; plan-tip gates exit 0 (keyless) |

Events: `wave_started`, `chunk_dispatched`, `gates_passed`, `review_iteration`,
`review_passed`, `pr_created`, `pr_merged`, `chunk_blocked`, `chunk_dismissed`,
`wave_merged`, `plan_delivered`, `user_checkpoint`.

Wave-boundary events are mandatory — the retro derives its wave metrics from them.

## Execution

- **Mode**: subagent-driven. Eleven chunks across two independent tracks (GC flow and eval
  view) need isolated contexts, and the eval-data chunks read large files.
- **Worktrees**: `.worktrees/<chunk-name>`, one per dispatched chunk, cut from the tip of
  `feat/plan--demo-build` and removed after that chunk merges. `.worktrees/` is gitignored.
- **No stacking**: every chunk branch is cut from `feat/plan--demo-build` and merges back
  into it (lead merges locally with `--no-ff` after a reviewer PASS; amended decision 2).
  "Sequential" means the branch is cut later, not that it targets a sibling.

### Deferred to deploy (was: user checkpoints — amended 2026-11-22)

The user waived both hard stops and will deploy once, at the end. Each check below is
replaced during execution by a **local** equivalent (`pnpm build && pnpm start`), and the
original deployed-URL check is listed for the user in the final PR description:

1. *(was checkpoint 1, after 01)* On the deployed URL, `/` renders, and
   `curl -N https://<deploy>/api/probe/stream?seconds=90` reaches `done`. Also: config YAML
   is traced into the function bundle (`outputFileTracingIncludes`). Local equivalent: the
   probe streams to `done` under `pnpm start`.
2. *(was checkpoint 2, after 07)* The Git deploy carrying the ~97 MB eval bundle succeeds,
   and `/evals/index.json` plus one trace file are served. If it fails on size, move the
   traces only to Vercel Blob or R2 (decision 6). Local equivalent: both served by
   `pnpm start`.
3. Every "on the deployed URL" story checkpoint below is verified locally first, and again
   by the user after deploy.

## Git

- **Plan branch**: `feat/plan--demo-build`, from `main`. It holds `plans/` and receives
  every chunk (amended decision 2), so every chunk worktree has the plan on disk.
- **Chunk branches**: `feat/demo-build--<chunk-name>` (e.g. `feat/demo-build--scaffold`)
- **Chunks merge into**: `feat/plan--demo-build`, by the lead, after a fresh reviewer
  PASS and a lead re-run of the gates. See amended decision 2.
- **Every chunk lands through a GitHub PR** (user, 2026-11-23): push the chunk branch,
  `gh pr create --base feat/plan--demo-build` with the chunk-PR template, then the lead
  merges it with `gh pr merge --merge` so the PR is the record. Chunks 01, 02 and 07
  merged locally before this rule; their branches are pushed as the record, and GitHub
  can't open a PR for an already-merged branch.
- **Final PR**: `feat/plan--demo-build` → `main`, opened by the lead, merged by the user.

## Dependency Graph

```
Wave 0: [01]          → scaffold, theme, config loader, streaming probe — SEQUENTIAL
        ── USER CHECKPOINT 1: merge 01, wire Vercel ──
Wave 1: [02] ∥ [07]   → core libs (US1 track) ∥ eval bundle (US2 track) — PARALLEL
        ── USER CHECKPOINT 2 (after 07): bundle deploys ──
Wave 2: [03] ∥ [08]   → pipeline ∥ eval summary + iterations — PARALLEL
Wave 3: [04] ∥ [09]   → run + report ∥ eval cases + traces — PARALLEL
Wave 4: [05] ∥ [10]   → new-run screen ∥ models page — PARALLEL
Wave 5: [06]          → edge states, held-back, example runs — SEQUENTIAL (needs 05 and 07)
Wave 6: [11]          → follow-up chat — SEQUENTIAL (mounts on the runs and examples pages that 06 finishes)
```

**Shared-file audit for the parallel waves.** The two tracks share these files:

- `package.json` / the lockfile: chunk 07 adds a script entry; the US1 track adds
  dependencies in 02 and 04.
- `.claude/resources/project.md`: every chunk may touch Commands, Layout, Convention Map
  and Conventions.
- The app shell components under `src/components/shell/`: owned by chunk 01.

Resolution: Stack and Commands are single shared blocks, so in a parallel wave **only the
US1-track chunk edits Stack and Commands**. The US2-track chunk lists its Commands addition
in its completion report, and the lead applies it at the wave boundary. Layout, Convention
Map and Conventions are append-in-place, so both chunks edit them directly. Neither track
edits `src/components/shell/*`. The eval shell (chunk 08) and the GC shell (chunk 04) are
separate files that compose the shared shell primitives from 01. `package.json` conflicts
are mechanical: the second PR rebases on `main` and re-runs install.

Two more shared-file notes:

- `config/eval-story.yaml` and `src/lib/evals/story-schema.ts` are eval-track only, so
  `src/lib/config/schemas.ts` is edited by 05 alone in Wave 4.
- `ReportView.tsx` takes a `followUp` prop. Chunk 11 mounts the chat from the pages, so it
  never edits `ReportView`, and it runs after 06 because 06 creates the examples page.

## Story Checkpoints

| Story | Last chunk | Checkpoint — what works once this merges | Reached? |
| ----- | ---------- | ---------------------------------------- | -------- |
| Foundation | 01 | The placeholder app in GC AI's theme deploys from `main` on Vercel; config YAML is read on the server; a 90-second stream survives the deployed function | ☐ |
| US1 (P1) | 06 | On the deployed URL, a GC picks a preset or an edited profile and a week, watches the steps stream, and reads a verified, owner-routed report. Runs persist in IndexedDB. Failures retry ×3, then offer a settings-preserving Retry. Edge states render | ☐ |
| US2 (P1) | 10 | On the deployed URL, a reviewer reads the verdict and CARL story, opens any iteration, any case, any run's trace, and the model comparison. Every number comes from the recorded data | ☐ |
| US3 (P2) | 11 | A finished report (live or example) takes follow-up questions answered only from that report | ☐ |

## Design Decisions

1. **Plain Vercel AI SDK + AI Gateway, not Flue/Pi** (user, 2026-11-22). The POC pipeline
   already runs on the AI SDK. Flue/Pi would need its own server, and this workflow needs
   no sandbox, shell or code execution. The RFC line and `project.md` Stack still name
   Flue; chunk 01 corrects both. The harness is deferred, not rejected.
2. **`main` is the integration branch; chunk PRs target `main`** (user, 2026-11-22). Vercel
   deploys `main`, and the user verifies each chunk on the deployed URL as it lands. A
   long-lived plan branch would delay that by the length of the plan.
   **Amended 2026-11-22 (user, at execution start):** the user chose to execute the whole
   plan autonomously and deploy once at the end. Chunk branches are cut from, and merged
   by the lead into, `feat/plan--demo-build`. When every chunk is merged, the lead opens
   one PR from `feat/plan--demo-build` to `main`; the user merges it and wires Vercel.
   Nothing is pushed to or merged into `main` by the lead.
3. **The POC's decision path is ported byte-identical** (chunk 02, verified by gate). The
   recorded eval numbers describe the POC's pipeline. They describe the demo only if the
   demo runs the same pipeline. "Decision path" means: `prompts.yaml`, `prompt-sets/`,
   `pipeline.yaml`, the `jev-sonnet-strict-passages` setup, the companies, and the logic in
   `tier.ts`, `verify.ts`, `stages.ts` and `run.ts`. Renaming steps for display, retries,
   streaming and stateless storage are allowed changes because none of them changes a
   decision. The POC config hash recorded in the 06 suite runs is `5f1346a284`. The POC's
   final config hashes to `9a0f857741`; the only difference is `userView.setup` being
   promoted to the 06 setup (commit `2f91080`).
4. **Browser-only persistence (IndexedDB)** (user, 2026-11-22). Vercel functions can't write
   durable files, and `sessionStorage` or memory loses runs on refresh. Server-side traces
   of live runs are not kept. The write-up states this limitation; the recorded suites keep
   full traces.
5. **No spend guard in code** (user, 2026-11-22). The demo relies on the ~$20 Gateway
   balance. Risk: anyone with the URL can spend it. The user accepts this for a demo
   shared only with interviewers. The POC's file-based spend ledger (`store.ts`) is not
   ported.
6. **All recorded evals ship as static files via Git deploy** (user, 2026-11-22). Measured:
   traces ~82 MB (already gzipped), run records ~13 MB gzipped, example runs ~2 MB,
   iterations 1.3 MB; ~900 files. Vercel's 100 MB cap applies to CLI uploads, not Git
   builds; the file cap is 15,000 ([Vercel limits](https://vercel.com/docs/limits)). The
   bundle is built from the tracked `poc/data/evals` (all 9 suites) and
   `poc/data/user-view`, **not** from the gitignored `poc/data/exports`, which covers only
   2 suites. Fallback if the deploy fails on size: traces only to Vercel Blob or R2.
7. **Function duration** — Vercel Hobby Fluid compute allows 300 s, both default and maximum
   ([Functions limits](https://vercel.com/docs/functions/limitations)). The POC measured
   65 s typical and 87 s worst case for the live setup. The streaming route sets
   `maxDuration = 300`. Chunk 01's probe proves it on the deployed URL before the design
   depends on it.
8. **Retry: at most 3 attempts per external call, waiting 2 s then 4 s between them**
   (user rule: "up to 3" attempts; the waits are ours). The longest added wait is 6 s per
   call, which keeps the 87 s worst case well inside 300 s. After the third failure the run fails with the
   step's timeout message and a Retry that reuses the saved settings. Retries never change
   a decision; they only re-issue the same request.
9. **Public step names map from internal stage IDs in one table** (chunk 03). The GC never
   sees internal model or component names. A gate greps the GC-facing bundle and responses
   for the internal names.
10. **Eval numbers are computed from data, never typed from the mockups.** The hi-fi copy
    in `design/` is layout and tone, not the spec for numbers. In particular, the mockup
    shows the baseline as 63/69 in the scoreboard but 71/81 at chart point 00. Those come
    from different eval-set sizes (12 weeks vs 6). Chunk 08 labels every number with its
    split and run count, and words the verdict from the computed values.
11. **Config-driven everything** (user, 2026-11-22). Presets, models, judges, prompts, tier
    rules, eval-set manifest and UI limits (e.g. `maxWindowDays`) live in `config/` YAML,
    validated by zod at load. Code holds no model IDs or company data.
12. **Presets are the `use: demo` companies only.** `brightside` (eval) gets an explicit
    `use: eval` in chunk 02, so it can never be offered as a preset and show overfit results.

### Complexity

| Abstraction | What it buys | Flat alternative, and why it loses |
| ----------- | ------------ | ---------------------------------- |
| Step-event stream (typed events emitted by the run, rendered by the UI) | One source for streaming, IndexedDB persistence and retry state | Polling a server-side run record, as the POC does: impossible here because the server is stateless |
| Public-name table (internal stage ID → GC-facing label) | One place enforces "no internal names" and the gate can check it | Labels inline at each emit site: leaks are invisible and ungateable |
| Eval index + lazily fetched gz files | The summary loads in one small request; 97 MB is never fetched at once | One big JSON: unusable at this size |

### Principle Exceptions

| Principle | Chunk | Why this ships anyway |
| --------- | ----- | --------------------- |

*None.* Principles 1–4 (`project.md`, draft of 2026-11-21) are checked against every
chunk: tier stays in code (02), only primary sources are surfaced (web leads stay off),
every surfaced date is verified (02/03), and no paid data APIs are used. Chunk 01 ratifies
the draft principles unchanged.

## Plan-Specific Constraints

- **The POC is reference, read from git.** `main` has no `poc/` directory, and **no
  `poc/` path may ever be committed on a chunk or plan branch** (user, 2026-11-22). Read
  POC sources with `git show poc:poc/<path>`, and bring files over with
  `git archive poc poc/<path> | tar -x -C <your scratch dir>` followed by a copy into
  place — never `git checkout poc -- poc/...`, which stages `poc/` in the index. Never
  merge the `poc` branch. Gate, run by the lead before every merge:
  `git ls-tree -r --name-only <chunk-branch> | grep '^poc/'` is empty, and
  `git log --name-only --format= <plan-branch>..<chunk-branch> | grep '^poc/'` is empty.
  The untracked `poc/` in the main checkout is the user's; never read from or delete it.
- **The locked design is `design/` in this plan directory.** `design/Hi*.dc.html` are the
  hi-fi artboards (open them as HTML; ignore the `<x-dc>` wrapper and the `data-dc-script`
  block), and `design/gcai-ui-notes.md` holds the measured GC AI tokens. The live canvas
  is https://claude.ai/artifact/1H8D2FkcxXKLGEJU9wosRj (private to the user).
- **`project.md` edits in parallel waves:** see the shared-file audit above. Only the
  US1-track chunk edits Stack and Commands; everything else is edited in-chunk.
- **The Vercel environment variable for the Gateway key** is `AI_GATEWAY_API_KEY`, the AI
  SDK default. The POC read `VERCEL_AI_GATEWAY_API_KEY` from `../.env`. Chunk 01 decides
  the name, writes it into `project.md` Conventions, and tells the user which name to set
  in Vercel.
