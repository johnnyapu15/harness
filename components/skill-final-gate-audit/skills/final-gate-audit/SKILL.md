---
name: final-gate-audit
description: Final-gate artifact audit for AC mapping, necessity, and over-engineering checks.
---

## What I do
- Define a consistent artifact-quality audit for final review cycles.
- Catch context drift and unnecessary output before final pass/fail.

## When to use me
- Use for every final gate cycle (`f*`).
- Optional for ad-hoc output-quality checks outside final gate.

## Required inputs
- `mode` (`code` or `design`)
- `cycle` (`f0`, `f1`, `f2`, ...)
- Task Brief path
- Completion path (or review context for review-only tasks)

## Audit checks
- Scope fidelity: changes outside Task Brief scope.
- AC linkage: changes with no acceptance-criteria mapping.
- Necessity: unnecessary files, settings, abstractions, or dependencies.
- Simplicity: remove/simplify opportunities that still satisfy acceptance criteria.
- Evidence integrity: each finding should reference concrete evidence (file/diff/test context).

## Tag policy
- Blockers: `[AC-GAP]`, `[UNNECESSARY]`, `[OVER-ENGINEERING]`.
- Non-blockers: `[SIMPLIFY]`.

## Output expectations
- Keep verdict cycle-level (not final task-level).
- Separate unresolved prior blockers from newly found blockers.
- Keep findings actionable and concise.
