# Reg Monitor

A weekly triage of federal rules for the general counsel of a mid-size company.

Pick a company profile and a week. The monitor scans the Federal Register, keeps only the
rules that affect the company, and returns each one as an action item: tier, deadline,
owner, affected areas and source link. Any deadline under 90 days is Critical, and every
date and citation is checked against the primary source, so an item can be forwarded
without re-checking it. A frozen, hand-checked eval set measures how well it does this,
against a single prompt to a frontier model.

## Submission

**→ Resources and execution history: [`/submission`](http://localhost:3000/submission)**
(one page with everything below, including the four build transcripts as rendered HTML).
The transcripts don't render on GitHub, so read them there. Run the app locally first
(see below); it is not deployed.

| | |
| --- | --- |
| **Prototype** | http://localhost:3000. The landing page opens either the GC app or the eval results |
| **Eval results** | http://localhost:3000/evals: verdict and headline numbers first, then iterations, cases, models, runs, traces and the live setup |
| **Design** | [Lo-fi, mid-fi and hi-fi screens](public/submission/design-screens.html): one self-contained HTML file, drawn before any product code |
| **Build transcripts** | [Four Claude Code sessions](http://localhost:3000/submission#execution) in the order they ran: proof of concept, eval iterations, brainstorm and plan, build |
| **Spec-driven development** | [The method this was built with](https://anfalmushtaq.com/articles/primitives-of-spec-driven-development) |

The spec, the eleven chunk plans, every review iteration and the execution log are checked
in under [`plans/2026-11-22-demo-build/`](plans/2026-11-22-demo-build/).

## What's in the app

| Surface | Where | Needs a key |
| ------- | ----- | ----------- |
| Landing page: pick the GC app or the eval results | `/` | No |
| GC app: new run, live progress, report, follow-up chat | `/runs/new`, then `/runs/<id>` | Yes, for the run, area suggestions and the chat |
| Recorded example runs, listed in the GC sidebar | `/examples/<id>` | Only for the follow-up chat |
| Eval view: summary, live setup, iterations, cases, runs, models, traces | `/evals` | No |
| Submission page: design, transcripts, links | `/submission` | No |

Runs a GC starts are saved in that browser's IndexedDB only; there is no server database.

## How it works

```
Config → Scan → Filter → Verify + Tier → Output
```

1. **Config.** Company profiles, prompts, models, thresholds, tier rules and the eval sets
   are all YAML or JSON under `config/`. The setup every run uses is named by
   `config/experiment.yaml` → `userView.setup`. `/evals/setup` shows it in full.
2. **Scan.** Fetches the window's documents from the Federal Register API.
3. **Filter.** A cheap decision model scores every document's relevance to the company and
   drops the clear misses. Sonnet 5.5 then makes the call on the rest, reading the most
   relevant passages of each top-ranked document's full text, not just the abstract.
4. **Verify + Tier.** Code, not a model, re-fetches each kept document, drops any date or
   citation that doesn't match the source, and assigns the tier.
5. **Output.** The model writes one plain-English action per item, with no dates or
   citations; those come from verified data. The report downloads as Markdown or JSON.

## Running locally

Requires Node 24 and pnpm 9 (`packageManager` in `package.json` pins `pnpm@9.15.4`).

```bash
pnpm install
echo "AI_GATEWAY_API_KEY=<your Vercel AI Gateway key>" > .env.local
pnpm dev                     # http://localhost:3000
```

Without a key, everything except a live run, area suggestions and the follow-up chat still
works: the landing page, the eval view, the example runs and the submission page. To browse
without spending credit, run `AI_GATEWAY_API_KEY= pnpm dev`.

In a git worktree, `bash scripts/bootstrap.sh` installs dependencies and provides
`.env.local` from the main checkout.

### Environment variables

| Variable | Required for | Notes |
| -------- | ------------ | ----- |
| `AI_GATEWAY_API_KEY` | Live runs (`/api/run`), area suggestions, the follow-up chat | Read only on the server; never sent to the browser. **Spends money:** a live run costs about $0.24 (the live setup's `estUsd` in `config/setups.yaml`). |

## Commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Development server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serves the production build |
| `pnpm test` | Vitest, once |
| `pnpm lint` | ESLint over the project |
| `pnpm typecheck` | `tsc --noEmit` |
| `bash scripts/verify-eval-bundle.sh` | Checks the shipped eval data in `public/evals/` |

The full table the verification gates run, including rebuilding the eval bundle from the
`poc` branch, is in `.claude/resources/project.md` under **Commands**.

## Deploying (optional)

Production deployment is a non-goal of the assignment, and the demo runs locally. The app
is built to run on Vercel if needed:

- Import the repo with the Next.js preset, root directory = repo root, package manager pnpm.
- Set `AI_GATEWAY_API_KEY` as a server-side environment variable.
- After deploying, check:
  - `/` opens the landing page.
  - `curl -N "https://<deploy>/api/probe/stream?seconds=90"` prints `tick 1` … `tick 90` and
    ends in `done` (a streamed response survives a full-length run).
  - `https://<deploy>/evals/index.json` and one trace, e.g.
    `https://<deploy>/evals/user-view/traces/<runId>.jsonl.gz`, are served.

## How work happens here

Non-trivial changes run through the spec-driven loop in `.claude/`. Read
`.claude/README.md` for the loop and `.claude/resources/project.md` for the stack,
commands, principles and conventions a reviewer will cite. `CLAUDE.md` (Claude Code) and
`AGENTS.md` (other coding agents) point there.
