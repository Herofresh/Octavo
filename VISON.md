# Octavo — Vision

## Purpose

Octavo is a personal, chat-first coding agent workspace that turns rough ideas into refined implementation plans and approved code changes.

It allows ideas to be captured quickly, refined conversationally, stored as structured artifacts, and executed safely within controlled git workflows.

## Core Concept

Octavo is a system that hosts “spells” — autonomous but controlled agents that live within the system and can act on tasks once invoked.

These spells:

- assist in refining ideas,
- prepare structured execution plans,
- and implement approved work within defined boundaries.

## Problem

Existing coding assistants are either:

- stateless and forgetful,
- overly complex and framework-heavy,
- too autonomous without control,
- or not customizable into specialized workflows.

Octavo solves this by combining:

- chat-based refinement,
- file-based persistence,
- approval-driven execution,
- and a lightweight, inspectable architecture.

## Core Product Promise

Octavo enables a single user to:

1. capture ideas quickly,
2. refine them into structured plans,
3. approve execution when ready,
4. execute safely in feature branches,
5. track progress live through Backlog.md,
6. review results before merging.

## Primary User

Octavo is built for a single user: André.

It is not a multi-user platform.

## V1 Scope

- web UI control plane
- Telegram integration
- one general-purpose coding spell
- file-based storage (markdown + JSON)
- Backlog.md as execution contract
- GitHub integration (repos, branches, PRs)
- execution in isolated workspaces
- model provider abstraction (OpenAI, Gemini, etc.)
- optional pi.dev runtime adapter
- daily scheduler for proposal generation only

## Key Principles

- file-first over database-first
- approval before execution
- autonomy within approved boundaries
- branch-only code changes
- markdown as operational truth
- simplicity over abstraction
- replaceable runtime components
- blueprint for future spells

## Agent Blueprint Goal

Octavo is designed as a blueprint system.

Future spells (agents) should be created by modifying:

- SYSTEM.md
- AGENT.md
- persona and configuration files

without requiring architectural changes.

## User Flows

### Idea Capture

User submits an idea via chat or Telegram.

### Refinement

The idea is refined conversationally into a structured concept.

### Approval

User selects execution target and approves the task.

### Execution

A spell executes within a sandbox, updating Backlog.md continuously.

### Review

User reviews:

- summary
- changes
- checks/tests
- pull request

### Scheduler

System generates daily suggestions (no automatic execution).

## Non-Goals (V1)

- multi-user collaboration
- autonomous deployment
- full personal assistant features
- heavy infrastructure or databases

## Future Direction

- specialized spells
- richer memory systems
- local model support
- broader workflows (planning, life, etc.)

## Success Criteria

- ideas can be refined clearly
- execution is safe and controlled
- Backlog.md reflects real progress
- outputs are review-ready
- system remains lightweight and extensible
