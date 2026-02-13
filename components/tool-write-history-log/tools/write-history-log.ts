import { mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

function ensureAgentAllowed(agent: string): void {
  if (agent === "orchestrator") {
    return
  }

  throw new Error(
    `write-history-log is not allowed for agent '${agent}'. Allowed agent: orchestrator`,
  )
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

export default tool({
  description: "Write one session history line to the harness history log",
  args: {
    date: tool.schema
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Date in YYYY-MM-DD format"),
    project: tool.schema.string().min(1).describe("Project name"),
    task: tool.schema.string().min(1).describe("Short task summary"),
    files: tool.schema.number().int().min(0).describe("Number of files touched"),
    additions: tool.schema.number().int().min(0).describe("Total added lines"),
    deletions: tool.schema.number().int().min(0).describe("Total deleted lines"),
    agents: tool.schema.string().min(1).describe("Agent=model mapping list"),
    tools: tool.schema.string().min(1).describe("Tool usage counts summary"),
    total: tool.schema.string().min(1).describe("Total elapsed time"),
    active: tool.schema.string().min(1).describe("Active working time"),
    human: tool.schema.string().min(1).describe("Human wait/reply time"),
    review: tool.schema.string().min(1).describe("Review result: pass|fail|none"),
    test: tool.schema.string().min(1).describe("Test result: pass|fail|partial|none"),
    notes: tool.schema.string().min(1).describe("Notes summary or note count"),
  },
  async execute(args, context) {
    ensureAgentAllowed(context.agent)

    const line = `${args.date} | project:${oneLine(args.project)} | session:${context.sessionID} | task:${oneLine(args.task)} | files:${args.files} +${args.additions}/-${args.deletions} | agents:${oneLine(args.agents)} | tools:${oneLine(args.tools)} | total:${oneLine(args.total)} active:${oneLine(args.active)} human:${oneLine(args.human)} | review:${oneLine(args.review)} test:${oneLine(args.test)} | notes:${oneLine(args.notes)}`

    const historyDirectory = path.join(os.homedir(), "logs", "opencode-harness", "history")
    await mkdir(historyDirectory, { recursive: true })

    const filePath = path.join(historyDirectory, `${context.sessionID}.log`)
    const output = `${line}\n`
    await writeFile(filePath, output, "utf8")

    const metadata = {
      path: filePath,
      sessionID: context.sessionID,
      bytes: Buffer.byteLength(output, "utf8"),
      line,
    }

    context.metadata({
      title: `write-history-log: ${context.sessionID}.log`,
      metadata,
    })

    return JSON.stringify(metadata, null, 2)
  },
})
