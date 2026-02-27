---
description: Verify Coolify applications and optionally redeploy
agent: build
subtask: true
---

Verify Coolify applications via the API. This command lists apps, checks recent deployments, optionally samples logs, and can trigger redeploys.

Inputs
- $ARGUMENTS supports flags:
  - --app <uuid or name> (repeatable)
  - --lines <n> (default 100, 0 to skip logs)
  - --take <n> (recent deployments, default 5)
  - --deploy (trigger redeploy)
  - --force (force rebuild, only with --deploy)
  - --wait (poll deployment status)
  - --timeout <sec> (default 600, only with --wait)
  - --interval <sec> (default 10, only with --wait)
  - --base <url> (override base url)

Environment
- COOLIFY_TOKEN is required (Bearer token)
- COOLIFY_BASE_URL optional (default: https://infra.curatesome.com/api/v1)

If COOLIFY_TOKEN is missing, ask the user to set it. Do not proceed without it.

Then, use the Bash tool to run:

```bash
python3 /home/ubuntu/.config/opencode/coolify-verify.py $ARGUMENTS
```

After running, return a concise summary and include the JSON in a fenced `json` block.
