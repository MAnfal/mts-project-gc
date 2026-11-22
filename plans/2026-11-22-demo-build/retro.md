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
