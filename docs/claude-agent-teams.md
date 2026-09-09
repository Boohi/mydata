---
summary: Enable and operate Claude Agent Teams with shared quality gates and inherited-model delegation
read_when:
  - enabling Claude Agent Teams in shared config
  - updating teammate delegation policy
  - adding TaskCompleted or TeammateIdle hooks
status: current
updated: 2026-02-07
---

# Claude Agent Teams

## Purpose

Use Agent Teams as the default orchestration pattern for substantial Claude Code tasks.

## Enablement

Agent Teams are experimental and should be explicitly enabled in `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "teammateMode": "auto"
  }
}
```

## Team Pattern

- Planner teammate: decomposition and sequencing.
- QA teammate (for behavior changes): write failing tests first with edge coverage.
- Implementer teammate: primary code changes.
- Reviewer teammate: validation and regression checks.

Use only the minimum teammates required for the task.

## Hook Integration

Keep these hooks configured:

- `TaskCompleted`: run quality gates on teammate output.
- `TeammateIdle`: catch stuck/invalid intermediate states.

Use `exit 2` to block progression when quality gates fail.

## Prompt Standard

Teammate task prompts should include:

1. Scope boundary
2. Deliverable format
3. Acceptance criteria
4. Verification commands
5. TDD evidence requirements (failing test signal and passing rerun)

## Model Policy

Teammates should inherit the parent model unless the user explicitly asks for overrides.
