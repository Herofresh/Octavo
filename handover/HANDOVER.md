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
  - idea APIs (create/list/read, document update, conversation append, structured refinement, runtime migration, kickoff generation)
  - ideas UI route (`/ideas`) for list/detail browsing, markdown document editing, runtime/profile selection, kickoff generation, and conversation timeline append
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
- `app/server.js`: active API surface and route behavior
- `app/lib/runtime.js`: model provider registry and completion adapters (`mock`, `openai`, `gemini`)
- `app/lib/agents.js`: agent preset discovery from `workspace/agents/*.md`
- `app/lib/ideas.js`: idea persistence, structured refinement, runtime profile migration, and model kickoff flow
- `app/lib/ideas-ui.js`: ideas browse/edit UI with runtime/agent controls and kickoff workflow
- `app/lib/projects.js`: project creation from ideas and project workspace contract
- `app/lib/runs.js`: run lifecycle, sandbox execution, backlog updates, root sync
- `app/lib/backlog.js`: backlog.md integration and task-edit commands
- `app/lib/storage.js`: workspace folder contracts and path safety
- `workspace/agents/*.md`: agent preset files (agency-agents-inspired starters)

## Current Plan — Next Steps

1. Rebuild the UI from scratch (do not incrementally patch current `/ideas` view):
   - Tab 1: backlog overview.
   - Tab 2: ideas list.
   - Selecting an idea opens a detailed idea workspace:
     - LLM chat about the selected idea.
     - detailed markdown (`idea.md`) view.
     - detailed conversation timeline view.
   - In ideas overview, allow creating a new idea with:
     - required title,
     - optional summary,
     - immediate kickoff call to LLM to initialize `idea.md` + first conversation context.
   - Visual direction: brighter neon look and feel.
2. Align base backlog model with process states:
   - A ticket represents an idea and can move through all process statuses.
   - During executing stage, the agent may create child tickets linked to a root idea ticket.
   - Agent may create additional milestones per idea.
   - Child tasks/tickets should be assignable to those idea-specific milestones.
3. Implement integrations milestone incrementally:
   - scheduler definition workflow under `workspace/scheduler/`
   - GitHub and Telegram adapters behind explicit approval gates
4. Improve root sync from run summaries to milestone checkbox mutation in root `BACKLOG.md`.

## User Requested Direction (Captured, Not Implemented Yet)

- Rebuild UI from scratch with tabbed structure (backlog overview + ideas list).
- Enable per-idea LLM chat in detailed view.
- Show `idea.md` and conversation timeline in more detailed format.
- New idea creation should immediately call LLM kickoff from title (+ optional summary) to initialize planning artifacts.
- Base backlog should reflect process-state workflow where idea tickets can spawn child tickets/milestones during execution.
- UI style should be brighter with neon colors.

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
