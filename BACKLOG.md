# Backlog — Octavo

## Current Phase

Foundation

## Goals

- finalize architecture
- define system rules
- prepare implementation

## Decisions

- file-first storage
- markdown as source of truth
- no database in V1
- Node.js runtime
- approval-based execution
- pi.dev as optional adapter
- Backlog.md as execution contract
- backlog.md library as backlog engine
- backlog model: root milestones + per-project backlog projects
- idea model: `workspace/ideas/<ideaId>/idea.md` + `conversation.ndjson`
- runs are project execution loops, not idea artifacts
- workspace contract includes agents, skills, and scheduler definition folders
- handover contract (current phase): single canonical file at `handover/HANDOVER.md`
- handover content contract: must include `Context File Index` + `Current Plan — Next Steps`
- target split: agent/runtime orchestration code separated from workspace/backlog file-domain services
- versioning policy: Git commit history is canonical; auto-commit only on meaningful checkpoints
- external knowledge tools (e.g., Obsidian) are read-only mirrors, not canonical writers

## Milestones

### Foundation

- [x] finalize file structure
- [x] create repo skeleton
- [x] define runtime interface
- [x] define workspace structure

### Idea System

- [x] idea storage format
- [x] refinement flow
- [x] UI for ideas

### Execution System

- [x] run structure
- [x] branch workflow
- [x] sandbox execution
- [x] backlog updates

### Integrations

- [ ] GitHub
- [ ] Telegram
- [x] model providers
- [ ] scheduler

## In Progress

- [x] defining core system files
- [x] implementing foundation scaffold (server + storage + backlog adapter)
- [x] defining runtime interface

## Next

- [x] scaffold repository
- [x] implement basic server
- [x] implement file storage helpers
- [x] implement backlog parsing
- [x] implement idea flow
- [x] define runtime interface
- [x] implement project backlog initialization on execution approval/start
- [x] link each execution run to a project backlog + root milestone/task
- [x] implement status sync from project backlog to root Backlog.md
- [ ] TASK-46.1 split orchestration domain from workspace/backlog domain services
- [ ] TASK-46.2 implement checkpoint-based auto-commit orchestration with safety gates
- [ ] TASK-46.3 add read-only knowledge-base mirror export flow

## Blocked

- none

## Risks

- overengineering early
- runtime coupling to pi.dev
- UI scope creep

## Done

- [x] product definition
- [x] architecture direction
- [x] file structure design
- [x] naming (Octavo)
- [x] foundation scaffold (app + workspace skeleton)
- [x] minimal Node.js server with health and backlog endpoints
- [x] file storage helpers for markdown and JSON
- [x] backlog.md integration (init + task migration + API adapter)
- [x] documented backlog policy (root + project)
- [x] switched to project-level backlog topology for execution
- [x] documented idea/project/run model and workspace folder contracts
- [x] standardized base handover file in `/handover/HANDOVER.md`
- [x] implemented idea-folder planning flow and project-run execution APIs
- [x] removed deprecated routes and legacy compatibility fallbacks
- [x] enforced handover content contract (context index + next-step plan)
- [x] implemented structured idea refinement flow API and markdown section updates
- [x] implemented ideas UI for browse/edit flows and conversation timeline
- [x] implemented OpenAI/Gemini provider integration, idea kickoff generation, and runtime profile migration

## Notes

This file must be updated during execution.
It reflects real progress.
It is the primary contract between user and system.
After approved changes and before starting a new task, clean prior smoke/test artifacts.

## Run Sync

- run: 2026-03-17-2026-03-17-project-backlog-api-smoke-2 | project: 2026-03-17-project-backlog-api-smoke-2 | idea: 2026-03-17-project-backlog-api-smoke-2 | root task: n/a | milestone: n/a | status: empty | progress: 0/0 (0%) | updated: 2026-03-17T12:36:01.932Z
