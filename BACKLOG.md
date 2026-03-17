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
- dual backlog model: root milestones + per-run backlog projects

## Milestones

### Foundation

- [x] finalize file structure
- [x] create repo skeleton
- [ ] define runtime interface
- [x] define workspace structure

### Idea System

- [ ] idea storage format
- [ ] refinement flow
- [ ] UI for ideas

### Execution System

- [ ] run structure
- [ ] branch workflow
- [ ] sandbox execution
- [ ] backlog updates

### Integrations

- [ ] GitHub
- [ ] Telegram
- [ ] model providers
- [ ] scheduler

## In Progress

- [x] defining core system files
- [x] implementing foundation scaffold (server + storage + backlog adapter)
- [ ] defining runtime interface

## Next

- [x] scaffold repository
- [x] implement basic server
- [x] implement file storage helpers
- [x] implement backlog parsing
- [ ] implement idea flow
- [ ] define runtime interface
- [ ] implement per-run backlog.md initialization on execution start
- [ ] link each execution run backlog to a root milestone/task
- [ ] implement status sync from run backlog to root Backlog.md

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
- [x] documented dual backlog policy (root + run)

## Notes

This file must be updated during execution.
It reflects real progress.
It is the primary contract between user and system.
