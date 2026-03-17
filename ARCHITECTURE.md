# Architecture — Octavo

## Overview

Octavo is a file-first, single-user agent system with a control plane and an execution runtime.

It is designed to be lightweight, inspectable, and extensible.

## Core Principle

Backlog uses a root + project model:
- root Backlog.md for portfolio milestones
- per-project backlog.md projects for execution contracts

## Components

### Control Plane

- web UI
- chat interface
- idea archive
- approvals
- backlog visualization
- Telegram bridge

### Agent Runtime

- loads context (idea, agent, backlog)
- decides actions
- calls skills
- updates state

### Execution Sandbox

- isolated workspace
- git operations
- file editing
- command execution
- test runs

### File Store

- ideas (markdown + raw conversation logs)
- projects
- runs (execution loops)
- handover
- agents
- skills
- memory
- backlog
- logs
- scheduler definitions

### Backlog Topology

- root: `/BACKLOG.md` (global roadmap + milestone tracking)
- project: `/workspace/projects/<project-id>/backlog/` (task execution contract)
- run metadata links each run to one project backlog

### Idea / Project / Run Model

- idea: planning artifact in `/workspace/ideas/<idea-id>/` with `idea.md` + `conversation.ndjson`
- project: execution container that references a source idea and owns one backlog project
- run: one project execution loop that can cover one or more backlog tasks

### Handover Model (Current Phase)

- single canonical base handover: `/handover/HANDOVER.md`
- future phase may extend to per-agent/per-context handovers

### Integration Layer

- GitHub
- Telegram
- model providers
- optional pi.dev adapter

## Runtime Design

A runtime interface abstracts model execution.

pi.dev may be used internally but must remain replaceable.

## Storage Strategy

- markdown + NDJSON for idea planning/history
- JSON for runtime metadata where needed
- file-based
- no required database

## Workspace Structure

/workspace
/ideas
/agents
/skills
/projects
/runs
/scheduler

## Execution Flow

1. refine idea
2. update idea markdown + append raw conversation
3. approve project spawn from idea
4. create/open project backlog
5. create run loop for selected tasks
6. execute in sandbox
7. update project backlog continuously
8. sync milestone state to root Backlog.md
9. produce summary
10. open PR

## Scheduler

- runs daily
- creates proposals only
- never executes automatically
- job definitions are stored as files under `/workspace/scheduler/`

## GitHub

- repo creation
- branch creation
- commits
- PRs

## Telegram

- idea input
- status checks
- approvals

## UI

- lightweight
- real-time backlog view
- neon / futuristic style

## Memory

- file-based
- scoped (global / agent / project)
- simple in V1

## PageIndex

Optional future adapter for document retrieval.

Not required in V1.

## Deployment

- single server (Hetzner)
- minimal services
- Docker for execution if needed

## Safety

- approval required
- branch-only changes
- isolated execution
- explicit logs

## Extensibility

- multiple spells (agents)
- pluggable runtimes
- pluggable memory systems
- additional integrations
