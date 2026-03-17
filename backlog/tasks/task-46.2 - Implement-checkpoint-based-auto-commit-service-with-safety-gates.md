---
id: TASK-46.2
title: Implement checkpoint-based auto-commit service with safety gates
status: To Do
assignee: []
created_date: '2026-03-17 16:50'
labels: []
dependencies:
  - TASK-46
documentation:
  - SYSTEM.md
  - app/lib/runs.js
  - app/lib/ideas.js
parent_task_id: TASK-46
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce commit orchestration that creates commits only on meaningful checkpoints, batches low-value writes, and supports approval/safety controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Checkpoint triggers and debounce window are configurable
- [ ] #2 No commit is created for autosave-only markdown keystrokes
- [ ] #3 Commit includes structured metadata footer for run/project/idea context
- [ ] #4 Service can be disabled per environment
<!-- AC:END -->
