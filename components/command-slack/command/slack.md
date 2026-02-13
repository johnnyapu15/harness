---
description: Send a Slack notification via slack_notify tool
agent: build
subtask: true
---

Send a Slack message with text: "$ARGUMENTS".

Use the `slack_notify` tool.

- Prefer `SLACK_WEBHOOK_URL` from environment.
- If missing, ask the user to provide a webhook URL.
- Return the tool result.
