# Project

**Regulatory Monitoring** gives a GC at a mid-size fintech a weekly triage of federal  
rules: run the monitor over a date window and get back only the rules that affect the  
company, each as one action item (tier, deadline, owner, affected areas, source link) in  
`report.json` + a markdown report. Any deadline under 90 days is Critical, and every date  
and citation is checked against the primary source, so items can be forwarded without  
re-checking.

Pipeline: Config → Scan (Federal Register API + web leads) → Filter (LLM) → Verify + Tier  
(code) → Output (LLM) → `report.json`/`.md`. Harness: Flue (https://flueframework.com/),  
built on Pi.

Success, measured on a frozen hand-labeled eval set (3 companies × 4 past weeks): recall  
≥ 0.9, precision ≥ 0.8, 100% of dates and citations verified, tier identical across 3 runs,  
relevance agreeing across 3 runs on ≥ 90% of docs, and beating a single-prompt frontier-model  
baseline. Out of scope: paid API fetches, scheduled runs, internal doc mapping, state-level  
resources.

## How work happens here

Non-trivial work runs through the spec-driven loop in `.claude/`:

```
/plan:brainstorm  →  /plan:execute  →  /plan:complete
```

- **Start at** `/plan:brainstorm`**.** It explores the idea with you and — once you  
approve — writes the plan. Don't improvise a plan instead; the loop exists because  
unplanned multi-file changes are the ones that turn out unreviewable.
- `/plan:list` shows what's active and numbers it; `/plan:execute <#>` runs an  
approved plan and `/plan:complete <#>` ships and closes it.

Read `.claude/README.md` for the loop, and `.claude/resources/project.md` for this  
project's principles, commands, and conventions. **Read** `project.md` **before writing code**  
— it holds the rules a reviewer will cite.

## Non-negotiables

These hold whether or not a plan is running:

1. **Tests first, and seen failing.** A test that has never been observed red is not  
 evidence that it checks anything.
2. **Evidence, not claims.** "Tests pass" is a claim; the command and its output is  
 evidence. A capped or scoped search proves presence, never absence.
3. **Reuse before invention.** Grep for an existing helper before writing a new one.
4. **Never merge your own PR.** The PR is the review surface; the user merges.
5. **Scope is what was asked.** Adjacent problems get reported, not fixed.

## Stack and commands

`.claude/resources/project.md` **holds them.** Stack and versions, the command table the  
verification gates run, the Principles, the Convention Map, and the conventions an  
implementer would otherwise get wrong — all in one file, kept current by the chunk that  
changes each fact.

This file deliberately does **not** restate them. Two copies of a command table drift, and  
the copy a session happens to read first wins.

## Recent Work

<!-- One line per completed plan, newest first. Added by /plan:complete. -->

- **POC eval loop matured** 2026-11-22: 12 frozen company-weeks (dev/test split), subset precision grading,
per-step scores, and an evidence gate. Every iteration needs a dev-only error analysis (incl. judge
feedback) first, and a gap counts only beyond the control's A/A swing. Iterations 00–05 and findings are in
`poc/README.md` and `poc/data/iterations/`.

- **Knowledge layer added** 2026-09-19: `.claude/resources/bibles/` holds the engineering  
and prompt-authoring standards the loop cites. Brainstorm, planning, rubric generation,  
implementation and review all route through it.

## Communication instructions.

- Keep your messages short, concise and reflect the user's voice and tone. An ideal response back to the user is 1 - 2 sentences long, states the high level concern and waits for the user for clarifying  question. Only go in details if the user asks you to but treat the depth as layered and reveal more details in layers not at once.

