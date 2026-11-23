# Chunk 02 — Completion Report

Branch `feat/demo-build--core-libs`, base `9d08486` (tip of `feat/plan--demo-build`). Every log quoted
below is committed under `evidence/` in this directory, captured by redirecting the command's output
to that file. Short excerpts are quoted from those files. The scripts that produced them are
`evidence/mutate.sh` (mutations) and `evidence/config-hash-repro.sh` (hash table, re-runnable). The
diffs of every ported file against its POC source are in `evidence/poc-diffs/`.

## What changed

| File | Change | Why |
| ---- | ------ | --- |
| `config/**` (31 files) | created | Copied byte-for-byte from `poc:poc/config/` (`git archive poc poc/config \| tar -x` into scratch, then `cp`). Chunk 01's `config/app.yaml` kept. |
| `config/companies/brightside.yaml` | edited | `use: eval` added after `id:`. This is the one deliberate difference from the POC. |
| `src/lib/__fixtures__/recorded-prompts.json` | created | The POC's golden prompt fixture, byte-identical. |
| `package.json`, `pnpm-lock.yaml` | edited | `date-fns` 4.4.0, pinned exactly. It is the POC lockfile's version, and `tier.ts` and `verify.ts` import it. |
| `src/lib/tier.ts`, `verify.ts`, `prompts.ts` | created | Byte-identical to `poc:poc/src/lib/` (`parity.sh` step 5 diffs them). |
| `src/lib/types.ts` | created | The POC's file with only its header comment changed (the old one said runs persist under `data/`). |
| `src/lib/config.ts` | created | The POC's `config.ts` ported onto `readYaml`. Adds `presets()`/`isPreset()`. Drops `pinConfig`/`unpinConfig`. See Deviations. |
| `src/lib/fr.ts` | created | The POC's `fr.ts` with the `data/cache/` file cache replaced by a module-level `Map`. Adds `import "server-only"`. |
| `src/lib/{tier,verify,fr-text,config,prompt-sets}.test.ts` | created | POC tests with import paths changed. `config.test.ts` also loses two blocks (see Deviations). |
| `src/lib/presets.test.ts`, `fr.test.ts`, `config-hash.test.ts` | created | New: presets, frozen week offline, in-memory cache semantics, configHash scope. |
| `src/lib/config-validation.test.ts` | created (iteration 2) | config.ts rejecting broken config, on a temp copy of `config/`. |
| `plans/…/02-core-libs/parity.sh` | created | Gate 2: decision-path parity with `poc`. |
| `plans/…/02-core-libs/no-fs-writes.sh` | created | Gate 3: no filesystem writes in non-test code under `src/` (widened in iteration 2). |
| `plans/…/02-core-libs/gates.sh` | created | Runs every gate in plan order, type check last. |
| `.claude/resources/project.md` | edited | Stack: `date-fns` row. Layout: `config/` and `src/lib/` entries. Conventions: decision-path parity, configHash scope, no server fs writes, `@/lib/config` resolution, JSON under `config/evalsets/` read via `frozenWeek`/`loadKey`. |
| `plans/…/02-core-libs/plan.md` | edited | T001–T010 ticked. |

## Acceptance criteria

