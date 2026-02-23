# Changelog

## 0.1.5 - 2026-02-17

- Added Orchestrator Slack anti-noise policy: milestone-based updates only (not every handoff).
- Added explicit Task Brief notification hint guidance: `slack: none | milestone | final-only`.
- Added soft cap guidance for Slack frequency and handoff coalescing rules.
- Updated General, Designer, and Implementor prompts to avoid direct Slack sending and report milestone flags back to Orchestrator.

## 0.1.4 - 2026-02-17

- Added `agent-designer` (Claude Opus 4.6) for UX/UI design and frontend UX/UI implementation workflows.
- Updated `agent-orchestrator` routing to dispatch `designer` vs `implementor` and added required scope-consult protocol for mixed or uncertain scope.
- Updated `agent-implementor` and `agent-general` boundaries to reroute UX/UI-heavy work to `designer`.
- Updated `tool-save-handoff` allowlist to permit `designer` handoff persistence.
- Registered and published `agent-designer` in registry metadata and mirrored artifacts.
