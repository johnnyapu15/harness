import { tool } from "@opencode-ai/plugin";

const MAX_ERROR_LENGTH = 400;
const MAX_PATTERNS = 3;
const MAX_FACTS = 8;
const MAX_SUMMARY_LENGTH = 1200;
const MAX_DETAILS_LENGTH = 2000;
const SLACK_API_BASE = "https://slack.com/api";

function truncate(text, maxLength) {
  if (typeof text !== "string") {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function extractErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error.message === "string") {
    return error.message;
  }
  if (error.data && typeof error.data.message === "string") {
    return error.data.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function unwrapData(result) {
  if (!result || typeof result !== "object") {
    return null;
  }
  if ("data" in result || "error" in result) {
    if (result.error || !result.data || typeof result.data !== "object") {
      return null;
    }
    return result.data;
  }
  return result;
}

async function getSessionInfo(client, sessionID) {
  const calls = [
    () => client.session.get({ sessionID }),
    () => client.session.get({ path: { sessionID } }),
    () => client.session.get({ path: { id: sessionID } }),
  ];

  for (const call of calls) {
    try {
      const result = await call();
      const session = unwrapData(result);
      if (session && typeof session.id === "string") {
        return session;
      }
    } catch {
      // Try the next compatible call shape.
    }
  }

  return null;
}

async function isRootSession(client, sessionID, cache) {
  if (!sessionID) {
    return false;
  }

  if (cache.has(sessionID)) {
    return cache.get(sessionID);
  }

  const session = await getSessionInfo(client, sessionID);
  if (!session) {
    return false;
  }

  const root = !session.parentID;
  cache.set(sessionID, root);
  return root;
}

function formatQuestionMessage(properties) {
  const lines = [`[opencode][question] session=${properties.sessionID}`];
  const questions = Array.isArray(properties.questions)
    ? properties.questions
    : [];

  for (const entry of questions) {
    if (entry && typeof entry.question === "string") {
      lines.push(entry.question);
    }
    const options = Array.isArray(entry?.options)
      ? entry.options
          .map((option) => option?.label)
          .filter((label) => typeof label === "string" && label.length > 0)
      : [];
    if (options.length > 0) {
      lines.push(`choices: ${options.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function formatPermissionMessage(properties) {
  const lines = [`[opencode][permission] session=${properties.sessionID}`];

  const permissionText =
    typeof properties.permission === "string"
      ? properties.permission
      : typeof properties.title === "string"
        ? properties.title
        : typeof properties.type === "string"
          ? properties.type
          : "permission request";
  lines.push(`permission: ${permissionText}`);

  const patterns =
    Array.isArray(properties.patterns)
      ? properties.patterns
      : typeof properties.pattern === "string"
        ? [properties.pattern]
        : Array.isArray(properties.pattern)
          ? properties.pattern
          : [];

  if (patterns.length > 0) {
    lines.push(`patterns: ${patterns.slice(0, MAX_PATTERNS).join(", ")}`);
  }

  if (typeof properties.id === "string") {
    lines.push(`id: ${properties.id}`);
  }

  lines.push("User approval is required.");
  return lines.join("\n");
}

function formatErrorMessage(properties) {
  const sessionText = properties.sessionID
    ? ` session=${properties.sessionID}`
    : "";
  const detail = truncate(
    extractErrorMessage(properties.error),
    MAX_ERROR_LENGTH,
  );
  return `[opencode][error]${sessionText}\n${detail}`;
}

function formatResultMessage(properties) {
  return `[opencode][result] session=${properties.sessionID}\nAssistant response is ready.`;
}

function getStatusMeta(status) {
  switch (status) {
    case "success":
      return { prefix: "[OK]", label: "success" };
    case "warning":
      return { prefix: "[WARN]", label: "warning" };
    case "error":
      return { prefix: "[ERROR]", label: "error" };
    default:
      return { prefix: "[INFO]", label: "info" };
  }
}

function getDefaultTitle(kind) {
  switch (kind) {
    case "permission":
      return "Action Required";
    case "milestone":
      return "Milestone Update";
    case "error":
      return "Error Reported";
    case "final":
      return "Final Update";
    default:
      return "Notification";
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeFacts(facts) {
  if (!Array.isArray(facts)) {
    return [];
  }
  return facts
    .map((fact) => {
      if (!fact || typeof fact !== "object") {
        return null;
      }
      const key = asString(fact.key).trim();
      const value = asString(fact.value).trim();
      if (!key || !value) {
        return null;
      }
      return {
        key: truncate(key, 80),
        value: truncate(value, 1800),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_FACTS);
}

function renderTemplate({
  kind = "info",
  title,
  summary,
  status = "info",
  facts = [],
  details,
  sessionID,
  blocks,
  message,
}) {
  const hasCustomBlocks = Array.isArray(blocks) && blocks.length > 0;
  if (hasCustomBlocks) {
    const fallback = truncate(
      asString(message || summary || title || "Notification"),
      3000,
    );
    return {
      text: fallback || "[opencode] notification",
      blocks,
    };
  }

  const resolvedKind = asString(kind, "info");
  const resolvedTitle = truncate(
    asString(title || getDefaultTitle(resolvedKind), "Notification"),
    150,
  );
  const resolvedSummary = truncate(
    asString(summary || message || "Notification"),
    MAX_SUMMARY_LENGTH,
  );
  const resolvedDetails = truncate(asString(details), MAX_DETAILS_LENGTH);
  const normalizedFacts = normalizeFacts(facts);
  const statusMeta = getStatusMeta(status);
  const autoFacts = [
    { key: "kind", value: resolvedKind },
    ...(sessionID ? [{ key: "session", value: sessionID }] : []),
    ...normalizedFacts,
  ].slice(0, MAX_FACTS);

  const renderedBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${statusMeta.prefix} ${resolvedTitle}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: resolvedSummary,
      },
    },
  ];

  if (autoFacts.length > 0) {
    renderedBlocks.push({
      type: "section",
      fields: autoFacts.map((fact) => ({
        type: "mrkdwn",
        text: `*${fact.key}*\n${fact.value}`,
      })),
    });
  }

  if (resolvedDetails) {
    renderedBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*details*\n${resolvedDetails}`,
      },
    });
  }

  renderedBlocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `status: *${statusMeta.label}*` }],
  });

  return {
    text: truncate(`[opencode][${resolvedKind}] ${resolvedSummary}`, 3000),
    blocks: renderedBlocks,
  };
}

