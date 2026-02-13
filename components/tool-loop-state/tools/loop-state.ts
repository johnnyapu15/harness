import { mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const LOOP_TYPES = ["d", "i", "f"] as const
const VERDICTS = ["pass", "fail", "partial"] as const
const OUTCOMES = ["pass", "fail"] as const

type LoopType = (typeof LOOP_TYPES)[number]
type Verdict = (typeof VERDICTS)[number]

type LoopStatus = "active" | "passed" | "failed"

type GateRecord = {
  gate: string
  verdict: Verdict
  blockers: string[]
  artifactPath?: string
  recordedAt: string
}

type CycleState = {
  cycle: number
  records: GateRecord[]
}

type LoopState = {
  version: 1
  runId: string
  slug: string
  loopType: LoopType
  owner: "orchestrator" | "implementor"
  maxCount: number
  status: LoopStatus
  createdAt: string
  updatedAt: string
  finalizedAt?: string
  finalReason?: string
  cycles: CycleState[]
}

function nowISO(): string {
  return new Date().toISOString()
}

function normalizeToken(input: string, label: string): string {
  const normalized = input
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  if (!normalized) {
    throw new Error(`Invalid ${label}: provide at least one filename-safe character`)
  }

  return normalized
}

function oneLine(input: string): string {
  return input.replace(/[\r\n]+/g, " ").trim()
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of values) {
    const value = oneLine(raw)
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    out.push(value)
  }

  return out
}

function ownerForLoop(loopType: LoopType): "orchestrator" | "implementor" {
  if (loopType === "i") {
    return "implementor"
  }

  return "orchestrator"
}

function ensureLoopOwner(loopType: LoopType, agent: string): void {
  const expected = ownerForLoop(loopType)
  if (agent !== expected) {
    throw new Error(
      `loop-state '${loopType}' can only be used by '${expected}'. Current agent: '${agent}'`,
    )
  }
}

function ensureStateOwner(state: LoopState, agent: string): void {
  if (state.owner === agent) {
    return
  }

  throw new Error(
    `loop-state run '${state.runId}' is owned by '${state.owner}'. Current agent: '${agent}'`,
  )
}

function loopsDirectory(sessionID: string): string {
  return path.join(os.homedir(), "logs", "opencode-harness", "handoffs", sessionID, "loops")
}

function runPath(sessionID: string, runId: string): string {
  return path.join(loopsDirectory(sessionID), `${runId}.json`)
}

function parseLoopState(raw: string, filePath: string): LoopState {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`loop-state file is not valid JSON: ${filePath}`)
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`loop-state file is malformed: ${filePath}`)
  }

  return parsed as LoopState
}

async function readState(sessionID: string, runId: string): Promise<{ state: LoopState; filePath: string }> {
  const filePath = runPath(sessionID, runId)
  const raw = await readFile(filePath, "utf8")
  const state = parseLoopState(raw, filePath)
  return { state, filePath }
}

async function writeState(sessionID: string, state: LoopState): Promise<string> {
  const directory = loopsDirectory(sessionID)
  await mkdir(directory, { recursive: true })
  const filePath = runPath(sessionID, state.runId)
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
  return filePath
}

function requireActionField<T>(value: T | undefined, action: string, field: string): T {
  if (value !== undefined) {
    return value
  }

  throw new Error(`loop-state action '${action}' requires '${field}'`)
}

function ensureActive(state: LoopState, action: string): void {
  if (state.status === "active") {
    return
  }

  throw new Error(`loop-state action '${action}' requires an active run. Current status: ${state.status}`)
}

function upsertCycle(state: LoopState, cycle: number): CycleState {
  const existing = state.cycles.find((entry) => entry.cycle === cycle)
  if (existing) {
    return existing
  }

  const created: CycleState = { cycle, records: [] }
  state.cycles.push(created)
  state.cycles.sort((a, b) => a.cycle - b.cycle)
  return created
}

function latestRecordsByGate(cycleState: CycleState): Map<string, GateRecord> {
  const byGate = new Map<string, GateRecord>()
  for (const record of cycleState.records) {
    byGate.set(record.gate, record)
  }
  return byGate
}

