#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

SLACK_API_BASE = "https://slack.com/api"
MAX_FACTS = 8
MAX_SUMMARY_LENGTH = 1200
MAX_DETAILS_LENGTH = 2000


def eprint(*args):
    print(*args, file=sys.stderr)


def read_text(args, required=True):
    if args.text and args.text_file:
        eprint("error: use only one of --text or --text-file")
        return None
    if args.text_file:
        try:
            with open(args.text_file, "r", encoding="utf-8") as f:
                return f.read().rstrip("\n")
        except OSError as exc:
            eprint(f"error: failed to read --text-file: {exc}")
            return None
    if args.text:
        return args.text
    if not sys.stdin.isatty():
        return sys.stdin.read().rstrip("\n")
    if required:
        eprint("error: message text required (use --text, --text-file, or stdin)")
    return None


def http_json(url, method="GET", headers=None, payload=None):
    if headers is None:
        headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json; charset=utf-8"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def list_channels(token, types):
    channels = []
    cursor = ""
    headers = {"Authorization": f"Bearer {token}"}
    while True:
        params = {"limit": "200", "types": types}
        if cursor:
            params["cursor"] = cursor
        url = f"{SLACK_API_BASE}/conversations.list?{urllib.parse.urlencode(params)}"
        data = http_json(url, headers=headers)
        if not data.get("ok"):
            return data
        channels.extend(data.get("channels", []))
        cursor = data.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            break
    return {"ok": True, "channels": channels}


def resolve_channel_id(token, name):
    name = name.lstrip("#")
    data = list_channels(token, "public_channel")
    if not data.get("ok"):
        return None, data
    for ch in data.get("channels", []):
        if ch.get("name") == name:
            return ch.get("id"), None
    return None, {"ok": False, "error": "channel_not_found"}


def post_message(token, channel_id, text, thread_ts=None, blocks=None):
    url = f"{SLACK_API_BASE}/chat.postMessage"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"channel": channel_id, "text": text}
    if blocks:
        payload["blocks"] = blocks
    if thread_ts:
        payload["thread_ts"] = thread_ts
    return http_json(url, method="POST", headers=headers, payload=payload)


def post_webhook(webhook, text, blocks=None):
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    return http_json(webhook, method="POST", payload=payload)


def truncate(text, max_len):
    if not isinstance(text, str):
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."


def parse_blocks(args):
    if args.blocks_json and args.blocks_file:
        eprint("error: use only one of --blocks-json or --blocks-file")
        return None

    raw = None
    if args.blocks_json:
        raw = args.blocks_json
    elif args.blocks_file:
        try:
            with open(args.blocks_file, "r", encoding="utf-8") as f:
                raw = f.read()
        except OSError as exc:
            eprint(f"error: failed to read --blocks-file: {exc}")
            return None
    else:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        eprint(f"error: invalid JSON for blocks: {exc}")
        return None

    if not isinstance(parsed, list):
        eprint("error: blocks JSON must be an array")
        return None
    return parsed


def parse_facts(items):
    facts = []
    for item in items or []:
        if "=" in item:
            key, value = item.split("=", 1)
        elif ":" in item:
            key, value = item.split(":", 1)
        else:
            eprint(f"error: invalid --fact format: {item} (use key=value)")
            return None
        key = key.strip()
        value = value.strip()
        if not key or not value:
            eprint(f"error: invalid --fact format: {item} (empty key/value)")
            return None
        facts.append({"key": truncate(key, 80), "value": truncate(value, 1800)})
    return facts[:MAX_FACTS]


def build_template(kind, title, summary, status, facts, details, session_id=None):
    kind = kind or "info"
    status = status or "info"

    if not title:
        if kind == "permission":
            title = "Action Required"
        elif kind == "milestone":
            title = "Milestone Update"
        elif kind == "error":
            title = "Error Reported"
        elif kind == "final":
            title = "Final Update"
        else:
            title = "Notification"

    summary = truncate(summary or "Notification", MAX_SUMMARY_LENGTH)
    details = truncate(details or "", MAX_DETAILS_LENGTH)
    title = truncate(title, 150)

    facts = list(facts or [])
    facts.insert(0, {"key": "kind", "value": kind})
    if session_id:
        facts.insert(1, {"key": "session", "value": session_id})
    facts = facts[:MAX_FACTS]

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"[{status.upper()}] {title}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": summary}},
    ]
    if facts:
        blocks.append(
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*{f['key']}*\n{f['value']}"}
                    for f in facts
                ],
            }
        )
    if details:
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*details*\n{details}"},
            }
        )
    blocks.append(
        {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"status: *{status}*"}],
        }
    )

    text = truncate(f"[opencode][{kind}] {summary}", 3000)
    return text, blocks


