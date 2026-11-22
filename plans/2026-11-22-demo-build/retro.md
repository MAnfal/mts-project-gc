<!-- Copied into the plan directory at the start of execution.
     Part 1 is written continuously while executing. Part 2 is filled by plan-retro. -->

# Regulatory Monitoring Demo Build — Retro

## Part 1: Execution Journal

Written as execution progresses, while context is fresh. Not at the end.

### What to log

- **After a review that took 2+ iterations**: what kept failing, and whether it was a plan
  gap, a rubric gap, or a convention the implementer didn't know
- **After a blocker**: what blocked, and whether the plan should have predicted it
- **After a surprise**: wrong assumptions, renamed files, unexpected conflicts, a
  third-party constraint discovered
- **After friction**: tooling problems, slow steps, things harder than they should be
- **After a win**: chunk shapes worth repeating, predictions that were spot on
- **After any user correction**: "why did you do X" / "don't do Y" — trace it back to the
  prompt or template that allowed it, and propose the fix. This is the highest-value entry.
- **After any non-obvious decision**: a workaround, a rejected obvious path, a choice that
  wouldn't be derivable from reading the code. Ask "what made you pick X over Y?" and
  capture the answer — see below.

### What NOT to log

- Gate results and iteration counts — those are the Execution Log's job
- Per-file evidence — the reviewer's verdict has it
- "Passed on iteration 1, clean" — if nothing interesting happened, write nothing

### Tribal knowledge entries

Reasoning the source code cannot reveal. Nobody corrects a right-but-non-obvious choice,
so no friction surfaces and the knowledge dies with the chunk unless it's captured here.
Each entry needs four parts:

1. **The decision** — what was chosen
2. **The obvious alternative** — what a reader of the code would expect instead
3. **The constraint that made the choice right** — the why that source can't show
4. **The recognition signal** — the cue that tells a future reader they're in the same
   situation

Every one of these is a candidate for `.claude/resources/project.md`.

### Format

```markdown
## YYYY-MM-DD

### Chunk NN — <Name>

- Observation
- Observation
```

## 2026-11-22

### Plan-level — user correction at execution start

- The user overrode three plan decisions at `/plan:execute`: (1) chunks integrate into
  `feat/plan--demo-build`, merged by the lead, not PR'd to `main`; (2) both Vercel hard
  stops are deferred to a single deploy at the end; (3) no `poc/` path may ever be
  committed. Swept as one amendment (ORCHESTRATOR decision 2, Execution, checkpoints,
  Git, constraints; every chunk's `base:`; "run gates on `main`" wording in 01/02/06/08;
  02 T001's `git checkout poc --`; 07's checkpoint deliverable).
- Trace-back: the plan assumed per-chunk deploy verification was worth a hard stop. The
  planning prompt never asked whether the user wanted to be in the loop per chunk or
  only at the end; that question belongs in brainstorm. Also, 02 T001 told implementers
  to stage `poc/` via `git checkout poc --`, which leaks POC paths into history if any
  step is skipped; `git archive | tar -x` into scratch is the safe import.

### Chunk 01 — Scaffold

- Review i1 failed on guard coverage only (an untested `(root)` fallback, a dead
  `.refine`): a rubric gap no implementer self-check caught, so the rubric's
  "every guard has a constructed input" item earns its place.
- Gotchas worth carrying forward: `next dev` writes `AGENTS.md` at the repo root (verify
  under `pnpm start`); Next's `LayoutProps` exists only after a build, so a fresh-tree
  `tsc` fails if you rely on it; a config path built from a variable makes Turbopack trace
  the whole project, so keep `readYaml`'s base path static.

### Chunk 02 — Core libs

- Plan claim falsified: `presets.test.ts` "fails today" was false, because the POC schema
  already defaults `use` to `eval`. `use: eval` is a guard against future change with no
  behaviour change today. Plan gap: a "fails today because…" line written without
  running the schema.
- configHash: `9a0f857741` (POC) → `a113914a72` (demo). The difference comes only from
  brightside's `use: eval` plus chunk 01's `config/app.yaml` being hashed. Every later
  config file moves it again, so the demo hash will never equal the recorded runs' hash.
  Decision-path parity is proved by the byte diff in `02-core-libs/parity.sh`, not by
  the hash.
- Review i1 failed on untested defensive branches again (the same category as 01). That
  is two for two, so implementers should be briefed up front: "every throw/guard you
  write or port needs an off-fixture test".
- Open warnings to absorb into 03: pin `pool: "forks"` in vitest config (the `chdir`
  tests break under threads); remaining untested ported branches in `config.ts`
  (validateAll model/method/areas checks) and `fr.ts:43` (the `!res.ok` throw).

### Chunk 07 — Eval bundle