function getEventNotification(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  switch (event.type) {
    case "question.asked":
      return {
        sessionID: event.properties?.sessionID,
        kind: "permission",
        status: "warning",
        title: "User Input Required",
        summary: "A question was asked and needs an answer.",
        details: formatQuestionMessage(event.properties ?? {}),
        facts: [{ key: "event", value: "question.asked" }],
      };
    case "permission.asked":
    case "permission.ask":
      return {
        sessionID: event.properties?.sessionID,
        kind: "permission",
        status: "warning",
        title: "Permission Required",
        summary: "A permission request is waiting for approval.",
        details: formatPermissionMessage(event.properties ?? {}),
        facts: [{ key: "event", value: event.type }],
      };
    case "session.error":
      return {
        sessionID: event.properties?.sessionID,
        kind: "error",
        status: "error",
        title: "Session Error",
        summary: truncate(
          extractErrorMessage(event.properties?.error),
          MAX_ERROR_LENGTH,
        ),
        details: formatErrorMessage(event.properties ?? {}),
        facts: [{ key: "event", value: "session.error" }],
      };
    case "session.idle":
      return {
        sessionID: event.properties?.sessionID,
        kind: "final",
        status: "success",
        title: "Assistant Response Ready",
        summary: "The session reached idle state.",
        details: formatResultMessage(event.properties ?? {}),
        facts: [{ key: "event", value: "session.idle" }],
      };
    default:
      return null;
  }
}