def main():
    parser = argparse.ArgumentParser(description="Post Slack messages")
    parser.add_argument("--text", help="Message text")
    parser.add_argument("--text-file", help="File containing message text")
    parser.add_argument("--channel-id", help="Slack channel ID (e.g., C012ABCDEF)")
    parser.add_argument("--channel-name", help="Slack channel name (e.g., llm-notification)")
    parser.add_argument("--thread-ts", help="Thread timestamp to reply in a thread")
    parser.add_argument("--webhook", help="Slack incoming webhook URL")
    parser.add_argument("--list-channels", action="store_true", help="List public channels (requires channels:read)")
    parser.add_argument("--kind", choices=["info", "permission", "milestone", "error", "final"], help="Structured notification kind")
    parser.add_argument("--title", help="Structured notification title")
    parser.add_argument("--summary", help="Structured notification summary")
    parser.add_argument("--status", choices=["info", "success", "warning", "error"], help="Structured notification status")
    parser.add_argument("--fact", action="append", default=[], help="Fact key/value (repeatable, format key=value)")
    parser.add_argument("--details", help="Structured details body")
    parser.add_argument("--session-id", help="Optional session id for structured notifications")
    parser.add_argument("--blocks-json", help="Raw Slack blocks JSON array string")
    parser.add_argument("--blocks-file", help="Path to file containing raw Slack blocks JSON array")
    args = parser.parse_args()

    if args.list_channels:
        token = os.getenv("SLACK_BOT_TOKEN")
        if not token:
            print(
                json.dumps(
                    {"ok": True, "skipped": True, "reason": "missing SLACK_BOT_TOKEN"}
                )
            )
            return 0
        data = list_channels(token, "public_channel")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0 if data.get("ok") else 2

    token = os.getenv("SLACK_BOT_TOKEN")
    webhook = args.webhook or os.getenv("SLACK_WEBHOOK_URL")
    if not token and not webhook:
        print(
            json.dumps(
                {
                    "ok": True,
                    "skipped": True,
                    "reason": "missing SLACK_BOT_TOKEN and SLACK_WEBHOOK_URL",
                }
            )
        )
        return 0

    facts = parse_facts(args.fact)
    if facts is None:
        return 2

    blocks = parse_blocks(args)
    if blocks is None:
        return 2

    template_requested = any(
        [
            args.kind,
            args.title,
            args.summary,
            args.status,
            args.details,
            args.session_id,
            facts,
            bool(blocks),
        ]
    )

    text = read_text(args, required=not template_requested)
    if text is None and not template_requested:
        return 2

    if blocks:
        if not text:
            text = truncate(args.summary or args.title or "Notification", 3000)
    elif template_requested:
        text, blocks = build_template(
            kind=args.kind,
            title=args.title,
            summary=args.summary or text,
            status=args.status,
            facts=facts,
            details=args.details,
            session_id=args.session_id,
        )
    elif not text:
        eprint("error: message text required")
        return 2

    if not token:
        data = post_webhook(webhook, text, blocks=blocks)
        # Incoming webhook returns plain "ok" or a JSON error
        if isinstance(data, dict) and not data.get("ok", True):
            eprint(f"error: webhook failed: {data}")
            return 2
        print("ok")
        return 0

    channel_id = args.channel_id or os.getenv("SLACK_CHANNEL_ID") or os.getenv("SLACK_CHANNEL")
    if not channel_id and args.channel_name:
        channel_id, err = resolve_channel_id(token, args.channel_name)
        if not channel_id:
            eprint(f"error: cannot resolve channel name: {err}")
            return 2

    if not channel_id:
        webhook = args.webhook or os.getenv("SLACK_WEBHOOK_URL")
        if webhook:
            data = post_webhook(webhook, text, blocks=blocks)
            if isinstance(data, dict) and not data.get("ok", True):
                eprint(f"error: webhook failed: {data}")
                return 2
            print("ok")
            return 0
        eprint("error: channel is required (use --channel-id/--channel-name or set SLACK_CHANNEL_ID)")
        return 2

    data = post_message(token, channel_id, text, thread_ts=args.thread_ts, blocks=blocks)
    if not data.get("ok"):
        eprint(f"error: post failed: {data}")
        return 2

    print(json.dumps({"ok": True, "channel": channel_id, "ts": data.get("ts")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
