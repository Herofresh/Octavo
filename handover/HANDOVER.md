# Octavo Base Handover

## Scope

Canonical base handover for the current project implementation.

For now, this is the single handover file to continue work across contexts.

## Current Implementation Snapshot

- Backlog model: root `BACKLOG.md` + per-project backlog under `workspace/projects/<projectId>/backlog/`
- Idea model contract (documented): each idea should be a folder with:
  - `idea.md`
  - `conversation.ndjson` (append-only raw turns)
- Project model contract (documented): projects are spawned from approved ideas and must reference source idea
- Run model contract (documented): runs are execution loops inside a project; one run may cover one or more tasks
- Runtime currently includes:
  - idea APIs (create/list/read, document update, conversation append)
  - project APIs (create-from-idea, list/read, start run loop)
  - runtime provider abstraction (`mock` provider)
  - run workspace, branch/worktree, sandbox command execution, root-sync APIs
  - direct idea->execute endpoint is deprecated (returns conflict guidance)
- Workspace contract includes:
  - `workspace/agents/` for archetype personalities/constraints
  - `workspace/skills/` for skill definitions
  - `workspace/scheduler/` for schedule definition files

## Process Rules In Effect

- Set task status to `In Progress` before starting work.
- Move task status to `Done` when complete.
- If blocked by sandbox/permissions, request escalation.
- After approved changes and before starting a new task, clean prior smoke/test artifacts.

## Notes For Next Work

- Add migration helper for any legacy JSON ideas/runs if needed in future imports.
- Optionally remove deprecated `/api/ideas/:ideaId/execute` route after client migration.
- Keep this file updated as the single base handover until multi-agent handover mode is introduced.