async function postSlack({
  text,
  blocks,
  webhook,
  username,
  channel,
  requireDelivery = false,
  threadTs,
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  const resolvedChannel =
    channel || process.env.SLACK_CHANNEL_ID || process.env.SLACK_CHANNEL;

  if (token && resolvedChannel) {
    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: resolvedChannel,
        text,
        ...(blocks ? { blocks } : {}),
        ...(username ? { username } : {}),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    });
    const body = await response.text().catch(() => "");
    let data = null;
    try {
      data = JSON.parse(body);
    } catch {
      data = null;
    }
    if (!response.ok || !data?.ok) {
      throw new Error(
        `Slack bot API failed: HTTP ${response.status} ${response.statusText}\n${body}`,
      );
    }
    return data.ts || "ok";
  }

  const resolvedWebhook = webhook || process.env.SLACK_WEBHOOK_URL;
  if (!resolvedWebhook) {
    if (requireDelivery) {
      throw new Error(
        "Missing Slack destination. Set SLACK_BOT_TOKEN + SLACK_CHANNEL_ID (or SLACK_CHANNEL), or set SLACK_WEBHOOK_URL.",
      );
    }
    return null;
  }

  const payload = {
    text,
    ...(blocks ? { blocks } : {}),
    ...(username ? { username } : {}),
    ...(channel ? { channel } : {}),
  };

  const response = await fetch(resolvedWebhook, {
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
}

export const SlackWebhookPlugin = async ({ client }) => {
  const rootSessionCache = new Map();

  return {
    tool: {
      slack_notify: tool({
        description:
          "Post a Slack notification with optional structured Block Kit payload",
        args: {
          message: tool.schema
            .string()
            .optional()
            .describe("Fallback text message to post"),
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
            .describe(
              "Channel id/name override (for bot token or webhook override)",
            ),
          thread_ts: tool.schema
            .string()
            .optional()
            .describe("Thread timestamp for Slack bot reply"),
          kind: tool.schema
            .enum(["info", "permission", "milestone", "error", "final"])
            .optional()
            .describe("Structured notification type"),
          title: tool.schema
            .string()
            .optional()
            .describe("Structured notification title"),
          summary: tool.schema
            .string()
            .optional()
            .describe("Structured notification summary"),
          status: tool.schema
            .enum(["info", "success", "warning", "error"])
            .optional()
            .describe("Status style for Block Kit card"),
          facts: tool.schema
            .array(
              tool.schema.object({
                key: tool.schema.string(),
                value: tool.schema.string(),
              }),
            )
            .optional()
            .describe("Optional key-value facts for Block Kit fields"),
          details: tool.schema
            .string()
            .optional()
            .describe("Longer details section for structured notifications"),
          blocks: tool.schema
            .array(tool.schema.object({}).passthrough())
            .optional()
            .describe("Raw Slack blocks override"),
        },
        async execute(args) {
          const payload = renderTemplate({
            kind: args.kind,
            title: args.title,
            summary: args.summary,
            status: args.status,
            facts: args.facts,
            details: args.details,
            blocks: args.blocks,
            message: args.message,
          });

          if (args.dry_run) {
            return JSON.stringify(
              {
                transport: process.env.SLACK_BOT_TOKEN ? "bot-token" : "webhook",
                payload: {
                  text: payload.text,
                  ...(payload.blocks ? { blocks: payload.blocks } : {}),
                  ...(args.username ? { username: args.username } : {}),
                  ...(args.channel ? { channel: args.channel } : {}),
                  ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
                },
              },
              null,
              2,
            );
          }

          return postSlack({
            text: payload.text,
            blocks: payload.blocks,
            webhook: args.webhook,
            username: args.username,
            channel: args.channel,
            threadTs: args.thread_ts,
            requireDelivery: false,
          });
        },
      }),
    },
    "permission.ask": async (input, output) => {
      if (output.status !== "ask") {
        return;
      }

      const notification = {
        sessionID: input.sessionID,
        kind: "permission",
        status: "warning",
        title: "Permission Required",
        summary: "A permission request is waiting for approval.",
        details: formatPermissionMessage(input),
        facts: [{ key: "event", value: "permission.ask" }],
      };

      const rootSession = await isRootSession(
        client,
        notification.sessionID,
        rootSessionCache,
      );
      if (!rootSession) {
        return;
      }

      try {
        const payload = renderTemplate(notification);
        await postSlack({
          text: payload.text,
          blocks: payload.blocks,
        });
      } catch {
        // Keep hooks non-blocking.
      }
    },
    event: async ({ event }) => {
      const notification = getEventNotification(event);
      if (!notification) {
        return;
      }

      const rootSession = await isRootSession(
        client,
        notification.sessionID,
        rootSessionCache,
      );
      if (!rootSession) {
        return;
      }

      try {
        const payload = renderTemplate(notification);
        await postSlack({
          text: payload.text,
          blocks: payload.blocks,
        });
      } catch {
        // Keep event handling non-blocking.
      }
    },
  };
};
