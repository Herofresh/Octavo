# Agent Rules — Octavo

## Mission

Build and maintain Octavo as a lightweight, file-first agent workspace.

## Core Principles

- simplicity over abstraction
- clarity over cleverness
- small modules over large systems
- explicit flows over hidden logic

## Implementation Style

- use plain JavaScript unless necessary
- prefer minimal dependencies
- use JSDoc or simple schemas where helpful
- avoid premature abstraction

## File Rules

- keep files under ~300 lines when possible
- split files when they grow too large
- one responsibility per module

## Planning Rules

- root Backlog.md tracks global milestones and cross-idea progress
- for now, use one canonical base handover file at `handover/HANDOVER.md`
- the canonical handover must always include:
  - a `Context File Index` with relevant source/context files
  - a `Current Plan — Next Steps` section aligned to active backlog tasks/milestones
- ideas are planning-only and live in `workspace/ideas/<ideaId>/` with `idea.md` + `conversation.ndjson`
- do not start runs directly from idea editing/refinement
- each approved project must use its own backlog.md project under workspace/projects
- each project must reference the source idea and keep associated run loops
- each run is one execution loop for one or more project backlog tasks
- before doing work on a task, set that task status to In Progress
- when a task is complete, move it to Done
- always update the active project backlog during work
- sync important status changes back to root Backlog.md
- reflect real progress
- mark blockers clearly

## Git Workflow

- never work on main
- always create a feature branch
- keep commits readable
- provide clear summaries

## Execution Rules

- do not start without approval
- once approved, proceed autonomously
- stay within defined scope
- when opening a new execution run, link it to an existing project backlog (create project backlog only if missing)
- run checks before completion
- if required commands are blocked by missing permissions/sandbox limits, explicitly request permission escalation before proceeding
- after approved changes and before starting a new task, clean prior smoke/test artifacts

## Storage Rules

- markdown and JSON are source of truth
- avoid database usage in core runtime
- keep files readable and structured

## Model Rules

- use runtime wrappers
- do not bind system to one provider
- keep model usage replaceable

## UI Rules

- lightweight
- readable
- minimal complexity
- neon / futuristic aesthetic without clutter

## Testing

- run relevant checks
- report results honestly
- include summary + next steps

## Memory

- keep it explicit and scoped
- prefer written summaries
- avoid complex systems in V1

## Workspace Roles

- `workspace/agents/` stores agent archetype personalities and constraints
- `workspace/skills/` stores skill definitions for agents
- `workspace/scheduler/` stores scheduled execution definition files

## Decision Priority

Choose solutions that are:

1. easy to understand
2. easy to modify
3. easy to replace
4. easy to run locally
