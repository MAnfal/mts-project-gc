# Regulatory Monitoring — Demo Build

## Problem Statement

The regulatory-monitoring workflow is proven only as a throwaway POC on the `poc` branch:
a Next.js app with dev-only pages that writes to local disk and can't be deployed. The
take-home review needs a deployed Vercel app that shows two things. A GC can run a live
weekly triage and get back a verified, owner-routed report. A reviewer can follow the eval
story (context → iterations → results → learnings) and drill down to any run's trace. The
POC's recorded evals, which cost ~$125 to produce, carry over unchanged as the evidence.

## User Stories

### US1 — GC runs a live weekly triage `[P1]`

**As** the General Counsel of a mid-size company, **I want** to pick my company profile
and a week, then watch the monitor work and get back only the federal rules that affect
us, each with a priority, deadline, owner and source, **so that** I can triage in ten
minutes and forward items without re-checking them.

**Acceptance Criteria:**

- Given the new-run screen, When I pick the Ledgerly preset and the week Nov 2–6 2026 and
  press Run, Then I see each pipeline step stream in under a plain-English name (no
  internal model name), with counts and timings, and the report appears when the run
  finishes.
- Given a finished run, When I read the report, Then every item shows a priority assigned
  by code, a deadline verified against the Federal Register (or none), an owner from the
  profile's areas, and a link to the official record.
- Given a step that fails 3 times in a row, When the run stops, Then the failed step shows
  a timeout message and a Retry button that reruns with the same settings, and the failed
  run is still listed after a page reload.
- Given I edit a preset's profile or owners, When I run, Then the run uses my edited
  profile, and the preset's file on the server is unchanged.
- Given a run in which nothing applies, or an item fails verification, When the report
  renders, Then it says "nothing affects you" with the closest calls, or lists the
  held-back item separately instead of in the report.

**Independently testable because:** with no eval screens and no chat, a GC can still run a
live triage end to end on the deployed URL.

### US2 — Reviewer follows the eval story `[P1]`

**As** an interviewer reviewing the take-home, **I want** a summary that states the
verdict and the CARL story first, then drill-down to iterations, cases, model comparison
and raw traces on demand, **so that** I can judge the eval work in minutes without being
overwhelmed.

**Acceptance Criteria:**

- Given the eval summary, When it loads, Then the headline verdict, the CARL rows, the
  scoreboard (target / live, all weeks / held-out / baseline) and the iteration chart all
  come from the recorded data, and each number names its split and run count.
- Given an iteration, When I open it, Then I see its hypothesis, change, result against the
  setup it replaced, what moved, and the decision.
- Given the cases view, When I select a case and a run, Then I see the filter's reason, the
  trace-check result and the judge verdicts, and I can open that run's full trace.
- Given the models page, When it loads, Then it compares every model the arena ran on the
  same measures and states why the live model was chosen.
- Given any recorded suite, When I look for its runs and traces, Then all 9 suites, the 22
  example runs and iterations 00–07 are present. No recorded result is dropped.

**Independently testable because:** with no live pipeline at all, the eval screens are
fully static and demo the evaluation work on their own.

### US3 — GC asks follow-up questions about a report `[P2]`

**As** the GC, **I want** to ask questions about a finished report ("summarize for the
CEO", "did anything on crypto come close?"), **so that** I can reuse the result without
rerunning anything.

**Acceptance Criteria:**

- Given a finished report, When I ask a question, Then the answer streams in and uses only
  the report, its sources and the run's screened-out list.
- Given no finished report, When the screen renders, Then the chat box is hidden.

**Independently testable because:** it needs only US1's finished-report state, which a
recorded example run already provides.

## Clarifications

| Question | Answer | Date |
| -------- | ------ | ---- |
| Agent harness: Flue/Pi or plain AI SDK? | Plain Vercel AI SDK + AI Gateway, as in the POC. No separate server, sandbox or shell is needed for this workflow. | 2026-11-22 |
| Where do live runs and traces persist? | In the browser's IndexedDB only. The server is stateless, and raw traces of live runs are not kept server-side. | 2026-11-22 |
| What happens when a step fails? | Retry with growing back-off, up to 3 attempts. Then the run fails, showing a timeout message under the step and a Retry that keeps the settings. The failed run is saved to IndexedDB. | 2026-11-22 |
| Spend guard on the public URL? | None in code. The demo runs on the ~$20 Gateway balance. | 2026-11-22 |
| How do the recorded evals ship? | All of them (9 suites, example runs, iterations) as static files in the repo, deployed via Git (~97 MB gzipped). Fall back to Vercel Blob or R2 for traces only if a deploy fails on size. | 2026-11-22 |
| Visual language? | GC AI's app: Inter, cream canvas, navy primary, stone accents, paired status colours, three-pane shell. Our own name "Reg Monitor", no GC AI logo. Locked hi-fi in `design/`. | 2026-11-22 |
| Model comparison? | Its own "Models" page in the eval view. | 2026-11-22 |
| Deploy setup? | Stop after chunk 01. The user merges to `main` and wires up Vercel before any other chunk starts. | 2026-11-22 |

## Success Metrics

- A live run for a 5-day window completes on the deployed URL in under 120 s typical, and
  never exceeds the 300 s function limit; the POC measured 65 s typical and 87 s worst case.
- The live setup's decision path (prompts, prompt set, setup knobs, tier rules, companies)
  is byte-identical to the evaluated POC configuration, so the recorded eval numbers
  describe what the demo runs.
- 100% of recorded runs (9 suites, 22 example runs) and their traces are reachable from the
  eval view; the count of runs in the deployed bundle equals the count in the POC.
- No internal model or component name appears anywhere in the GC-facing screens or in their
  network responses.
- A reviewer reaches any single run's raw trace in at most 3 clicks from the eval summary.
- Every screen works at a 390 px width without horizontal page scroll.

## Non-Goals

- **Authentication, user accounts, a server database.** The assignment rules them out; the
  only persistence is the browser's IndexedDB.
- **A spend guard or rate limit.** Explicitly declined for the demo.
- **Running new evals from the deployed app.** The suites are recorded and read-only. The
  eval harness stays on `poc` and doesn't ship.
- **Flue/Pi, sandboxes, a shell or code-execution tools.** Deferred, not needed for this
  workflow.
- **Web-search leads.** They're off in every evaluated setup, so they stay off.
- **Scheduled runs, email/Slack delivery, state-level sources, paid data APIs, internal
  document mapping.** These are out of RFC scope.
- **The take-home write-up.** The user writes it without AI.
