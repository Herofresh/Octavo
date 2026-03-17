---
id: TASK-46.1
title: >-
  Split runtime services: separate agent orchestration from workspace/backlog
  domain
status: To Do
assignee: []
created_date: '2026-03-17 16:50'
labels: []
dependencies:
  - TASK-46
documentation:
  - ARCHITECTURE.md
  - app/server.js
  - app/lib/runtime.js
  - app/lib/backlog.js
parent_task_id: TASK-46
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor codebase boundaries so agent orchestration/runtime adapters are isolated from filesystem-backed workspace/backlog services, with clear module ownership and contracts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Architecture doc defines package/module boundaries and allowed dependencies
- [ ] #2 No circular imports between agent orchestration and workspace/backlog domain
- [ ] #3 Existing APIs remain backward compatible or migration is documented
<!-- AC:END -->
