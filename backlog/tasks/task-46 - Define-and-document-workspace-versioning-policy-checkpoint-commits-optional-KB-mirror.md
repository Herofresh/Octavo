---
id: TASK-46
title: >-
  Define and document workspace versioning policy (checkpoint commits + optional
  KB mirror)
status: Done
assignee: []
created_date: '2026-03-17 16:49'
updated_date: '2026-03-17 16:51'
labels: []
dependencies: []
documentation:
  - BACKLOG.md
  - ARCHITECTURE.md
  - SYSTEM.md
  - handover/HANDOVER.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Draft operating policy for separating agent runtime code from workspace/backlog file storage code, with Git as source of truth, checkpoint-based auto-commits, and read-only knowledge-base mirroring strategy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Policy states Git is canonical history and rollback mechanism
- [x] #2 Policy defines commit trigger checkpoints and explicit non-checkpoints
- [x] #3 Policy defines commit message metadata schema for machine parsing
- [x] #4 Policy defines mirror strategy (read-only first) and conflict stance
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Drafted WORKSPACE_VERSIONING.md with boundary split rules, checkpoint trigger policy, commit metadata schema, and read-only mirror strategy.

Updated BACKLOG.md decisions/next, ARCHITECTURE.md versioning strategy, SYSTEM.md planning constraints, and handover context/plan references to TASK-46.*.
<!-- SECTION:NOTES:END -->
