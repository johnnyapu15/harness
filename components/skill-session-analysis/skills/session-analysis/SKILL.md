---
name: session-analysis
description: Analyze OpenCode sessions for user interventions, timeline, and durations
---
## What I do
- Analyze one OpenCode session from local storage data.
- Summarize session window, ordered user inputs, intervention levels, per-message intervals, and total span.

## Data source
- Use OpenCode storage only:
  - `~/.local/share/opencode/storage/session`
  - `~/.local/share/opencode/storage/message`
  - `~/.local/share/opencode/storage/part`
- Do not depend on server runtime logs.

## Workflow
- Resolve target session:
  - `--session-id <id>` uses the exact session.
  - Without `--session-id`, auto-pick the latest session for `--project-dir` (default: current working directory).
- Load message metadata from `storage/message/<session-id>`.
- Load text parts from `storage/part/<message-id>`.
- Classify user messages with deterministic high/medium/low heuristics.
- Print a readable report, or JSON with `--json`.

## Heuristic note
- Intervention level classification is approximate.
- Rules are deterministic and based on message structure/length/keywords.

## Commands
- Help:
  - `python3 ~/.config/opencode/skills/session-analysis/scripts/analyze_session.py --help`
- Analyze a specific session:
  - `python3 ~/.config/opencode/skills/session-analysis/scripts/analyze_session.py --session-id ses_123`
- Analyze latest session for a project and output JSON:
  - `python3 ~/.config/opencode/skills/session-analysis/scripts/analyze_session.py --project-dir /path/to/project --json`
