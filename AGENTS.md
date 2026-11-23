# AGENTS.md

Instructions for coding agents working in this repository. Claude Code reads `CLAUDE.md`;
this file carries the same rules for every other agent. The facts themselves live in
`.claude/resources/project.md`, and both files point there rather than restating them.

## Project

**Reg Monitor** gives the general counsel of a mid-size company a weekly triage of federal
rules: run the monitor over a date window and get back only the rules that affect the
company, each as one action item (tier, deadline, owner, affected areas, source link).
Next.js 16 app with two surfaces: the GC app (`/runs/new`) and a reviewer-facing eval view
(`/evals`), behind a landing page at `/`. The README describes both and how to run them.

## Read before writing code

1. **`.claude/resources/project.md`** holds the stack and versions, the command table the
   verification gates run, the Principles, the Convention Map (which checks apply to which
   paths), and the Layout. Reviewers cite it.
2. **`.claude/README.md`** describes the spec-driven loop non-trivial work runs through:
   brainstorm → plan → execute (implementer + independent reviewer per chunk) → complete.
   Plans live under `plans/`.

## Non-negotiables

1. **Tests first, and seen failing.** A test that has never been observed red is not
   evidence that it checks anything.
2. **Evidence, not claims.** "Tests pass" is a claim; the command and its output is
   evidence. A capped or scoped search proves presence, never absence.
3. **Reuse before invention.** Search for an existing helper before writing a new one.
4. **Never merge your own PR.** The PR is the review surface; the user merges.
5. **Scope is what was asked.** Adjacent problems get reported, not fixed.

## Rules specific to this project

- **Configuration lives in `config/`** (YAML and JSON): prompts, models, thresholds, tier
  rules, company profiles, eval sets. Code executes it; don't hard-code a value that belongs
  there. Read YAML only through `readYaml` (`src/lib/config/load.ts`).
- **The pipeline's decision path is frozen.** It was ported byte-identical from the proof of
  concept so the recorded evals still describe what runs. Changing it means the scores on
  `/evals` no longer apply; the parity gate in the plan fails on it.
- **No eval number is typed by hand** in the eval view or `config/eval-story.yaml`. Numbers
  come from `public/evals/index.json`; prose uses `{{placeholders}}`.
- **GC-facing screens never name internal components or models.** That is the GC app and
  the landing page; the eval view is for reviewers and may.
- **The tier is assigned by code**, never by a model.
- **Never commit `poc/`.** It exists only on the `poc` branch.
- **Never print or commit secrets.** `AI_GATEWAY_API_KEY` is read on the server only, from
  `.env.local`. A live run spends real money.

## Next.js 16

This version has breaking changes; APIs, conventions and file structure may differ from your
training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next
code, and heed deprecation notices. `next.config.ts` sets `agentRules: false`, so `next dev`
does not inject its own block into this file.
