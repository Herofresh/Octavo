# Octavo Base Handover

## Scope

Canonical base handover for the current project implementation.

For now, this is the single handover file to continue work across contexts.

## Current Implementation Snapshot

- Backlog model: root `BACKLOG.md` + per-project backlog under `workspace/projects/<projectId>/backlog/`
- Idea model: planning folders under `workspace/ideas/<ideaId>/` with `idea.md` + append-only `conversation.ndjson`
- Project model: spawned from approved ideas and linked back to source idea
- Run model: execution loops inside projects; no run-local backlog initialization
- Runtime currently includes:
  - idea APIs (create/list/read, document update, conversation append)
  - project APIs (create-from-idea, list/read, start run loop)
  - runtime provider abstraction (`mock` provider)
  - run workspace, branch/worktree, sandbox command execution, root-sync APIs
- Workspace contract includes:
  - `workspace/agents/` for archetype personalities/constraints
  - `workspace/skills/` for skill definitions
  - `workspace/scheduler/` for schedule definition files

## Context File Index

- `BACKLOG.md`: portfolio milestones and current plan status
- `SYSTEM.md`: execution boundaries and required behavior
- `AGENT.md`: implementation and workflow rules for agent execution
- `ARCHITECTURE.md`: system topology and flow contracts
- `app/server.js`: active API surface and route behavior
- `app/lib/ideas.js`: idea planning persistence and conversation append flow
- `app/lib/projects.js`: project creation from ideas and project workspace contract
- `app/lib/runs.js`: run lifecycle, sandbox execution, backlog updates, root sync
- `app/lib/backlog.js`: backlog.md integration and task-edit commands
- `app/lib/storage.js`: workspace folder contracts and path safety

## Current Plan — Next Steps

1. Complete `TASK-8` (refinement flow) so idea planning updates are structured and repeatable.
2. Complete `TASK-9` (UI for ideas) for browse/edit flows on `idea.md` and conversation timeline.
3. Implement integrations milestone incrementally:
   - scheduler definition workflow under `workspace/scheduler/`
   - model provider expansion beyond mock runtime
   - GitHub and Telegram adapters behind explicit approval gates
4. Improve root sync from run summaries to milestone checkbox mutation in root `BACKLOG.md`.

## Process Rules In Effect

- Set task status to `In Progress` before starting work.
- Move task status to `Done` when complete.
- If blocked by sandbox/permissions, request escalation.
- After approved changes and before starting a new task, clean prior smoke/test artifacts.

## Handover Content Contract

Every update to this file must include:

- an updated `Context File Index` pointing to relevant source files
- an updated `Current Plan — Next Steps` section tied to active backlog milestones/tasks

## Notes For Next Work

- Keep this file updated as the single base handover until multi-agent handover mode is introduced.
