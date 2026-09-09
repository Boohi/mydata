# Agent Delegation Rules

## Delegation By Task Structure

Choose delegation from task dependencies, not line count. Use a single agent for
narrow work; for substantial work, consider native background agents for
independent research, review, verification, or disjoint implementation.

## Ownership

- Parallel writers need explicit, disjoint file or subsystem ownership.
- Read-only agents may inspect overlapping areas.
- Serialize work when one result gates another, behavior overlaps, or safe write
  boundaries are unclear.
- Stop a writer when its scope meets existing user changes or another active
  lane. Never overwrite or absorb that work implicitly.
- The orchestrator owns the critical path, integration, final checks, and user
  report. Delegated work is not proof until reviewed or verified.

Useful role defaults: `coder` for implementation, `debugger` for diagnosis,
`frontend-designer` for UI, `qa-engineer` for tests, and `product-designer` for
flows. Use only roles that add a distinct result.

## Task prompt

Keep prompts tool-agnostic and include:

1. Objective.
2. In-scope and out-of-scope files or behavior.
3. Deliverable.
4. Acceptance criteria.
5. Verification commands.

Ask sidecars for conclusions, uncertainties, changed paths, and exact check
results—not raw files or long logs. On failure, report completed work and the
specific blocker.
