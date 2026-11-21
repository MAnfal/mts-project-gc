---
id: resources/project
description: The living record of what this project is — stack, commands, principles, conventions. Every phase of the loop reads it; plans keep it current.
---

# Project Facts

**This file is the single source of truth for what the project looks like.** Every phase of
the loop reads it, and nothing else in `.claude/` names a language, a framework, or a
command — they all defer here. Swap this file and the same framework drives a different
stack unchanged.

Keep it short and true. Delete what does not apply rather than leaving a placeholder that
reads as a fact.

## How this file stays current

It is written and maintained by the loop, not filled in once and left:

| When | Who | What changes |
| ---- | --- | ------------ |
| Before the first plan, if the stack is already known | You | Stack, Commands, Principles |
| Chunk 01 of a bootstrap plan, if it isn't | That chunk, as its deliverable | Stack, Commands, Principles, Convention Map, Layout |
| During a chunk that changes an architecture fact | The implementer, **in the same chunk** | Whichever section the change made false |
| At each wave boundary | The lead | Anything the merged wave invalidated |
| At delivery | `/plan:complete` Part 2 | Conventions learned, gotchas, promoted tribal knowledge |

**An architecture fact changed by a chunk is updated by that chunk.** A new dependency, a
new command, a new kind of file, a moved directory, a new principle — these are not
delivery-time cleanup. A stale Convention Map is read by `generate-chunk-rubric` when it
builds the *next* chunk's rubric, so staleness here compounds into unreviewed work.

**Every claim here is measured, never assumed.** Read versions off what is installed on
disk, and run each command before writing it into the table.
`.claude/resources/prompts/evidence.md` binds this file as much as any plan.

## Stack

**Not yet measured — nothing is installed.** Chunk 01 of the bootstrap plan scaffolds the
project and writes this section from what actually landed (versions read off disk, not
from manifest ranges).

What the RFC fixes, recorded here as requirements rather than measurements:

- **Agent harness**: Flue (https://flueframework.com/), an open-source framework built on
  top of Pi. Language, runtime and package manager follow from what Flue requires —
  established by chunk 01, not assumed here.
- **Primary data source**: the Federal Register API. The agent may also use web search for
  leads, but only items that resolve to a primary-source record are surfaced.

## Commands

The verification gates run these. Use the exact invocation, not a description of it. Mark
anything that does not exist yet as `N/A` — a gate skips an `N/A` command rather than
inventing one.

**Bootstrap** is what makes a newly created worktree able to run the gates: installing or
symlinking dependencies, linking gitignored files the app needs (`.env` and friends), and
any codegen. It runs once per worktree, before an implementer is dispatched into it. Get
this wrong and every chunk's first gate run fails for reasons unrelated to its work.

All commands run from the repository root.

| Gate | Command |
| ---- | ------- |
| Install | N/A |
| Bootstrap a fresh worktree | N/A |
| Type check | N/A |
| Lint | N/A |
| Unit tests | N/A |
| Build | N/A |
| Run a monitor pass | N/A |
| Run the evals | N/A |

## Principles

The project's constitution: the rules a plan is checked against before it's approved, and
that a reviewer can cite. Keep the list short — five or six you would actually block a PR
over. Each one is a rule, not an aspiration, and each says what it forbids and what a
violation looks like.

Amend deliberately: a principle changed mid-plan invalidates the reasoning of every chunk
approved under it, so record the date and the reason when one changes, and note which
version each plan was checked against.

**Draft, 2026-11-21 — derived from the Regulatory Monitoring RFC, to be ratified at the
first `/plan:brainstorm`.** Each restates an RFC requirement; none yet names a file, because
none exists.

1. **Tier is assigned by code, never by a model.** A deadline under 90 days is Critical.
   Violation: a tier value produced by, or overridable by, an LLM output. Same input, same
   tier, every run.
2. **Only primary-source records are surfaced.** Web search may supply leads; an item that
   does not resolve to a primary-source record never reaches the output. Violation: an
   action item whose source link is not the official record.
3. **Every surfaced date and citation matches the primary source.** Each relevant document
   is re-fetched from its primary source, and any date or citation that does not match is
   dropped. Violation: a date or citation in the output that was not checked against the
   re-fetched record.
4. **No paid APIs, no state-level sources.** Violation: a paid fetch, or a state-level
   source, anywhere in the pipeline. (Also out of scope: scheduled runs, internal doc
   mapping.)

A chunk that violates a principle needs an explicit justification in the plan's Design
Decisions, or it doesn't ship. "This was easier" is not a justification.

## Convention Map

What each kind of file must satisfy. The `generate-chunk-rubric` skill reads this to build
each chunk's review checks, and the gates listed here are what a chunk touching that area
runs. A path matching several rows collects all of their checks.

Fill it in as the project grows — an empty map means every rubric is only as good as what
the planner remembered that day, and `generate-chunk-rubric` will say so out loud rather
than emit a thin rubric silently.

Globs are written relative to the repository root.

**The `Doc` column points at a bible leaf page** under `.claude/resources/bibles/` — the
page carrying the rule, found by following that bible's `decision-tree.md`. Never cite the
decision-tree itself; a reviewer handed a routing table grades from memory. Use `—` when no
page applies, and the review check ships without a citation rather than with an invented
one.

| Files | Gates | Review checks | Doc |
| ----- | ----- | ------------- | --- |

*Empty until chunk 01 establishes the layout.*

**Anything under `.claude/` is governed by the prompt-engineering bible** whether or not a
row above matches it. `generate-chunk-rubric` adds those citations on its own — see that
skill's "When the chunk touches `.claude/` itself".

## Conventions

Things an implementing agent would otherwise get wrong. Add to this as they surface — a
convention learned during execution belongs here in the same change that learned it, not in
a follow-up.

*None recorded yet.*

## Layout

Where things live, and what belongs where.

```
.claude/        The spec-driven loop: prompts, bibles, skills, and this file.
plans/          Plan directories — one per plan, with SPEC, chunks and retro.
```

Everything else is written here by chunk 01 once it exists.
