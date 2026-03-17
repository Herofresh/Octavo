# Handover — Dual Backlog Policy (2026-03-17)

## What Was Done

- Updated core policy docs to define a dual backlog model:
  - root `BACKLOG.md` for global roadmap and milestone tracking
  - per-run `backlog.md` project for execution in each repo/branch sandbox
- Updated the following source-of-truth files:
  - `VISION.md`
  - `SYSTEM.md`
  - `AGENT.md`
  - `ARCHITECTURE.md`
  - `BACKLOG.md`
- Added execution-next tasks to `BACKLOG.md` for implementing per-run backlog initialization and status synchronization.
- Added matching `backlog.md` tasks:
  - `TASK-34` (done): document dual backlog policy
  - `TASK-35` (todo): per-run backlog init on execution start
  - `TASK-36` (todo): link run backlog to root milestone/task
  - `TASK-37` (todo): status sync run -> root

## Current State

- Policy is now explicitly documented: agents must use run-specific backlog projects during execution.
- Root backlog remains the portfolio-level control and reporting surface.
- Backlog task store now includes implementation tasks for the policy.

## Remaining Tasks

- Implement automatic backlog initialization in new execution workspaces.
- Define and persist root-task <-> run-backlog linkage metadata.
- Implement status rollup from run backlog to root backlog.
- Decide how to consolidate duplicate runtime-interface tasks (`TASK-5` and `TASK-20`).

## Known Issues

- Duplicate/near-duplicate tasks still exist for runtime interface in backlog task store.
- Root `BACKLOG.md` and `backlog/tasks` are aligned conceptually but not yet auto-synced.

## Next Recommended Step

Implement `TASK-35` first: when execution creates or opens a run workspace, initialize `backlog/` in that workspace and store the path in run metadata.

## Relevant Files To Read Next

- `SYSTEM.md`
- `AGENT.md`
- `ARCHITECTURE.md`
- `BACKLOG.md`
- `backlog/tasks/task-35 - Implement-per-run-backlog.md-initialization-on-execution-start.md`
- `app/lib/backlog.js`
- `app/server.js`
