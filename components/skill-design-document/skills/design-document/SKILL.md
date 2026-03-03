---
name: design-document
description: Standard format for design documents produced by the Architect agent
---
## What I do
- Provide the fixed Design Document format used by the Architect agent.
- Ensure design artifacts are structured consistently for downstream consumption by Orchestrator, Implementor, and Designer.

## Persistence
- Persist every design document with `save-handoff`.
- `save-handoff` stores files under `~/logs/opencode-harness/handoffs/<session-id>/`.
- File naming by `handoffType`:
  - `design-doc`: `<slug>-design.md`
- Use kebab-case slug derived from the design title.

## Format

Design Document
- Title: concise name for the design
- Status: draft | review | approved
- Author: architect
- Date: YYYY-MM-DD

### 1. Problem Statement
- What problem is being solved and why it matters.
- Who is affected (users, systems, downstream services).
- Current behavior vs desired behavior.

### 2. Requirements
- Functional Requirements (numbered, testable)
  - FR-1: ...
  - FR-2: ...
- Non-Functional Requirements (numbered)
  - NFR-1: ...
- Constraints
  - Hard constraints (must not violate)
  - Soft constraints (prefer but negotiable)
- Assumptions (explicitly stated, each with rationale)

### 3. Design Context
- Affected Files/Modules (list with brief description of role)
- Existing Patterns (conventions found in codebase)
- Integration Points (where new code touches existing code)
- External Dependencies (libraries, APIs, services)

### 4. Proposed Design
- Overview (1-3 sentence summary of the approach)
- Architecture Diagram (ASCII or description if applicable)
- Component Breakdown
  - Component A: responsibility, inputs, outputs
  - Component B: ...
- Data Flow (step-by-step sequence)
- API Changes (if any: endpoint, method, request/response schema)
- Data Model Changes (if any: table/field additions, migrations)
- Configuration Changes (if any)

### 5. Alternatives Considered
- Alternative A: description, pros, cons, reason rejected
- Alternative B: description, pros, cons, reason rejected
(Minimum 1 alternative. If the chosen design is the only viable option, explain why.)

### 6. Impact Analysis
- Files to Create (list with purpose)
- Files to Modify (list with summary of changes)
- Files to Delete (if any)
- Breaking Changes (if any, with migration path)
- Behavioral Changes (user-visible differences)

### 7. Implementation Plan
- Phases (ordered steps for implementation)
  - Phase 1: description, files, acceptance criteria
  - Phase 2: ...
- Suggested Agent Routing
  - Designer tasks (UX/UI)
  - Implementor tasks (backend/logic)
  - Mixed tasks (with file ownership split)
- Dependencies between phases

### 8. Testing Strategy
- Unit Tests (what to cover)
- Integration Tests (what to cover)
- Manual Verification Steps (if applicable)
- Edge Cases to Test

### 9. Risks and Mitigations
- Risk 1: description, likelihood, impact, mitigation
- Risk 2: ...

### 10. Open Questions
- (Questions that remain unresolved, with suggested default if applicable)

## Section requirements
- Sections 1-4 and 6-7 are always required.
- Section 5 is required (minimum 1 alternative).
- Sections 8-10 may be omitted only for trivial designs (< 3 files affected). State reason if omitting.
- For small designs (single component, < 5 files), sections may be brief but not skipped.

## When to use me
Use this format for every design document produced by the Architect. Do not add prose outside the format once the document is finalized.
