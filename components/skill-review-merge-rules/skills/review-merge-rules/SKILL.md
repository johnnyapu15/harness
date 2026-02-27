---
name: review-merge-rules
description: Merge rules and blocker definition for review coordination
---
## What I do
- Define how parallel review results are merged into a single verdict.

## Rules
- Any valid blocker -> fail
- No blockers -> pass
- Conflicting assessments -> mark "needs confirmation" in Non-blockers
- A blocker is valid only if it includes `Evidence`, `Impact`, and `Alternative`.
- If any of the three is missing, classify the item as "needs confirmation" in Non-blockers (not a blocker).
- In looped execution, this fail/pass is cycle-level. Final task fail/pass is decided by the loop owner after loop-state evaluation.

## Mode and cycle contract
- Require explicit `mode` (`code` or `design`) and `cycle` (`d*`, `i*`, `f*`) in review requests.
- Preferred mapping: `d*` -> `design`, `i*` -> `code`, `f*` -> `code` (except design-only tasks).

## Blocker definition
- Correctness regression
- Data loss
- Security issue
- Crash
- Failing required test
- Acceptance criteria mapping gap (tag `[AC-GAP]`)
- Unnecessary artifact with maintenance cost (tag `[UNNECESSARY]`)
- Over-engineering without clear necessity (tag `[OVER-ENGINEERING]`)

## Non-blocker simplification tag
- Use `[SIMPLIFY]` in Non-blockers for remove/simplify candidates that do not block acceptance criteria.

## Input completeness gate
- If Task Brief is missing, return fail with missing inputs listed.
- If mode or cycle is missing, return fail with missing inputs listed.
- For review-only tasks, require review context (diff/commit) instead of Completion.
- For change tasks, require both Task Brief and Completion.
- If cycle context is provided, prioritize whether previous blockers are resolved and separate unresolved blockers from newly found blockers.
