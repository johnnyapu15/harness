---
name: history-log
description: One-line session history logging format and rules
---
## What I do
- Provide the one-line session history template and logging rules.

## Tool
- Use `write-history-log` to persist the history line.
- `write-history-log` is orchestrator-only.
- Provide structured fields as tool args (date, project, task, files, additions, deletions, agents, tools, total, active, human, review, test, notes).
- `write-history-log` injects `session:<current-session-id>` automatically.

## Location
- `~/logs/opencode-harness/history/<session-id>.log`

## Directory rule
- `write-history-log` creates the history directory if it does not exist.

## Format
YYYY-MM-DD | project:<name> | session:<id> | task:<short> | files:<n> +/-<loc> | agents:<orchestrator=model,...> | tools:<read/edit/bash counts> | total:<m> active:<m> human:<m> | review:<pass/fail> test:<pass/fail> | notes:<n>

## Rules
- Use agent IDs in the agents field.
- Map each agent to its model with `agent=model` pairs.
- Log after final gate decision. For change tasks, after Completion + Verdicts. For review-only tasks, after Review Verdict.
- Write exactly one line per session file.
- One file per session; do not append to shared logs.
- Use absolute paths; do not use relative paths.
