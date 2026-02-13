---
description: Run review coordinator
agent: orchestrator
---
Run Review Coordinator for the current task.
Ensure Task Brief and review context (Completion or diff/commit) are present.
Always include explicit review mode (`code` or `design`) and cycle (`d*`, `i*`, `f*`).
For final gate cycles (`f*`), default to `mode: code` unless the task is design-only.
For final gate cycles (`f*`), require Review Coordinator to load skill `final-gate-audit`.
Include cycle slug for persisted verdict artifacts.
Return Review Verdict only.
