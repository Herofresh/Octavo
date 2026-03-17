# Workspace Versioning Policy

## Purpose

Define how Octavo separates code boundaries and records filesystem-backed planning/execution state changes safely.

## Boundary Split

Two domains must stay separable:

- Agent/runtime orchestration domain:
  - model provider adapters
  - execution orchestration
  - chat/refinement control logic
- Workspace/backlog domain:
  - file storage contracts (`idea.md`, `conversation.ndjson`, run metadata)
  - backlog project/task mutation
  - project/run workspace state

Rules:

- Runtime/orchestration modules can call workspace services through explicit interfaces.
- Workspace services must not depend on runtime provider internals.
- Cross-domain calls should be centralized in route/service orchestration layers.

## Canonical Source of Truth

- Canonical state is local repo filesystem + Git history.
- Markdown/NDJSON/JSON files are the primary persisted artifacts.
- Rollback and audit rely on Git commits, not external sync tools.

## Auto-Commit Policy

Auto-commit is checkpoint-based, not keystroke-based.

Commit checkpoints:

1. New idea created (folder + initial `idea.md`).
2. Kickoff generation completed.
3. Idea chat roundtrip completed (user + assistant persisted).
4. Backlog status transition (`To Do` -> `In Progress` -> `Done`).
5. Project spawned from idea.
6. Run lifecycle transition (created, started, completed, blocked, failed).
7. Root-sync milestone/task mutation completed.

Non-checkpoints (must not auto-commit):

1. Every textarea/autosave keystroke.
2. Partial multi-file writes before transaction completion.
3. UI-only state changes without persisted file changes.

Safety controls:

- Debounce/batch low-value bursts into one checkpoint commit.
- Skip commit when no effective file diff exists.
- Expose env toggle to disable auto-commit in local/dev environments.
- Use branch-scoped commits; never force-write to protected branches.

## Commit Message Schema

Use machine-parseable, stable metadata.

Subject pattern:

`octavo(checkpoint): <event> <entity>`

Required trailers:

- `Octavo-Checkpoint: <checkpoint_key>`
- `Octavo-Entity-Type: idea|project|run|backlog|sync`
- `Octavo-Entity-Id: <id>`
- `Octavo-Run-Id: <runId-or-n/a>`
- `Octavo-Source: auto|manual`

Optional trailers:

- `Octavo-Model: <provider/model>`
- `Octavo-Parent-Task: <task-id>`

## Knowledge Base Sync Policy

External tools (Obsidian/file services) are mirrors, not canonical stores.

- Phase 1: read-only mirror export from repo -> mirror target.
- One-way sync only; mirror must never overwrite canonical repo files.
- Mirror jobs must report last successful export timestamp and failures.
- Conflicts are resolved by editing canonical repo files, then re-exporting.

## Rollout Plan (Backlog)

- `TASK-46`: define policy and doc updates.
- `TASK-46.1`: codebase split between orchestration and workspace domains.
- `TASK-46.2`: checkpoint auto-commit orchestrator with safety gates.
- `TASK-46.3`: read-only mirror adapter for Obsidian/file-sync targets.
