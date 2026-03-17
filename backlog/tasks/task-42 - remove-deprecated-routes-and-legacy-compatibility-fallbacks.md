---
id: TASK-42
title: remove deprecated routes and legacy compatibility fallbacks
status: Done
assignee: []
created_date: '2026-03-17 14:25'
updated_date: '2026-03-17 14:31'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove old workflow paths and compatibility fallbacks that are no longer part of the intended idea -> project -> run flow.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed `POST /api/ideas/:ideaId/execute` route and deprecated home page listing. Removed run metadata legacy backlog fallback paths and enforced project-derived idea linkage on run open/start.
<!-- SECTION:NOTES:END -->
