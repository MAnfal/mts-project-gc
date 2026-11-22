---
chunk: 02
title: Port config and core libraries (Federal Register client, date check, tiering)
branch: feat/demo-build--core-libs
base: feat/plan--demo-build
execution: parallel
depends: [01]
file-limit-waived: false
file-limit-reason: ""
---

# Chunk 02 — Port config and core libraries

## Context

The recorded eval numbers describe the POC's pipeline, so the demo has to run the **same
decision path**. This chunk brings over the POC's `config/` and the deterministic
libraries the pipeline stands on, with their tests. It makes no pipeline or UI changes;
chunk 03 ports the stages.

POC sources are on the `poc` branch under `poc/`. `main` has no `poc/` directory, so read
them with `git show poc:poc/<path>`. The modules to port:

- `src/lib/config.ts`: zod schemas, companies, prompts, prompt sets, frozen weeks, keys,
  `configHash`
- `src/lib/fr.ts`: Federal Register and govinfo client
- `src/lib/verify.ts`: quoted-date verification
- `src/lib/tier.ts`: deterministic tiering
- `src/lib/types.ts`
- `src/lib/prompts.ts`: prompt rendering

Two runtime changes are required, and neither may change a decision:

1. **No disk writes.** Vercel functions can't persist files. The POC's `fr.ts` caches
   HTTP responses in `data/cache/` with `fs.writeFile`.
   - Replace that with an in-memory cache scoped to the process.
   - Frozen weeks (`config/evalsets/weeks/*.json`) stay read-only lookups, exactly as in
     the POC (`frozenWeek`): a window matching a frozen week reads the file, and anything
     else calls the live API.
2. **Config lives at `config/`** (repo root). It loads through chunk 01's `readYaml`
   (`src/lib/config/load.ts`), and stays byte-identical to `poc:poc/config/` except for
   the one deliberate edit below.

The one deliberate edit: `config/companies/brightside.yaml` gets `use: eval`. Today it
has no `use:` field, and the POC kept it out of presets only because the filter is
`use === "demo"`. An explicit tag is what keeps eval companies out of the demo presets.
**This edit changes the config hash.** Record the new hash in the completion report and
explain the difference from `9a0f857741`.

## Acceptance Criteria

- Given the ported config, When the parity gate diffs the decision-path files against
  `poc:poc/config/`, Then they are byte-identical. The decision-path files are
  `prompts.yaml`, `prompt-sets/*.yaml`, `pipeline.yaml`, `setups.yaml`, `judges.yaml`,
  `experiment.yaml`, `companies/{cornercare,hearth,ledgerly,skyhop}.yaml` and `evalsets/**`.
- Given `companies/brightside.yaml`, Then the only difference from POC is the added
  `use: eval` line.
- Given `companies()`, When filtered to presets, Then exactly `hearth` and `ledgerly` are
  returned.
- Given `listWindow("2026-11-02","2026-11-06")` with no network, Then it returns the frozen
  week's 466 documents from `config/evalsets/weeks/`.
- Given any code path in `src/lib`, When grepped, Then there is no `writeFile`,
  `appendFile`, `mkdir` or `writeFileSync`.
- Given the POC's unit tests for tier, verify, FR text and config, When they run against
  the ported modules, Then they pass unchanged except for import paths.
- Given `tests/fixtures/recorded-prompts.json` from the POC, When the ported prompt
  renderer renders the same inputs, Then the output equals the recorded prompts byte for
  byte. This is the golden prompt-parity test.

## What To Do

### Tasks

