---
description: Send a structured Slack notification via slack_notify tool
agent: build
subtask: true
---

Send a Slack message from "$ARGUMENTS" using the `slack_notify` tool.

Rules
- Prefer bot token delivery with `SLACK_BOT_TOKEN` plus `SLACK_CHANNEL_ID` (or `SLACK_CHANNEL`).
- Fall back to `SLACK_WEBHOOK_URL` only when bot-token delivery is unavailable.
- Always provide fallback `message` text even when using `blocks`.
- Prefer structured fields for consistency:
  - `kind`: `permission | milestone | error | final | info`
  - `summary`: one-line summary
  - `title`, `status`, `facts`, `details` as needed
- Use `thread_ts` to keep follow-up updates in one thread.
- Use `channel` only for explicit override; otherwise use env defaults.

Template mapping
- approval needed -> `kind=permission`, `status=warning`
- progress checkpoint -> `kind=milestone`, `status=info`
- failure/exception -> `kind=error`, `status=error`
- completed/final gate -> `kind=final`, `status=success`

Return the tool result only.
