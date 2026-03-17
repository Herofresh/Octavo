# Handover — Idea Execution + Root Sync (2026-03-17)

## What Was Done

- Implemented file-first idea flow (`TASK-25`):
  - `POST /api/ideas` (create idea)
  - `GET /api/ideas` (list ideas)
  - `GET /api/ideas/:ideaId` (read idea)
  - ideas stored in `workspace/ideas/<ideaId>.json`
  - added idea module: `app/lib/ideas.js`
- Updated execution endpoint to start only from an existing idea record:
  - `POST /api/ideas/:ideaId/execute`
  - returns `404` if idea does not exist
  - updates idea state to `executing` and appends run history
- Implemented provider-agnostic runtime interface (`TASK-20` + `TASK-5`):
  - added runtime module: `app/lib/runtime.js`
  - provider registry + default runtime config
  - built-in `mock` provider
  - `GET /api/runtime/providers`
  - `POST /api/runtime/complete`

- Implemented run backlog initialization on execution start (`TASK-35`).
- Implemented run-to-root linkage metadata (`TASK-36`) in run metadata:
  - `idea.id`
  - `rootLink.taskId`
  - `rootLink.milestone`
- Implemented run-to-root status sync (`TASK-37`):
  - added `POST /api/runs/:runId/sync-root`
  - upserts a `## Run Sync` section in root `BACKLOG.md`
  - stores sync snapshot in `run.json` under `sync.rootBacklog`
- Added idea execution start endpoint:
  - `POST /api/ideas/:ideaId/execute`
  - creates/opens run workspace + run backlog
  - stores root linkage metadata
  - performs root sync by default

## Current State

- Dual backlog contract is now operational:
  - per-run backlog project is auto-initialized
  - run metadata persists backlog path and root linkage
  - root backlog receives run status rollup entries
- Root `BACKLOG.md` and backlog tasks are updated:
  - `TASK-5`: Done
  - `TASK-20`: Done
  - `TASK-25`: Done
  - `TASK-35`: Done
  - `TASK-36`: Done
  - `TASK-37`: Done

## Remaining Tasks

- execution system follow-ups:
  - `TASK-10` run structure
  - `TASK-11` branch workflow
  - `TASK-12` sandbox execution
  - `TASK-13` backlog updates

## Known Issues / Limitations

- Root sync currently writes a run-summary line under `## Run Sync`; it does not yet mutate milestone checkboxes directly.
- Idea refinement workflow (`TASK-8`) is still not implemented; ideas are currently basic records with title/description/status.

## Next Recommended Step

Implement execution-system follow-ups (`TASK-10` to `TASK-13`) to make run lifecycle operational beyond initialization (branch/sandbox/backlog-update loop).

## Relevant Files To Read Next

- `app/server.js`
- `app/lib/ideas.js`
- `app/lib/runtime.js`
- `app/lib/runs.js`
- `app/lib/backlog.js`
- `app/lib/storage.js`
- `BACKLOG.md`
- `backlog/tasks/task-10 - run-structure.md`
- `backlog/tasks/task-11 - branch-workflow.md`
- `backlog/tasks/task-12 - sandbox-execution.md`
- `backlog/tasks/task-13 - backlog-updates.md`
