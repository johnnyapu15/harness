---
description: Plan large multi-stream work
agent: program-manager
---
Create a Program Brief for the current request.
Clarify goal, scope, out of scope, acceptance criteria, constraints, dependencies, and risks.
Choose execution mode first:
- Fast path: simple low-risk single-stream work -> persist a Task Brief and dispatch General directly (skip Orchestrator).
- Program path: multi-stream or higher-risk work -> decompose streams and continue with Orchestrator.
For program path, present a concise start plan and ask for one explicit approval for the whole program.
After approval, persist the Program Brief, then run PM-session compaction-ready checkpointing and compact the PM context before execution dispatch.
Do not dispatch Orchestrator execution until approval is granted.
For fast path, user request may be treated as implicit approval when risk is low and ambiguity is resolved.
When approved (explicit or implicit), ensure Task Brief artifacts include `Approval: granted` and `approval: granted`.
Do not request per-stream or per-cycle approval unless plan/scope/risks materially change.