| Criterion | Met | Evidence |
| --------- | --- | -------- |
| Decision-path files byte-identical to `poc:poc/config/` | yes | `parity.sh` → `parity: OK (…)` in `evidence/gates-final.txt`. It covers the files named in the plan, plus both file lists of `prompt-sets/` and `evalsets/` in both directions. |
| `brightside.yaml` differs only by the added `use: eval` | yes | `parity.sh` step 3 rebuilds the expected file (POC + `use: eval` after `id:`) and `cmp`s it. Canaries for an extra line, `use: demo` and a removed line all fire (`evidence/canary-parity.txt`). |
| `presets()` → exactly `hearth`, `ledgerly` | yes | `presets.test.ts` › "are exactly hearth and ledgerly". The runtime value under `next start` was `"presets":["hearth","ledgerly"]` (probe below). |
| `listWindow("2026-11-02","2026-11-06")` offline → 466 docs | yes | `fr.test.ts` › "returns the week's 466 documents … with no network". `fetch` is stubbed to throw and asserted not called. The source file has 466 entries (`python3 -I -c 'len(json.load(…))'` → `466`). |
| No `writeFile`/`appendFile`/`mkdir`/`writeFileSync` in `src/lib` code | yes | `no-fs-writes.sh` → `no-fs-writes: OK (17 non-test source files under src/ scanned)`. Scope: every non-test file under `src/`, a superset of `src/lib`; see Iteration 2. |
| POC tests for tier, verify, FR text and config pass unchanged except import paths | yes, with 2 removed blocks | All pass (11 files, 84 tests, including chunk 01's). The `config.test.ts` diff against POC is import paths, the fixture path, and two removed blocks (arena, pinConfig) that test modules not ported. |
| Golden prompt parity | yes | `config.test.ts` › "prompts rebuilt from config/prompts.yaml match what the arena sent" (3 tests, `toBe` on the recorded strings). The fixture is byte-identical to POC (`parity.sh` step 4). |

## Tests

| Test | Red run (before implementation) | Green run |
| ---- | ------------------------------- | --------- |
| all 8 new/ported test files (5 ported, 3 new) | **Import red** (`evidence/red-01-no-modules.txt`): `Error: Cannot find module './config'`, `'./tier'`, `'./verify'`, `'/src/lib/fr'`, `Cannot find package '@/lib/config'`. This proves only that the modules were absent. | `Test Files 11 passed (11) / Tests 84 passed (84)` after iteration 2 (`evidence/gates-final.txt`) |
| `presets.test.ts` › brightside tags itself `use: eval` | **Wrong-value red**, with the modules implemented and before T008 (`evidence/red-02-before-brightside-edit.txt`): `AssertionError: expected undefined to be 'eval'`. All other 75 tests were green. | pass |

The discriminating reds come from deliberate mutations. `/private/tmp/…/chunk-02/mutate.sh` copies
the file aside, applies one `perl` substitution, checks the file changed, runs one test file, copies
the original back and `cmp`s it. Each log is in `evidence/mutations/<name>.txt`.

| Contract | Mutation applied | What went red |
| -------- | ---------------- | ------------- |
| Tier by code (plan: Medium stub) | `assignTier` returns `{tier:"Medium"}` first | 8 tier tests, e.g. "proposed rule … under 90 days is Critical": `expected 'Medium' to be 'Critical'` |
| `< 90` is strict | `days(next) < 90` → `<=` | "deadline exactly 90 days out is not Critical": `expected 'Critical' to be 'Medium'` |
| Quoted dates verified (plan: ok:true stub) | `verifyQuotedDate` returns `{ok:true}` | "rejects a quote not present…", "…claimed date is not in it", "rejects an empty quote": `expected true to be false` |
| Literal `<` fix (iteration 05) | strip regex → pre-05 `/<[^>]+>/g` | "keeps text after a literal '<'": `expected '  a concentration of   below.  ' to contain '<=7.3 percent'` |
| Golden prompt parity | `bullets` emits `-  x` (2 spaces) | baseline task, LLM filter, action writing: `expected 'Company: Brightside…' to be …` |
| Golden prompt parity | `docBlock` swaps Title and header lines | "LLM filter, first batch…" |
| `render` | regex loses `/g` (first placeholder only) | all 3 golden tests + "renders all 14 templates": `prompt variables not used by the template: summary, applies, doesNotApply` |
| Preset filter | `presets = () => companies()` | "are exactly hearth and ledgerly"; "never include an eval company": `expected [ 'brightside', … ] to not include 'brightside'` |
| Preset filter | `isPreset`: `=== "demo"` → `!== "eval"` | "rejects a company with no use field…": `expected true to be false` |
| Schema default keeps unlabelled companies out | `.default("eval")` → `.default("demo")` | "a profile file without a use field parses as eval": `expected 'demo' to be 'eval'` |
| Schema validates (plan: `z.any()` stub) | `CompanySchema = z.any()` | same test: `expected undefined to be 'eval'` |
| Frozen week needs no network | `listWindow` ignores `frozenWeek` | "returns the week's 466 documents…": `Error: network disabled in this test` |
| `useCache` honoured | cache read disabled | "serves a repeated live window from memory…": `expected "vi.fn()" to be called 1 times, but got 2 times` (+2 getDoc tests) |
| Fresh copy per read | Map stores the object itself | "hands each caller its own copy…": `expected [ … ] to have a length of 1 but got 2` |
| Cached `null` is a hit | hit test uses truthiness | "getDoc with useCache=true keeps a failed lookup (null)…": `called 1 times, but got 2 times` |
| getDoc uncached by default | default `useCache = true` | "getDoc re-fetches every time by default": `called 2 times, but got 1 times` |
| Full-text cache | text never stored | "full text is fetched once per document…": `expected { …(2) } to deeply equal { …(2) }` |
| configHash skips `evalsets/` | walk enters `evalsets/` | "ignores everything under evalsets/…": `expected 'f70a134000' to be 'e5dba88c03'` |

**Two mutations survived:**

- `render-trim`: `String(vars[k]).trim()` passes, because no recorded value has leading or trailing
  whitespace. On these inputs the mutation is equivalent.
- `hash-no-path`: configHash stops hashing relative paths, and the unit tests still pass. The
  `9a0f857741` reproduction below catches it, because any change to what is hashed changes that
  value. That check is a one-off measurement, not a committed test, because the `poc` branch isn't
  part of the test tree.

**`configHash()` value.** The ported function, run on scratch copies of the config
(`evidence/config-hashes.tsv`):

| Config | Hash |
| ------ | ---- |
| pristine `poc:poc/config/` | `9a0f857741`, which reproduces ORCHESTRATOR decision 3 and shows the port hashes identically |
| POC + brightside `use: eval` | `0be380ec97` |
| POC + chunk 01's `app.yaml` (no brightside edit) | `34469504cc` |
| POC + brightside + `app.yaml` (= this repo's `config/`, `diff -r` clean) | **`a113914a72`** |

The new hash is **`a113914a72`**. It differs from `9a0f857741` for two reasons. The walk hashes
every `.yaml` outside `evalsets/`, so the brightside edit alone moves the hash. Chunk 01's
`config/app.yaml` is also YAML under `config/`, so it is hashed too. Any later config YAML will move
it again, for example chunk 07's planned `config/eval-story.yaml`. `project.md` now says to compare
hashes only between runs of this repo.

## Gates

| Gate | Command | Result (finished tree) | Fails on base? |
| ---- | ------- | ---------------------- | -------------- |
| All, in order | `bash plans/2026-11-22-demo-build/02-core-libs/gates.sh` | exit 0. Lint clean; `Tests 84 passed (84)`; build `✓ Compiled successfully`; `parity: OK`; `no-fs-writes: OK (17 …)`; typecheck clean (`evidence/gates-final.txt`) | (per gate below) |
| Lint / test / build / typecheck | `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm typecheck` | exit 0 each | Standard gates; they pass on base (baseline: 0 errors, 0 warnings, 22 tests). The chunk's tests run against base source fail: `Test Files 8 failed`, `Cannot find module './config'` / `'./tier'` / `'./verify'` / `'/src/lib/fr'` (`evidence/base-falsification.txt`) |
| Gate 2 parity | `bash …/parity.sh` | `parity: OK` | **yes**, exit 1: `FAIL: config/prompts.yaml is missing` |
| Gate 3 no fs writes | `bash …/no-fs-writes.sh` | `no-fs-writes: OK (17 non-test source files under src/ scanned)` | **No, it passes on base** (`OK (11 non-test source files under src/ scanned)`, `evidence/base-no-fs-writes-widened.txt`), because base has no server code that writes. This gate guards against removed content, so the falsification is the canary: the POC's verbatim `fr.ts` fires it with 4 hits (`fs.mkdir`/`fs.writeFile` at lines 36, 37, 130, 131). The plan's literal grep *does* fire on base, but only on chunk 01's `load.test.ts:23-24`, which has nothing to do with this chunk. That is why the gate was rescoped. |

**Canaries, four steps per assertion** (`evidence/canary-parity.txt`, `evidence/canary-gate3.txt`;
files restored with `cp` and `cmp`, never git; the gate is re-run clean after each):

- **parity.sh**: one character changed in `prompts.yaml` (the plan's canary) → `FAIL: config/prompts.yaml differs from poc:…`. Same for `hearth.yaml`, `prompt-sets/strict.yaml`, an `evalsets/keys/*.json` byte, the golden fixture and `tier.ts`. Three brightside variants each fire. An extra file in `evalsets/weeks/` and a missing `prompt-sets/strict-v3.yaml` fire the file-list check. Clean before, clean after.
- **no-fs-writes.sh** (re-run after the iteration-2 widening): each of 23 call forms fires in a non-test file. They include the original six, bare `mkdir(`, `fsp.mkdir(`, `createWriteStream`, `rename`/`renameSync`, `rm(`/`rmSync`/`fs.promises.rm(`, `rmdirSync`, `copyFile`/`copyFileSync`, `cpSync`, `unlinkSync`, `truncateSync`, `symlinkSync` and `mkdtempSync`. A write in a route file under `src/app/` fires too. The POC `fr.ts` fires it. None of these fire: a comment-only line, an identifier that only contains a needle (`formatRm(`, `confirm(`), or a write in a `*.test.ts`. Clean before, clean after each canary.

Baseline captured at base `9d08486` (`evidence/baseline-*.txt`): typecheck, lint and build exit 0
with no warnings; tests 22/22. The delta: +54 tests, still no lint, type or build diagnostics.

**Runtime check (not a committed gate)**, captured in `evidence/runtime-probe/`. A throwaway route
(`route.ts.txt`) imported `@/lib/config`, `@/lib/fr` and `@/lib/prompts`.

- **Build.** `pnpm build` exited 0 (`build.exit`, `build.txt`). `nft-summary.txt` records 0
  warn/"dynamic filesystem" lines. It also records the route's `route.js.nft.json`: 145 files,
  32 under `config/` (the 31 POC files plus `app.yaml`), 4 frozen weeks, 0 under `src/`.
- **Response.** Served with `pnpm start -p 3202` and fetched with
  `curl -o response.json -w '%{http_code} %{time_total}'`. The status was `200` (`response.meta`)
  and the body was
  `{"hash":"a113914a72","presets":["hearth","ledgerly"],"problems":[],"docs":466,"len":1669}`.

That shows `server-only` resolves under Next, and that `process.cwd()/config` holds at runtime. The
route was deleted afterwards and the server killed (`port-after.txt`: `port 3202 free`).

## Judgment calls

- **`@/lib/config` resolution.** I kept `src/lib/config.ts` beside chunk 01's `src/lib/config/`
  folder, as the plan says. `tsc --traceResolution` (`evidence/trace-resolution.txt`) resolves
  `@/lib/config` → `src/lib/config.ts` and `@/lib/config/load` → `src/lib/config/load.ts`. Vitest
  resolves the same way: `presets.test.ts` imports both through `@/` and passes. Turbopack does too:
  the probe route above built and ran. A file wins over a folder, and the folder has no `index.ts`.
  This is recorded in `project.md`.
- **The mtime read cache is kept** around `readYaml`. `docBlock` calls `pipelineCfg()` once per
  document, and `prompt()` re-reads `prompts.yaml` on every call, so without the cache a 466-doc run
  would re-parse YAML about 1,000 times. The cache also keeps the POC's "an edit shows up without a
  restart" behaviour. A missing file skips the cache, so `readYaml`'s `Config error in config/<rel>`
  message comes through.
- **JSON under `config/evalsets/`** (frozen weeks and keys) is read with `JSON.parse` behind the same
  cache, not with `readYaml`. JSON is not the YAML these files are meant to be, and YAML-parsing a
  700 KB week would only add risk and time. The error text matches `readYaml`'s format.
- **The in-memory cache stores JSON strings.** That reproduces the disk cache exactly: each hit
  returns a fresh parse, so callers can't mutate cached data. A stored `null` from a failed
  `getDoc(…, true)` stays a hit: it is stored as the string `"null"`, and a hit is "the key has a
  string", never the truthiness of the parsed value. `useCache=false` still writes. Keys are the
  POC's sanitized file names.
- **`isPreset` is exported** so the "no `use` field" guard can be tested on a constructed object, as
  the plan's guard table requires.
- **`configHash(dir?)`** takes an optional directory, defaulting to `config/`. I added it so the
  function can be checked against the POC's `9a0f857741` and unit-tested on a temp copy. The walk and
  what it hashes are unchanged.
- **`prompts.ts` has no colocated `prompts.test.ts`.** The Convention Map's `src/lib` row asks for
  one. Its tests are the POC's: the golden-prompt and "renders all 14 templates" tests in
  `config.test.ts`. I kept the POC's file split so the ported tests stay diffable against their
  source (`evidence/poc-diffs/config.test.ts.diff`), rather than moving those blocks into a new file.
- **`defaultEvalset`, `currentPromptSet` and `promptSetNames` are kept.** They are cheap, and the
  plan asked for a port, not a trim. Only what the plan told me to drop was dropped.

## Deviations from the plan / from the POC source

The POC-source deviations, by file. Every hunk in `evidence/poc-diffs/*.diff` falls under one of
these:

- **`config.ts`**:
  1. `CONFIG_DIR` (with `POC_CONFIG_DIR`) is replaced by the internal, statically scoped `configPath()`.
  2. YAML goes through `readYaml`, so error text becomes `Config error in config/<rel>: …` (it was `config/<rel>: …`).
  3. The mtime cache moves into `readCached()`. A missing file now reaches the reader's labelled error
     instead of `statSync`'s raw `ENOENT`. Frozen-week and key JSON is read by `jsonFile()`.
  4. `pinConfig`, `unpinConfig` and the `pinned` flag are dropped. `git grep` over the POC finds callers only in `poc/scripts/prerun.mts` and `poc/scripts/suite.mts`, which are eval-harness scripts that don't ship.
  5. `import "server-only"` is added.
  6. `isPreset`/`presets` are added.
  7. `configHash` takes an optional `dir`, with `/*turbopackIgnore: true*/` on its dynamic joins.
  8. The header comment is updated.

  Schemas, `render`, `prompts`, `withPromptSet`, `companies`, `frozenWeek`, `loadKey`, `evalsets` and
  `validateAll` are logically unchanged.
- **`fr.ts`**:
  1. The `data/cache` file I/O is replaced by `Map<string,string>`, in `cached()` and in `getRawTextWithSource`.
  2. `import "server-only"` is added.
  3. Two comments are added or extended.

  The User-Agent `reg-monitor-poc`, the govinfo-first fetch, the literal-`<` fix and `isBlockPage`
  are unchanged.
- **`types.ts`**: only the header comment changed.
- **`config.test.ts`**:
  1. The "arena configs … cellConfig" block is removed, because it imports `src/lib/arena`, which is not ported.
  2. The "pinConfig" block is removed, because it tests the dropped function through `POC_CONFIG_DIR`.
  3. The `os`, `afterEach` and `vi` imports those blocks used are removed, otherwise lint flags them as unused.
  4. The fixture path `fixtures/` becomes `__fixtures__/`.

  The plan said these tests pass "unchanged except for import paths". For these two blocks that
  isn't possible.

Deviations from the plan:

- **Plan: `presets.test.ts` "fails today because no `use:` filter exists".** That is false. The POC
  schema already has `use: z.enum(["eval","demo"]).default("eval")` (confirmed with
  `git show poc:poc/src/lib/config.ts`), so a `use === "demo"` filter already excludes brightside
  with or without the YAML edit. The only red the order of work gives for free is "presets doesn't
  exist", an import red. The honest discriminating reds are:
  - the raw-file assertion, `expected undefined to be 'eval'` before T008;
  - the mutations above (unfiltered, `!== "eval"`, default `"demo"`, `z.any()`).

  `use: eval` in brightside.yaml protects twice over and changes no behaviour today: `presets()`
  returns `[hearth, ledgerly]` with or without it. What it does is keep brightside out if the
  schema default or the filter ever changes.
- **Plan Gate 3 grep fires on the base tree for a reason unrelated to this chunk.** The cause is chunk
  01's `src/lib/config/load.test.ts:23-24` (`fs.mkdirSync`, `fs.writeFileSync` to a temp dir). As
  written, it would also fire on this chunk's `config-hash.test.ts` (`appendFileSync` on a temp
  copy). `no-fs-writes.sh` scopes it to non-test `.ts/.tsx` under `src/`, matches fs call forms, and
  skips comment lines (widened in iteration 2).
- **Plan T003: "drop `ArenaConfig` and suite-dashboard types".** The POC's `types.ts` defines neither
  (`git show poc:poc/src/lib/types.ts | grep -n "Arena\|Suite"` → only a comment on
  `RunConfig.arena`). The arena and suite types live in `arena.ts` (`Cell`) and `suite.ts`
  (`SuiteReport`), which aren't ported. **No type was dropped.** `RunConfig`'s optional
  arena/cell/evalset fields and `RunRecord.panel`/`PanelResult` are kept because they are part of
  the run-record shape that chunk 03's `run.ts` port and the recorded runs use.
- **Plan Test Plan rows were mislabelled.** The golden-fixture equality lives in `config.test.ts`,
  not in `prompt-sets.test.ts`, which tests prompt-set overlay and isolation. There is no "malformed
  fixture" in the POC's config test. The `z.any()` row is covered by the `schema-any` mutation, and since
  iteration 2 by `config-validation.test.ts`, which rejects a bad `use` value.
- **A new dependency the plan didn't name**: `date-fns@4.4.0`. `tier.ts` and `verify.ts` import it,
  and it wasn't installed.
- **The parity gate is stronger than the plan's sketch.** It checks file lists in both directions
  for `prompt-sets/` and `evalsets/`. It rebuilds brightside exactly instead of counting `>` lines.
  It also diffs the golden fixture and the verbatim `tier.ts`, `verify.ts` and `prompts.ts`.

## Left alone

- `config/README.md` is copied verbatim and still describes `pinConfig()` and the POC's eval suite.
  It is not on the decision path. `project.md` Layout flags it.
- `config/experiment.yaml` has `userView.maxWindowDays: 7` and chunk 01's `config/app.yaml` has
  `maxWindowDays: 7`: two sources for one setting. The first is on the decision path and can't
  change. Whichever chunk wires the window picker (05) should read one of them and say which.
- The in-memory HTTP cache (`fr.ts`) is unbounded for the life of a process. Full texts can be
  hundreds of KB each, and Fluid compute reuses instances. The plan asked for the POC's semantics.
  A size bound would be a behaviour change for a later chunk to decide.
- No route imports the ported libraries yet (that is chunk 03), so `pnpm build` doesn't bundle them.
  The trace and runtime evidence above came from a throwaway route.

## Iteration 2 (review-1 FAIL fixes)

`review-1.md` is committed beside this report. Tests and the gate were the only changes; the decision
path did not change, and `parity.sh` still passes.

**Blocking 1 and 2: `src/lib/config-validation.test.ts`.** Each test copies the real `config/` to a
temp directory, `chdir`s into it, breaks one thing, and imports a fresh `config.ts`. Every branch below
was deleted with `evidence/mutate.sh`, the new file was run, and the original was restored and `cmp`'d.
Logs are in `evidence/mutations/v-*.txt`. The tests were written after the code existed, so these
deletion runs are their red runs.

| Branch (config.ts) | Test | Deletion applied | Red output |
| ------------------ | ---- | ---------------- | ---------- |
| `companies()` id/file-name throw | "a company whose id doesn't match its file name is rejected" (`id: hearth-renamed`) | `if (false)` | `expected [Function] to throw an error` |
| `validateAll()` duplicate setup id | "validateAll reports a duplicate setup id" | line removed | `expected [] to deeply equal [ 'setups.yaml: duplicate setup id' ]` |
| `jsonFile()` error wrapper | "a malformed frozen week names the file" (`[{ not json`) | `throw e` | `expected … to throw error matching /^Config error in config\/eva…/ but got 'Expected property name or '}' in JS…'` |
| `readCached()` missing-file branch | "a missing config file names the file, not a bare ENOENT" (`pipeline.yaml` deleted) | rethrow the `statSync` error | `… but got 'ENOENT: no such file or directory, st…'` |
| `validateAll()` unknown prompt set | "validateAll reports a setup naming a prompt set that has no file" | line removed | `expected [] to deeply equal [ Array(1) ]` |
| `validateAll()` minAgree > judges | "validateAll reports minAgree above the number of judges" | line removed | `expected [] to deeply equal [ Array(1) ]` |
| `CompanySchema.use` enum | "a company with an unknown use value fails the schema…" (`use: maybe`) | `z.string().default("eval")` | `expected [Function] to throw an error` |

A control test checks that the unbroken temp copy gives `validateAll() == []`. Each `validateAll` test
asserts the full problem list with `toEqual`, so a broken copy has to produce exactly the one problem
it planted.

**Warnings.**

- **Pattern widened.** `no-fs-writes.sh` now matches the call form `\b(<api>)\s*\(` for every fs API
  that creates, changes or deletes a file or folder. Canaries are listed under Gates above and in
  `evidence/canary-gate3.txt`.
- **Scope widened** from `src/lib` to every non-test `.ts`/`.tsx` under `src/`, so the gate now
  matches the project.md convention "No filesystem writes in server code". project.md now describes
  what the gate scans. On base it still passes (11 files); it guards against content being added, so
  its falsification is the canaries.
- **Hash wording.** The rubric speaks of the hash difference "as the brightside edit alone". This
  report keeps the measured breakdown (brightside → `0be380ec97`, plus `app.yaml` → `a113914a72`),
  which the reviewer confirmed.

Gates re-run after the last code edit: `bash plans/2026-11-22-demo-build/02-core-libs/gates.sh` →
exit 0, `Tests 84 passed (84)`, `parity: OK`, `no-fs-writes: OK (17 …)`, typecheck clean
(`evidence/gates-final.txt`).
