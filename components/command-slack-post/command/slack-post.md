---
description: Post a Slack message via bot token or incoming webhook
agent: build
subtask: true
---

Post a Slack message using `slack-post.py`.

Inputs
- $ARGUMENTS supports flags:
  - --text "..." (message text)
  - --text-file <path> (read message from file)
  - --channel-id <C012ABCDEF>
  - --channel-name <name> (e.g., llm-notification)
  - --thread-ts <timestamp> (post as thread reply)
  - --webhook <url> (override webhook)
  - --list-channels (print public channel list JSON)

Environment
- SLACK_BOT_TOKEN for bot-based posting and channel listing
- SLACK_WEBHOOK_URL for incoming webhook posting

If neither SLACK_BOT_TOKEN nor SLACK_WEBHOOK_URL is set, ask the user to provide one.

Then run:

```bash
python3 "$HOME/.config/opencode/slack-post.py" $ARGUMENTS
```

Return a concise summary and include the command output in a fenced `json` block.
