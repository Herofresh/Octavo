# Architecture — Octavo

## Overview

Octavo is a file-first, single-user agent system with a control plane and an execution runtime.

It is designed to be lightweight, inspectable, and extensible.

## Core Principle

Backlog.md is the live execution contract.

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

- ideas
- runs
- agents
- memory
- backlog
- logs

### Integration Layer

- GitHub
- Telegram
- model providers
- optional pi.dev adapter

## Runtime Design

A runtime interface abstracts model execution.

pi.dev may be used internally but must remain replaceable.

## Storage Strategy

- markdown + JSON
- file-based
- no required database

## Workspace Structure

/workspace
/ideas
/agents
/projects
/runs
/scheduler

## Execution Flow

1. refine idea
2. approve execution
3. create branch
4. execute in sandbox
5. update Backlog.md
6. produce summary
7. open PR

## Scheduler

- runs daily
- creates proposals only
- never executes automatically

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
