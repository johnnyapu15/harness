---
description: Post a Slack message (bot token preferred, webhook fallback)
agent: build
subtask: true
---

Post a Slack message using `slack-post.py`.

Inputs
- `$ARGUMENTS` supports flags:
  - `--text "..."` (message text)
  - `--text-file <path>` (read text from file)
  - `--channel-id <C012ABCDEF>`
  - `--channel-name <name>` (e.g., `llm-notification`)
  - `--thread-ts <timestamp>` (thread reply)
  - `--list-channels` (print public channel list JSON)
  - `--kind <info|permission|milestone|error|final>`
  - `--title "..."`
  - `--summary "..."`
  - `--status <info|success|warning|error>`
  - `--fact key=value` (repeatable)
  - `--details "..."`
  - `--session-id <session-id>`
  - `--blocks-json '[...]'` or `--blocks-file <path>`
  - `--webhook <url>` (explicit webhook override)

Environment
- `SLACK_BOT_TOKEN` for bot-based posting and channel listing
- `SLACK_CHANNEL_ID` (or `SLACK_CHANNEL`) as default destination for bot posting
- `SLACK_WEBHOOK_URL` for incoming webhook fallback posting

Behavior
- Bot token is preferred when available.
- If bot token is missing, falls back to webhook.
- If custom blocks are used, include fallback text (`--text` or `--summary`).

Then run:

```bash
python3 "$HOME/.config/opencode/slack-post.py" $ARGUMENTS
```

Return a concise summary and include command output in a fenced `json` block.
