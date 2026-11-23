# Regulatory Monitoring

A weekly triage of federal rules for the general counsel of a mid-size company. Pick a company
profile and a date window; the monitor scans the Federal Register, keeps only the rules that affect
the company, and returns each as one action item (tier, deadline, owner, affected areas, source
link). Any deadline under 90 days is Critical, and every date and citation is checked against the
primary source. The report downloads as Markdown or JSON.

## What's in the app

| Surface | Where | Needs a key |
| ------- | ----- | ----------- |
| GC run: new run, live progress, report, follow-up chat | `/runs/new` (`/` redirects there) | Yes, for the run, area suggestions and the chat |
| Recorded example runs, listed in the sidebar | `/examples/<id>` | Only for the follow-up chat |
| Eval view: results, iterations, models, runs, traces | `/evals` | No |

## Prerequisites

- Node 24
- pnpm 9 (`packageManager` in `package.json` pins `pnpm@9.15.4`)

## Setup

```bash
pnpm install
```

Create `.env.local` at the repo root:

```
AI_GATEWAY_API_KEY=<your Vercel AI Gateway key>
```

A live run spends AI Gateway credit, about $0.24 a run (the live setup's `estUsd` in
`config/setups.yaml`). Without a key, everything but the run, the area suggestions and the
follow-up chat still works. In a git worktree,
`bash scripts/bootstrap.sh` installs dependencies and provides `.env.local` from the main checkout.

## Run locally

```bash
pnpm dev
```

Open http://localhost:3000. To try it without spending credit, run `AI_GATEWAY_API_KEY= pnpm dev`:
`/runs/new`, `/evals` and the examples load, and the model calls fail instead of spending.

## Tests and checks

The command table (type check, lint, tests, build, eval-bundle verification) lives in
`.claude/resources/project.md` under **Commands**. The everyday ones:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Deploy (Vercel)

- Import the repo with the Next.js framework preset, root directory = repo root, package
  manager pnpm.
- Set `AI_GATEWAY_API_KEY` in the project's environment variables.
- After deploying, check:
  - `/` opens the new-run screen.
  - `curl -N "https://<deploy>/api/probe/stream?seconds=90"` prints `tick 1` … `tick 90` and ends in
    `done` (a streamed response survives a full-length run).
  - `https://<deploy>/evals/index.json` and one trace, e.g.
    `https://<deploy>/evals/user-view/traces/<runId>.jsonl.gz`, are served.
