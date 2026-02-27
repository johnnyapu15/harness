---
description: Plan large multi-stream work
agent: program-manager
---
Create a Program Brief for the current request.
Clarify goal, scope, out of scope, acceptance criteria, constraints, dependencies, and risks.
Decompose into streams with ownership, dependencies, and required gates.
Present a concise start plan and ask for one explicit approval for the whole program.
After approval, persist the Program Brief, then run PM-session compaction-ready checkpointing and compact the PM context before execution dispatch.
Do not dispatch Orchestrator execution until approval is granted.
When approved, ensure Task Brief artifacts include `Approval: granted` and `approval: granted`.
Do not request per-stream or per-cycle approval unless plan/scope/risks materially change.
