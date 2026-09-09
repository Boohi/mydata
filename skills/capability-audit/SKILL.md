---
name: capability-audit
description: Verify instructions, capabilities, active work, GitHub access, and dirty state before substantial work.
---

# Capability Audit

Run this as a short preflight before `next-slice`, major implementation, or any
claim that a tool or account is unavailable. Its job is to replace guesses with
current local evidence.

## Checks

1. Read local instructions: nearest `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.agents/`,
   `.claude/`, and repo workflow docs that affect the task.
2. Verify shared skills are reachable: `skills/next-slice/SKILL.md`,
   `skills/wrapup/SKILL.md`, `skills/github-ops/SKILL.md`, and any task-specific
   skill named by the user or repo.
3. Inspect active or recent agent work before duplicating effort. If this audit
   runs from `next-slice`, this check happens before GitHub issue/PR reads:

   ```bash
   python3 skills/agent-work-overview/scripts/overview.py --limit 8
   ```

4. Confirm GitHub capability from the machine, not memory:

   ```bash
   gh auth status
   gh repo view --json nameWithOwner,url
   ```

5. Capture repo state:

   ```bash
   git status --short --branch
   git worktree list --porcelain
   gh pr status
   gh issue list --state open --limit 20
   ```

6. Load memory context when available:

   ```bash
   ./.ai-scripts/memory-context.sh
   ```

7. Check task-specific tools or plugins only when relevant: deployment CLIs,
   database CLIs, browser automation, simulator tooling, or MCP connectors.

## Output

Report only the facts that change execution:

- `ready`: required capabilities are available.
- `degraded`: work can continue, but name the missing capability and fallback.
- `blocked`: no safe fallback exists; create or update the GitHub issue with the
  exact blocker and command evidence.

Do not say GitHub, a plugin, a skill, or a credential is missing until a current
command or inspected file proves it. If evidence contradicts earlier chat
memory, the current evidence wins.