- [ ] T001 — bring the files over:
  - `git archive poc poc/config poc/tests/fixtures/recorded-prompts.json | tar -x -C <your scratch dir>`
    (never `git checkout poc -- poc/...`: it stages `poc/` in the index, and no `poc/` path
    may ever be committed — amended 2026-11-22)
  - copy `<scratch>/poc/config/*` into `config/` (keep chunk 01's `config/app.yaml`)
  - copy the fixture to `src/lib/__fixtures__/recorded-prompts.json`
  - confirm `git status --short | grep '^.. poc/'` is empty
- [ ] T002 — write the failing tests first, ported from
  `poc:poc/tests/{tier,verify,fr-text,config,prompt-sets}.test.ts` into
  `src/lib/*.test.ts`, with only import paths changed. Add
  `src/lib/presets.test.ts`, asserting presets are exactly `[hearth, ledgerly]`. It fails
  today because no `use:` filter exists to exclude a company with no `use` field.
- [ ] T003 — create `src/lib/types.ts`, ported from the POC's `types.ts`. Drop the
  arena-only types the demo never reads: `ArenaConfig` and suite-dashboard types. List
  every dropped type in the report.
- [ ] T004 — create `src/lib/config.ts`, ported from the POC's `config.ts`:
  - schemas, `companies`, `getCompany`, `prompts`, `promptSet`, `withPromptSet`, `render`,
    `frozenWeek`, `loadKey`, `evalsets`, `configHash`, `validateAll`;
  - YAML is read through `readYaml`;
  - drop `pinConfig`/`unpinConfig` only if nothing on the demo path calls them (grep the
    POC);
  - add `presets()`, which returns `companies().filter(c => c.use === "demo")`.
- [ ] T005 — create `src/lib/fr.ts`, ported from the POC's `fr.ts`:
  - replace the `cached()` disk cache with a module-level `Map` (same keys, same
    `useCache` semantics);
  - keep the govinfo-first text fetch and the "literal `<`" fix from POC iteration 05;
  - keep `isBlockPage`.
- [ ] T006 [P] — create `src/lib/verify.ts` and `src/lib/tier.ts`, ported verbatim from
  the POC apart from import paths.
- [ ] T007 [P] — create `src/lib/prompts.ts`, ported verbatim from the POC.
- [ ] T008 — edit `config/companies/brightside.yaml`: add `use: eval` under `id:`.
- [ ] T009 — create `plans/2026-11-22-demo-build/02-core-libs/parity.sh`, the parity gate
  below. Commit it.
- [ ] T010 — edit `.claude/resources/project.md`:
  - Layout: `config/`, `src/lib/`.
  - Conventions: "Config is byte-identical to `poc:poc/config/` on the decision path —
    change it only with a recorded reason". Also "No filesystem writes in server code".

## Test Plan

| Test | Covers | Fails before implementation because… |
| ---- | ------ | ------------------------------------ |
| `tier.test.ts` (ported) | `<90 d` → Critical for Rule/Proposed Rule only; recently-effective rule | a stub returning `"Medium"` for every input fails the Critical cases |
| `verify.test.ts` (ported) | quoted dates verify against source text | a stub returning `ok:true` fails the negative quote case |
| `fr-text.test.ts` (ported) | govinfo text keeps content after a literal `<` | the pre-05 strip loses the text after `<` |
| `config.test.ts` (ported) | every config file validates | a stub schema `z.any()` doesn't reject the malformed fixture |
| `prompt-sets.test.ts` (ported) | rendered prompts equal the recorded fixture | any renderer change (whitespace, var order) fails the equality |
| `presets.test.ts` | presets = `[hearth, ledgerly]` | without `use: eval` plus the filter, `brightside` appears (`use === undefined` passes a `!== "eval"` filter) |
| `fr.test.ts` (new) | frozen-week lookup needs no network | with `fetch` stubbed to throw, a non-frozen lookup throws but the frozen window returns 466 documents |

| Guard / boundary | Constructed input that exercises it | Test |
| ---------------- | ----------------------------------- | ---- |
| preset filter | a company object with no `use` field | `presets.test.ts` |
| in-memory cache honours `useCache=false` | two calls with a counting `fetch` stub | `fr.test.ts` |

## Reuse Audit

Reuse: porting the POC's `config.ts`, `fr.ts`, `verify.ts`, `tier.ts`, `types.ts`,
`prompts.ts` and their tests; chunk 01's `readYaml`. New: `presets()` and the in-memory
cache, which replaces the disk cache.

## Reference Files

| File | Why |
| ---- | --- |
| `.claude/resources/project.md` | Commands; Principles 1 and 3 (tier by code; dates verified) |
| `.claude/resources/bibles/swe/patterns/migration-verification.md` | The port must be provably identical: golden fixture + parity diff |
| `.claude/resources/bibles/swe/testing.md` | Fixtures are the real recorded output, never hand-made approximations |
| `git show poc:poc/SCHEMA.md` | Every config and data format |
| `git show poc:poc/src/lib/config.ts` | Source of the port; `configHash` walks `.yaml` files except `evalsets/` |

## External Dependencies

- Federal Register API (`federalregister.gov/api/v1`) and govinfo full text — free, no
  key. Live calls are used only for windows outside the frozen weeks.

## Verification Gates

```bash
set -e
pnpm lint && pnpm test && pnpm build && pnpm typecheck

# Gate 2: decision-path parity with the POC (byte-identical)
bash plans/2026-11-22-demo-build/02-core-libs/parity.sh
#   for f in prompts.yaml pipeline.yaml setups.yaml judges.yaml experiment.yaml \
#            prompt-sets/*.yaml companies/{cornercare,hearth,ledgerly,skyhop}.yaml; do
#     diff <(git show poc:poc/config/$f) config/$f || exit 1; done
#   diff -r <(cd config/evalsets && find . -type f | sort | xargs cat) \
#           <(git archive poc poc/config/evalsets | tar -xO | ...)   # or loop per file
#   diff <(git show poc:poc/config/companies/brightside.yaml) config/companies/brightside.yaml \
#     | grep -c '^>' | grep -qx 1        # exactly one added line

# Gate 3: no filesystem writes in server code
if grep -rnE "writeFile|appendFile|mkdirSync|fs\.mkdir|writeFileSync" src/lib; then
  echo "FAIL: filesystem write in src/lib" >&2; exit 1; fi
```

Before trusting the parity gate, plant a canary: change one character in `config/prompts.yaml`
and confirm the gate fails, then restore it and confirm it passes again. Run every gate on
the base commit (the plan-branch tip this chunk was cut from) too and record the error text.

## Deliverables

- [ ] `completion-report.md`, committed. It includes the new `configHash()` value, the
      dropped types, and the parity-gate canary run.

## Artifacts Checklist

- ☐ New tests for new behavior (`presets`, `fr` cache/frozen)
- ☐ Existing tests ported (5 POC test files)
- ☐ Docs / conventions updated
- — Generated code: n/a
- ☐ `.claude/resources/project.md` updated (Layout, Conventions)