function evaluateCycle(
  state: LoopState,
  cycle: number,
  requiredGates: string[],
): {
  status: "pass" | "retry" | "fail" | "incomplete"
  canRetry: boolean
  nextCycle: number | null
  blockers: string[]
  missingGates: string[]
  consideredGates: string[]
} {
  if (cycle < 0 || cycle >= state.maxCount) {
    throw new Error(`cycle '${cycle}' is out of range for maxCount '${state.maxCount}'`)
  }

  const cycleState = state.cycles.find((entry) => entry.cycle === cycle)
  if (!cycleState) {
    return {
      status: "incomplete",
      canRetry: cycle + 1 < state.maxCount,
      nextCycle: cycle + 1 < state.maxCount ? cycle + 1 : null,
      blockers: [],
      missingGates: uniqueStrings(requiredGates),
      consideredGates: [],
    }
  }

  const latestByGate = latestRecordsByGate(cycleState)
  const required = uniqueStrings(requiredGates)

  const consideredGates =
    required.length > 0 ? required : uniqueStrings(Array.from(latestByGate.keys()))

  if (consideredGates.length === 0) {
    return {
      status: "incomplete",
      canRetry: cycle + 1 < state.maxCount,
      nextCycle: cycle + 1 < state.maxCount ? cycle + 1 : null,
      blockers: [],
      missingGates: [],
      consideredGates: [],
    }
  }

  const missingGates: string[] = []
  const consideredRecords: GateRecord[] = []

  for (const gate of consideredGates) {
    const record = latestByGate.get(gate)
    if (!record) {
      missingGates.push(gate)
      continue
    }

    consideredRecords.push(record)
  }

  if (missingGates.length > 0) {
    return {
      status: "incomplete",
      canRetry: cycle + 1 < state.maxCount,
      nextCycle: cycle + 1 < state.maxCount ? cycle + 1 : null,
      blockers: [],
      missingGates,
      consideredGates,
    }
  }

  const failing = consideredRecords.filter((record) => record.verdict !== "pass")
  if (failing.length === 0) {
    return {
      status: "pass",
      canRetry: cycle + 1 < state.maxCount,
      nextCycle: cycle + 1 < state.maxCount ? cycle + 1 : null,
      blockers: [],
      missingGates: [],
      consideredGates,
    }
  }

  const blockers = uniqueStrings(failing.flatMap((record) => record.blockers))
  const canRetry = cycle + 1 < state.maxCount
  return {
    status: canRetry ? "retry" : "fail",
    canRetry,
    nextCycle: canRetry ? cycle + 1 : null,
    blockers,
    missingGates: [],
    consideredGates,
  }
}

