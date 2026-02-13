import { tool } from "@opencode-ai/plugin";

export const SlackWebhookPlugin = async () => {
  return {
    tool: {
      slack_notify: tool({
        description: "Post a message to Slack via Incoming Webhook",
        args: {
          message: tool.schema.string().describe("Message text to post"),
          webhook: tool.schema
            .string()
            .optional()
            .describe(
              "Slack Incoming Webhook URL (defaults to SLACK_WEBHOOK_URL)",
            ),
          dry_run: tool.schema
            .boolean()
            .optional()
            .describe("If true, do not send; just return payload"),
          username: tool.schema
            .string()
            .optional()
            .describe("Optional Slack username override"),
          channel: tool.schema
            .string()
            .optional()
            .describe("Optional channel override (if webhook allows)"),
        },
        async execute(args) {
          const webhook = args.webhook || process.env.SLACK_WEBHOOK_URL;
          if (!webhook) {
            throw new Error(
              "Missing Slack webhook. Provide args.webhook or set SLACK_WEBHOOK_URL.",
            );
          }

          const payload = {
            text: args.message,
            ...(args.username ? { username: args.username } : {}),
            ...(args.channel ? { channel: args.channel } : {}),
          };

          if (args.dry_run) {
            return JSON.stringify({ webhook: "<redacted>", payload }, null, 2);
          }

          const response = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const body = await response.text().catch(() => "");
          if (!response.ok) {
            throw new Error(
              `Slack webhook failed: HTTP ${response.status} ${response.statusText}\n${body}`,
            );
          }

          return body || "ok";
        },
      }),
    },
  };
};
