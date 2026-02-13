---
name: handoff-format
description: Standard handoff formats for Task Brief, Checkpoint, Completion, and Verdicts
---
## What I do
- Provide the fixed handoff formats used between agents.

## Persistence
- Persist every handoff artifact with `save-handoff`; do not change any handoff format fields.
- `save-handoff` stores files under `~/logs/opencode-harness/handoffs/<session-id>/`.
- File naming by `handoffType`:
  - `task-brief`: `<slug>.md`
  - `checkpoint`: `<slug>-checkpoint-<n>.md` (auto increment)
  - `completion`: `<slug>-completion.md`
  - `review-verdict`: `<slug>-review.md`
  - `test-verdict`: `<slug>-test.md`
- For looped workflows, include loop-cycle in `slug` to keep per-cycle artifacts separate (for example, `<task>-d0`, `<task>-i1`, `<task>-f2`).
- If a cycle slug is provided by the caller, use it. Otherwise use the Task Brief stem.

## Formats

Task Brief
- Task Type: change | review | design
- Goal
- Scope
- Out of Scope
- Context (files/areas)
- Constraints
- Proposed Design (required for design type; recommended for large changes)
- Acceptance Criteria
- Risks/Assumptions
- Review Context (diff/commit), if review-only
- Required Tests
- Dependencies (if any)

Checkpoint
- Status: in_progress | blocked
- Progress (what changed)
- Decisions (why)
- Blockers / Questions (if any)
- Next

Completion
- Summary
- Files Touched
- Tests Run (results)
- Behavior Changes
- Risks/Tradeoffs
- Follow-ups

Review Verdict
- Verdict: pass | fail
- Blockers
- Non-blockers
- Tags (quality/security/perf/etc)

Test Verdict
- Verdict: pass | fail | partial
- Evidence (commands/results)
- Failures (if any)
- Env/Scope

## When to use me
Use these formats for every handoff. Do not add prose outside the format.
