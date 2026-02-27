import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const ALLOWED_AGENTS = new Set([
  "program-manager",
  "orchestrator",
  "general",
  "designer",
  "implementor",
  "review-coordinator",
  "testor",
])

const HANDOFF_TYPES = [
  "task-brief",
  "checkpoint",
  "completion",
  "review-verdict",
  "test-verdict",
] as const

type HandoffType = (typeof HANDOFF_TYPES)[number]

function isENOENT(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeCode = (error as { code?: string }).code
  return maybeCode === "ENOENT"
}

function normalizeSlug(input: string): string {
  const collapsed = input
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  if (!collapsed) {
    throw new Error("Invalid slug: provide at least one filename-safe character")
  }

  return collapsed
}

function ensureAgentAllowed(agent: string): void {
  if (ALLOWED_AGENTS.has(agent)) {
    return
  }

  throw new Error(
    `save-handoff is not allowed for agent '${agent}'. Allowed agents: ${Array.from(ALLOWED_AGENTS).join(
      ", ",
    )}`,
  )
}

function isCheckpointFile(entry: string, slug: string): number | undefined {
  const prefix = `${slug}-checkpoint-`
  const suffix = ".md"

  if (!entry.startsWith(prefix) || !entry.endsWith(suffix)) {
    return undefined
  }

  const numberPart = entry.slice(prefix.length, entry.length - suffix.length)
  if (!/^\d+$/.test(numberPart)) {
    return undefined
  }

  const parsed = Number.parseInt(numberPart, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

async function nextCheckpointNumber(directory: string, slug: string): Promise<number> {
  const entries = await readdir(directory)
  let max = 0

  for (const entry of entries) {
    const checkpointNumber = isCheckpointFile(entry, slug)
    if (checkpointNumber && checkpointNumber > max) {
      max = checkpointNumber
    }
  }

  return max + 1
}

function buildFileName(
  handoffType: HandoffType,
  slug: string,
  checkpointNumber: number | undefined,
): string {
  switch (handoffType) {
    case "task-brief":
      return `${slug}.md`
    case "checkpoint":
      if (!checkpointNumber) {
        throw new Error("Checkpoint number is required for checkpoint handoffs")
      }

      return `${slug}-checkpoint-${checkpointNumber}.md`
    case "completion":
      return `${slug}-completion.md`
    case "review-verdict":
      return `${slug}-review.md`
    case "test-verdict":
      return `${slug}-test.md`
  }
}

export default tool({
  description: "Persist a handoff artifact to the harness handoffs directory",
  args: {
    handoffType: tool.schema
      .enum(HANDOFF_TYPES)
      .describe("Handoff type: task-brief, checkpoint, completion, review-verdict, or test-verdict"),
    slug: tool.schema
      .string()
      .min(1)
      .describe("Task slug used as the base filename for this handoff"),
    content: tool.schema
      .string()
      .min(1)
      .describe("Exact handoff text to persist without format changes"),
  },
  async execute(args, context) {
    ensureAgentAllowed(context.agent)

    const slug = normalizeSlug(args.slug)
    const sessionDirectory = path.join(
      os.homedir(),
      "logs",
      "opencode-harness",
      "handoffs",
      context.sessionID,
    )

    await mkdir(sessionDirectory, { recursive: true })

    const checkpointNumber =
      args.handoffType === "checkpoint"
        ? await nextCheckpointNumber(sessionDirectory, slug)
        : undefined

    const fileName = buildFileName(args.handoffType, slug, checkpointNumber)
    const filePath = path.join(sessionDirectory, fileName)

    let wrote = true
    if (args.handoffType !== "checkpoint") {
      try {
        const existing = await readFile(filePath, "utf8")
        wrote = existing !== args.content
      } catch (error) {
        if (!isENOENT(error)) {
          throw error
        }
      }
    }

    if (wrote) {
      await writeFile(filePath, args.content, "utf8")
    }

    const metadata = {
      path: filePath,
      handoffType: args.handoffType,
      slug,
      sessionID: context.sessionID,
      checkpoint: checkpointNumber,
      written: wrote,
    }

    context.metadata({
      title: `save-handoff: ${fileName}`,
      metadata,
    })

    return JSON.stringify(metadata, null, 2)
  },
})