- Decision (lead-approved mid-chunk): the baseline is pooled over w0i+cb0, not taken from
  the "latest suite" only. No single suite ran the baseline on all 4 weeks, and the latest
  alone gives 0.444/0.444 on half the weeks. Pooled gives 0.633/0.691, matching the README.
  Recognition signal: a "latest X" rule in a plan, applied to data recorded in partial
  slices.
- Bundle is 111 MB, not ~97. The 94.6% relevance-agreement figure has no POC code behind
  it; chunk 07 reproduced it (a keyed doc agrees when all finished repeats flag it or none
  do; 335/354). Lead decision: chunk 08 computes it with that definition and labels it.
- Live cost per run is $0.1918 (suiteReport divides by all 72 runs) vs the README's $0.20
  (69 finished). The index keeps suiteReport's value.
- User-view run JSONs carry model ids, so chunk 06 needs a projection (Decision 9).
- Review i1 failed on idempotence plus untested script branches. The fix pattern that
  worked: move the pure logic into `src/lib/evals/bundle-build.ts` and unit-test it.
- Parallel-wave merge: `project.md` Layout conflicted between 02 and 07. Resolved by
  keeping both blocks (lead).

### Chunk 03 — Pipeline

- Preflight paid off. A rubric-regeneration agent read the POC sources and found that the
  plan's parity mutation targeted the wrong file (the relevance cut is in `run.ts`, not
  `stages.ts`), and that the replay could not run offline without captured
  FR/govinfo text. Amending before dispatch turned a likely 2-iteration chunk into
  1 iteration. Pattern worth keeping: rubric regen doubles as a source-reading preflight.
- Cross-chunk edit: 03 edited 02's `fr.ts`, because the POC's fetchers swallow errors so
  retries had to go inside. The reviewer confirmed it is not a decision change.
- Deferred risk: in a govinfo outage, retries can add about 240 s, close to the 300 s limit.
  A hard timeout emits no `run.failed`, so chunk 04 must handle a dropped stream.
- `assertPublic` is case-sensitive on `\bJEV\b`, so a live title containing "JEV" would
  fail the run. This was accepted.

### Chunk 08 — Eval summary and iterations

- Preflight found that roughly half the plan's "from the index" numbers did not exist in
  the index. Amending the builder (not the page) kept every number data-derived.
- The implementer corrected the lead's amendment twice, with evidence: the baseline has 3
  repeats, and datesRight is against the key, not the source. A lead's preflight
  amendment is a claim too; the implementer's "proceeding unless you object" pattern
  handled it cheaply.
- Decision 10 paid off: the computed noise band says 06's precision gain is *beyond*
  noise, contrary to the mockup and the POC's own decision text (which used a four-suite
  band). The page states both bands.
- configHash keeps moving with every config edit (now `242bd91ef7`); parity is the byte
  diff, not the hash.

### Chunk 04 — Run and report

- A 14-point preflight amendment followed by a first-iteration PASS: the same pattern as
  03 and 08. When the rubric regenerator also reads the merged code, preflight finds
  the plan-vs-reality gaps before an implementer pays for them.
- Rendering UI without spend: run the server with `AI_GATEWAY_API_KEY=` empty, so a
  real click fails at the ranking step before any model call; seed IndexedDB from
  `runReplay()` events. `.env.local` does not override an already-set empty variable.
- Open follow-ups, not fixed: a run keeps spending after a client disconnect (no
  AbortSignal); a missing key shows "Something went wrong" because model resolution sits
  outside `withRetry` in 03's `RunCtx`.

### Chunk 05 — New-run screen

- Accepted deviation from the lead's amendment 4: an owner email follows the *person*,
  not the row. Report grouping keys on email, so a renamed preset row must not inherit
  another person's address.
- Gate pitfall: Next serialises server props into the HTML as an escaped RSC payload
  (`\"ledgerly\"`), so a quoted-needle grep for presence matches nothing on a
  correct page. Use bare, case-insensitive words for absence and accept either quoting for
  presence.
- Chunk 09 found that `! cmd | grep -q x` can never fail under `set -e` (bash exempts
  negated pipelines). Gate blocks must count explicitly.

### Chunk 09 — review i1 (lead process gap)

- Review i1 failed partly on the lead. Plan amendment 2 moved the run-report link to
  chunk 06, but the rubric (regenerated before the amendment) still required it. That
  breaks the "an amendment is a sweep" rule: the lead swept plan.md but not rubric.md.
  Fix: after any preflight amendment, grep rubric.md for each struck item before
  dispatch. Chunk 06 must now carry the eval-side "Open this run's report".


---

## Cold-start brief

Appended to after each chunk. What a fresh session — or the next chunk's implementer —
must know so it doesn't re-derive things from scratch. Every re-derivation is a burned
iteration; every line here skips one.

- **Helpers introduced**: "Chunk N added `<helper>` at `<path>` — later chunks import it,
  don't re-create it."
