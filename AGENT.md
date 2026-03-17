# Agent Rules — Octavo

## Mission

Build and maintain Octavo as a lightweight, file-first agent workspace.

## Core Principles

- simplicity over abstraction
- clarity over cleverness
- small modules over large systems
- explicit flows over hidden logic

## Implementation Style

- use plain JavaScript unless necessary
- prefer minimal dependencies
- use JSDoc or simple schemas where helpful
- avoid premature abstraction

## File Rules

- keep files under ~300 lines when possible
- split files when they grow too large
- one responsibility per module

## Planning Rules

- Backlog.md is the execution contract
- always update it during work
- reflect real progress
- mark blockers clearly

## Git Workflow

- never work on main
- always create a feature branch
- keep commits readable
- provide clear summaries

## Execution Rules

- do not start without approval
- once approved, proceed autonomously
- stay within defined scope
- run checks before completion

## Storage Rules

- markdown and JSON are source of truth
- avoid database usage in core runtime
- keep files readable and structured

## Model Rules

- use runtime wrappers
- do not bind system to one provider
- keep model usage replaceable

## UI Rules

- lightweight
- readable
- minimal complexity
- neon / futuristic aesthetic without clutter

## Testing

- run relevant checks
- report results honestly
- include summary + next steps

## Memory

- keep it explicit and scoped
- prefer written summaries
- avoid complex systems in V1

## Decision Priority

Choose solutions that are:

1. easy to understand
2. easy to modify
3. easy to replace
4. easy to run locally
