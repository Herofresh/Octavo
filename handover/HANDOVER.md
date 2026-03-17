# Octavo Base Handover

## Scope

Canonical base handover for the current project implementation.

For now, this is the single handover file to continue work across contexts.

## Current Implementation Snapshot

- Backlog model: root `BACKLOG.md` + per-project backlog under `workspace/projects/<projectId>/backlog/`
- Idea model: planning folders under `workspace/ideas/<ideaId>/` with `idea.md` + append-only `conversation.ndjson`
- Project model: spawned from approved ideas and linked back to source idea
- Run model: execution loops inside projects; no run-local backlog initialization
- Versioning policy: canonical Git + filesystem history with checkpoint-based auto-commit strategy (no per-keystroke commits)
- Knowledge sync policy: external tools (e.g., Obsidian/file services) are optional read-only mirrors
- Runtime currently includes:
  - idea APIs (create/list/read, document update, conversation append, structured refinement, runtime migration, kickoff generation, per-idea LLM chat)
  - split UI routes:
    - `/`: backlog overview home page
    - `/ideas`: idea list + detailed idea workspace (chat, `idea.md`, conversation log, create + immediate kickoff)
    - `/projects`: project list/detail page with run detail/status view, rerun model selection, and rollback-branch preparation
  - static UI asset serving from `app/lib/ui/` (`common.css`, `common.js`, `home.*`, `ideas.*`, `projects.*`)
  - agent preset APIs (`/api/agents`) backed by `workspace/agents/`
  - project APIs (create-from-idea, list/read, start run loop)
  - runtime provider abstraction (`mock`, `openai`, `gemini`) with key-based availability checks
  - execution harness profile metadata on projects/runs (defaults to `pi`, per-run override supported)
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
- `WORKSPACE_VERSIONING.md`: split-boundary, checkpoint commit, and mirror policy contract
- `app/server.js`: active API surface and route behavior
- `app/lib/runtime.js`: model provider registry and completion adapters (`mock`, `openai`, `gemini`)
- `app/lib/agents.js`: agent preset discovery from `workspace/agents/*.md`
- `app/lib/ideas.js`: idea persistence, structured refinement, runtime profile migration, model kickoff flow, and per-idea chat
- `app/lib/projects.js`: project creation from ideas and project workspace contract
- `app/lib/runs.js`: run lifecycle, sandbox execution, backlog updates, root sync
- `app/lib/backlog.js`: backlog.md integration and task-edit commands
- `app/lib/storage.js`: workspace folder contracts and path safety
- `app/lib/ui/home.html` + `app/lib/ui/home.js`: backlog-focused home screen
- `app/lib/ui/ideas.html` + `app/lib/ui/ideas.js`: ideas workspace (list/chat/details/log/create)
- `app/lib/ui/projects.html` + `app/lib/ui/projects.js`: projects/runs workspace (details, reruns, rollback controls)
- `app/lib/ui/common.css` + `app/lib/ui/common.js`: shared UI theme and browser helpers
- `backlog/tasks/task-46 - Define-and-document-workspace-versioning-policy-checkpoint-commits-optional-KB-mirror.md`: parent policy task
- `backlog/tasks/task-46.1 - Split-runtime-services-separate-agent-orchestration-from-workspace-backlog-domain.md`: split refactor task
- `backlog/tasks/task-46.2 - Implement-checkpoint-based-auto-commit-service-with-safety-gates.md`: auto-commit orchestrator task
- `backlog/tasks/task-46.3 - Add-read-only-knowledge-base-mirror-adapter-Obsidian-file-sync.md`: optional mirror adapter task
- `workspace/agents/*.md`: agent preset files (agency-agents-inspired starters)

## Current Plan — Next Steps

1. Completed on 2026-03-17: split UI into folder-based pages (`/`, `/ideas`, `/projects`) with brighter neon styling, immediate kickoff-on-create, and per-idea LLM chat.
2. Completed on 2026-03-17: drafted workspace versioning policy in `WORKSPACE_VERSIONING.md` and created execution ticket tree (`TASK-46`, `TASK-46.1`, `TASK-46.2`, `TASK-46.3`).
3. Implement `TASK-46.1`: split code boundaries between runtime/orchestration and workspace/backlog domains.
4. Implement `TASK-46.2`: add checkpoint-based auto-commit orchestration with environment safety gates.
5. Implement `TASK-46.3`: add optional read-only mirror export adapter for external knowledge tools.
6. Align base backlog model with process states:
   - A ticket represents an idea and can move through all process statuses.
   - During executing stage, the agent may create child tickets linked to a root idea ticket.
   - Agent may create additional milestones per idea.
   - Child tasks/tickets should be assignable to those idea-specific milestones.
7. Implement integrations milestone incrementally:
   - scheduler definition workflow under `workspace/scheduler/`
   - GitHub and Telegram adapters behind explicit approval gates
8. Improve root sync from run summaries to milestone checkbox mutation in root `BACKLOG.md`.

## User Requested Direction — Status

- Implemented:
  - split home/ideas/projects UI pages under `app/lib/ui/`
  - home screen backlog overview
  - ideas workspace with list, per-idea LLM chat, detailed `idea.md`, conversation log, create + immediate kickoff
  - projects screen with project details, run details/statuses, rerun runtime/model selection, and rollback-branch preparation
  - brighter neon visual style
- Remaining:
  - base backlog process-state model where idea tickets can spawn child tickets/milestones during execution

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