- **Convention discoveries**: "Library X exports `<actual>`, not `<expected>`."
- **Testing patterns**: "Component Y needs `<sequence>` in tests, not the naive one."
- **Setup requirements**: "After install, also run `<command>` before the gates run clean."

### Carried forward (this plan)

- **Setup**: `bash scripts/bootstrap.sh` in a fresh worktree (install + `.env.local` with
  `AI_GATEWAY_API_KEY` derived from the main checkout's `.env`, never printed).
- **Helpers (01)**: `readYaml(relPath, schema)` at `src/lib/config/load.ts`; shell
  primitives `AppShell`/`SidebarNav` in `src/components/shell/` (owned by 01: compose them,
  don't edit them).
- **Verify UI under `pnpm start`, not `next dev`** (dev writes `AGENTS.md` at the root).
- **Helpers (02)**: `@/lib/config` → `src/lib/config.ts` (companies, presets(), prompts,
  render, frozenWeek, loadKey, configHash, validateAll); `@/lib/config/load` → `readYaml`.
  `src/lib/fr.ts` (in-memory cache), `verify.ts`, `tier.ts`, `prompts.ts` (byte-identical
  to POC). Decision-path parity gate: `bash plans/2026-11-22-demo-build/02-core-libs/parity.sh`
  — every later chunk that touches `config/` runs it. Temp-config test helper in
  `src/lib/config-validation.test.ts`.
- **Every throw/guard needs an off-fixture test**: reviews 01 and 02 both failed i1 on this.
- **Eval bundle (07)**: `public/evals/` is generated (never hand-edit). Contract:
  `src/lib/evals/index-schema.ts`; browser loader `src/lib/evals/loader.ts` (`loadIndex`,
  `loadSuiteRuns`, `loadTrace`, async gunzip). Every number is `{value, split, runs, suite}`.
  Baseline pools w0i+cb0; live pools l92+du8. POC checkout for rebuilds:
  `<main>/.worktrees/poc-src` (detached `poc`).
- **Pipeline (03)**: `runPipeline(config, emit)` in `src/lib/pipeline/run.ts`; events +
  `STEP_LABELS` + `assertPublic` in `src/lib/pipeline/events.ts` (browser imports types
  only); `withRetry` in `retry.ts`; `src/lib/gateway.ts` (`AI_GATEWAY_API_KEY`). Run config
  must be built like the POC's `api/try` + `cellConfig`. A doc the filter never answered is
  in neither `screenedOut` nor `notReviewedCount`. Gate: `bash plans/2026-11-22-demo-build/03-pipeline/gates.sh`.
- **Eval pages (08)**: `/evals` and `/evals/iterations/[id]`; server page reads
  `config/eval-story.yaml` per request, client loads bundle via `loader.ts`
  (`loadIndex`, `loadIteration`, `loadIterationFile`, …). Eval sidebar component in
  `src/components/evals/` lists Summary, Iterations, Cases (09 builds `/evals/cases`;
  10 adds Models). Gate: `bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh`.
- **GC run (04)**: `POST /api/run` (request.ts, run-config.ts, stream.ts);
  `src/lib/runs/` (store, reader, reduce, report — pure, client-safe; types-only import
  from events.ts); `src/components/gc/` (RunView, ReportView, GcSidebar, useRun…).
  `ReportView` takes a `followUp` prop. Spend-free UI checks: `AI_GATEWAY_API_KEY=` empty +
  seed IndexedDB from `runReplay()` events. Gate: `bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh`.
- **Chunks land via GitHub PR** into `feat/plan--demo-build` (`gh pr create` → `gh pr merge --merge`).

---

<!-- Everything below is filled by the plan-retro skill after all chunks merge.
     Do not write below this line during execution. -->

## Part 2: Retrospective Summary

### Plan Stats

| Field | Value |
| ----- | ----- |
| Plan | |
| Completed | |
| Chunks | |
| Waves | |
| Total review iterations | |

### Per-Chunk Execution

| Chunk | Review iterations | Failure categories | Mode | Conflicts? |
| ----- | ----------------- | ------------------ | ---- | ---------- |

Failure categories: `missing-tests`, `convention-violation`, `type-errors`,
`out-of-scope`, `acceptance-criteria`, `lint`, `other`.

### Prediction Accuracy

- Predicted parallel, actually safe:
- Predicted parallel, had conflicts:
- Predicted sequential, could have been parallel:

### Distilled Patterns

Tag each by confidence. Cross-reference the retros already in `plans/completed/`.

#### Rules (seen across 2+ plans)

#### Heuristics (seen once, likely to generalize)

#### Observations (notable, needs more data)

### Framework Updates Proposed

Evidence must cite the chunk and what happened — "Chunk 03: reviewer flagged the same
missing import 3 iterations running", not "reviewers struggle with imports".

| Target file | Proposed change | Evidence | Approved? |
| ----------- | --------------- | -------- | --------- |
