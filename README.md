# johnnyapu15 Harness Registry

A public OCX registry that ships reusable harness automation components.

## Agent-Facing Guide

- This registry is designed for OpenCode-compatible AI agents that install components into a local `.opencode` workspace.
- Use the registry as a read-only package source and keep local customizations in your own repository.
- Resolve component metadata from `index.json` and pin explicit versions when reproducibility matters.
- Install only components required for the current task to reduce runtime and prompt surface area.

## Registry Endpoints

- Base URL: `https://johnnyapu15.github.io/harness`
- Discovery document: `https://johnnyapu15.github.io/harness/.well-known/ocx.json`
- Registry index: `https://johnnyapu15.github.io/harness/index.json`
- Component metadata: `https://johnnyapu15.github.io/harness/components/<component-name>.json`
- Component files: `https://johnnyapu15.github.io/harness/components/<component-name>/<source-path>`

## Quick Start

```bash
ocx registry add https://johnnyapu15.github.io/harness --name harness
```

## What This Registry Contains

- Agent profiles for orchestration, implementation, research, review, and test workflows.
- Commands for review, summarize, test, Slack posting, and Coolify verification tasks.
- Skills for handoff formatting, history logging, session analysis, review merge rules, and final-gate audits.
- Tools for loop-state tracking, handoff persistence, and session history logging.
- A Slack webhook plugin for notification integrations.

## Environment Variables

| Variable | Used By | Purpose | Required |
| --- | --- | --- | --- |
| `SLACK_WEBHOOK_URL` | `command-slack`, `command-slack-post`, `plugin-slack-webhook` | Sends Slack incoming-webhook messages. | Required for webhook posting flows. |
| `SLACK_BOT_TOKEN` | Slack bot-token workflows in local integrations | Authenticates Slack Web API calls. | Required only for bot-token flows. |
| `COOLIFY_TOKEN` | `command-coolify-verify` | Authenticates requests to the Coolify API. | Required for Coolify verification flows. |
| `COOLIFY_BASE_URL` | `command-coolify-verify` | Defines the Coolify API base URL. | Required for Coolify verification flows. |
| `OPENCODE_ENABLE_EXA` | `agent-researcher` (`websearch`, `codesearch`) | Enables Exa-backed search tools when runtime flags gate them. | Required where provider settings do not already enable Exa tools. |
| `HOME` | Runtime path resolution | Resolves local target paths under the user home directory. | Usually provided by the OS environment. |

Note: `websearch` and `codesearch` are available only when Exa tools are enabled (for example, `OPENCODE_ENABLE_EXA=true`), unless the active provider path already enables them.

Resolution rules:

1. Read variables from the active process environment at execution time.
2. If both shell exports and local env loading are present, the running process value is authoritative.
3. Never hardcode credential values in registry files, prompts, logs, or commits.
4. Treat missing required variables as blocking configuration errors and fail fast with the variable name.
5. Keep `HOME` OS-managed unless sandboxing requires an explicit override.

## Agent Operating Rules

- Read registry metadata first and fetch only the components needed for the active task.
- Keep scope tight and avoid installing unrelated components for convenience.
- When credentials are needed, reference variable names only and never include secret values.
- Report failures with reproducible commands and exact endpoint paths.
- Respect local repository policy, branch protections, and safety checks after installing components.

## Security Notes

- Never commit secrets, tokens, or webhook URLs into registry content or generated artifacts.
- Use least-privilege Slack and Coolify credentials.
- Validate destination hosts before sending authenticated requests.
- Rotate credentials immediately if exposure is suspected.
- Review logs and handoff artifacts for accidental secret leakage before sharing.

## Versioning

- The registry semantic version is published in `index.json` (`version`).
- Component channels are published through `dist-tags.latest` in each `components/<name>.json` file.
- Pin exact versions for reproducible automation and use `latest` only when controlled drift is acceptable.
- Update release commits when behavior, interfaces, or security expectations change.

## Troubleshooting

- Registry add fails: confirm `https://johnnyapu15.github.io/harness/.well-known/ocx.json` is reachable.
- Component not found: verify the component name in `index.json` and `components/<name>.json`.
- Version mismatch: inspect `dist-tags` and pin a listed version explicitly.
- Slack or Coolify command failures: confirm required variables are exported in the active shell.
- Path write errors: verify `HOME` and local permissions for the target `.opencode` paths.