export default tool({
  description:
    "Track loop state across d/i/f cycles with init, record, evaluate, and finalize actions",
  args: {
    action: tool.schema
      .enum(["init", "record", "evaluate", "finalize"])
      .describe("loop-state action"),
    loopType: tool.schema.enum(LOOP_TYPES).optional().describe("Loop type: d, i, or f"),
    slug: tool.schema.string().min(1).optional().describe("Task slug for init action"),
    maxCount: tool.schema
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Max cycle count for init action"),
    runId: tool.schema.string().min(1).optional().describe("Run ID returned by init"),
    cycle: tool.schema
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Zero-based cycle number for record/evaluate"),
    gate: tool.schema.string().min(1).optional().describe("Gate name for record (review/test/etc)"),
    verdict: tool.schema
      .enum(VERDICTS)
      .optional()
      .describe("Gate verdict for record: pass, fail, partial"),
    blockers: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Blockers for fail/partial verdicts"),
    artifactPath: tool.schema
      .string()
      .min(1)
      .optional()
      .describe("Optional handoff path for the recorded verdict"),
    requiredGates: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Required gates for evaluate action"),
    outcome: tool.schema
      .enum(OUTCOMES)
      .optional()
      .describe("Final loop outcome for finalize action"),
    reason: tool.schema.string().optional().describe("Optional finalization reason"),
  },
  async execute(args, context) {
    if (args.action === "init") {
      const loopType = requireActionField(args.loopType, "init", "loopType")
      const slug = normalizeToken(requireActionField(args.slug, "init", "slug"), "slug")
      const maxCount = requireActionField(args.maxCount, "init", "maxCount")

      ensureLoopOwner(loopType, context.agent)

      const runId = normalizeToken(`${loopType}-${slug}-${Date.now()}`, "runId")
      const timestamp = nowISO()
      const state: LoopState = {
        version: 1,
        runId,
        slug,
        loopType,
        owner: ownerForLoop(loopType),
        maxCount,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
        cycles: [],
      }

      const filePath = await writeState(context.sessionID, state)
      const result = {
        action: "init",
        runId,
        loopType,
        owner: state.owner,
        slug,
        maxCount,
        currentCycle: 0,
        status: state.status,
        path: filePath,
      }

      context.metadata({
        title: `loop-state:init ${runId}`,
        metadata: result,
      })

      return JSON.stringify(result, null, 2)
    }

    const runId = normalizeToken(requireActionField(args.runId, args.action, "runId"), "runId")
    const { state, filePath } = await readState(context.sessionID, runId)
    ensureStateOwner(state, context.agent)

    if (args.action === "record") {
      ensureActive(state, "record")

      const cycle = requireActionField(args.cycle, "record", "cycle")
      if (cycle < 0 || cycle >= state.maxCount) {
        throw new Error(`cycle '${cycle}' is out of range for maxCount '${state.maxCount}'`)
      }

      const gate = oneLine(requireActionField(args.gate, "record", "gate"))
      if (!gate) {
        throw new Error("record action requires a non-empty gate")
      }

      const verdict = requireActionField(args.verdict, "record", "verdict")
      const blockers = uniqueStrings(args.blockers ?? [])
      const artifactPath = args.artifactPath ? oneLine(args.artifactPath) : undefined

      const cycleState = upsertCycle(state, cycle)
      cycleState.records.push({
        gate,
        verdict,
        blockers,
        artifactPath,
        recordedAt: nowISO(),
      })

      state.updatedAt = nowISO()
      await writeState(context.sessionID, state)

      const result = {
        action: "record",
        runId,
        loopType: state.loopType,
        cycle,
        gate,
        verdict,
        blockers,
        artifactPath,
        recordCountForCycle: cycleState.records.length,
        path: filePath,
      }

      context.metadata({
        title: `loop-state:record ${runId} c${cycle}`,
        metadata: result,
      })

      return JSON.stringify(result, null, 2)
    }

    if (args.action === "evaluate") {
      ensureActive(state, "evaluate")
      const cycle = requireActionField(args.cycle, "evaluate", "cycle")
      const requiredGates = uniqueStrings(args.requiredGates ?? [])
      const evaluation = evaluateCycle(state, cycle, requiredGates)

      const result = {
        action: "evaluate",
        runId,
        loopType: state.loopType,
        cycle,
        maxCount: state.maxCount,
        ...evaluation,
        path: filePath,
      }

      context.metadata({
        title: `loop-state:evaluate ${runId} c${cycle}`,
        metadata: result,
      })

      return JSON.stringify(result, null, 2)
    }

    if (args.action === "finalize") {
      const outcome = requireActionField(args.outcome, "finalize", "outcome")

      if (state.status !== "active") {
        const existingOutcome = state.status === "passed" ? "pass" : "fail"
        if (existingOutcome !== outcome) {
          throw new Error(
            `loop-state run '${runId}' already finalized as '${existingOutcome}', cannot finalize as '${outcome}'`,
          )
        }
      } else {
        state.status = outcome === "pass" ? "passed" : "failed"
        state.finalizedAt = nowISO()
        state.finalReason = args.reason ? oneLine(args.reason) : undefined
        state.updatedAt = nowISO()
        await writeState(context.sessionID, state)
      }

      const records = state.cycles.reduce((total, cycleState) => total + cycleState.records.length, 0)
      const result = {
        action: "finalize",
        runId,
        loopType: state.loopType,
        status: state.status,
        outcome,
        maxCount: state.maxCount,
        cyclesTouched: uniqueStrings(state.cycles.map((entry) => `${entry.cycle}`)).length,
        records,
        finalizedAt: state.finalizedAt,
        finalReason: state.finalReason,
        path: filePath,
      }

      context.metadata({
        title: `loop-state:finalize ${runId}`,
        metadata: result,
      })

      return JSON.stringify(result, null, 2)
    }

    throw new Error(`Unsupported action '${args.action}'`)
  },
})
