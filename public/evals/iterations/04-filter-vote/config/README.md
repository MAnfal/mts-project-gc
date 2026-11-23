# config/ — everything the experiment runs on

The code only executes what's in here. Edit a file and the next run picks it up; no code change and no restart.
An eval suite pins the config when it starts (`pinConfig()`), so editing a file mid-suite can't change or crash it.
Every file is validated on load (`pnpm test` runs the cross-file checks too).

```
config/
├── experiment.yaml      budget cap, Jev + judge models, arena concurrency, default eval set, RFC gates
├── setups.yaml          models (+ baseline web search), methods, and the `setups` the eval suite compares
├── judges.yaml          judge panel: 3 vendors, minAgree (2 of 3), criteria
├── pipeline.yaml        knobs: tier rules (90 / 30 days), batch sizes, concurrency, text limits
├── prompts.yaml         every prompt's wording, with {{placeholders}} (output-field descriptions stay in the code's schemas)
├── prompt-sets/         partial prompt overrides a setup can opt into (e.g. strict.yaml)
├── companies/           one profile per file; `use: eval` (in eval sets) or `use: demo` (held out, user view only)
│   ├── brightside.yaml  eval · packaged food          ├── ledgerly.yaml  demo · payments app
│   ├── cornercare.yaml  eval · pharmacy chain         └── hearth.yaml    demo · home appliances
│   └── skyhop.yaml      eval · regional airline
└── evalsets/
    ├── manifest.yaml    which (company, week) pairs are eval sets; each week is split dev (tuned on) or test (held out)
    ├── weeks/           frozen Federal Register input, one JSON per week
    └── keys/            answer keys, one JSON per company-week (frozen ones have `provenance`)
```

## How to…

| I want to… | Edit |
|---|---|
| add a contestant | `setups.yaml → setups` (model + method + optional promptSet); new models also go under `models` |
| try a prompt variant | new `prompt-sets/<name>.yaml` overriding only what changes; point a setup at it |
| change the judge panel | `judges.yaml`, then `npx tsx scripts/judge-panel.mts <arenaId>` re-judges without re-running |
| change the Jev cut-off | `setups.yaml → methods[jev+llm].jevThreshold` |
| change what "Critical" means | `pipeline.yaml → tiering` |
| tweak a prompt | `prompts.yaml`. The prompt tests then fail on purpose, because old runs were made with the old text. Run a new arena, then `npx tsx scripts/record-prompt-fixtures.mts <arenaId>` |
| add a company | new `companies/<id>.yaml` (file name = `id`) |
| add an eval set | add the week to `manifest.yaml → weeks` + its JSON in `weeks/`, a key in `keys/`, and an entry in `manifest.yaml → evalsets` |
| raise the budget | `experiment.yaml → budgetUsd` |

## What stays in code, and why

The code keeps the following, because they're logic rather than settings:
- zod output schemas (including the field descriptions models see)
- tool construction for the search clients
- the date-stripping regex and the date-quote verifier
- the filter's retry-once contract
- the smoke-test script's probe prompts

Run outputs stay in `data/runs/`, since they're results, not config.

"Frozen" covers the week's document list only. Verification still re-fetches each document live from federalregister.gov, which is the point of verifying, and full text is cached in the gitignored `data/cache/`.

Each run records a `configHash` of the YAML files it ran under. Nothing compares hashes automatically yet; the hash is a record. Note that editing the budget also changes it.
