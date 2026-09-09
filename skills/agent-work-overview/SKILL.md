---
name: agent-work-overview
description: Inspect live agent sessions, worktrees, and handoffs before choosing or duplicating work.
---

# Agent Work Overview

## Overview

Use this skill to get a quick, secret-safe map of local agent work before deciding what to pick up next. It checks live Codex or Claude Code processes, Codex worktrees, recent Codex session metadata, recent Claude Code session files, finished agent logs, and tmux job containers.

## Quick Start

Run:

```bash
python3 ~/.codex/skills/agent-work-overview/scripts/overview.py
```

Useful options:

```bash
python3 ~/.codex/skills/agent-work-overview/scripts/overview.py --limit 20
python3 ~/.codex/skills/agent-work-overview/scripts/overview.py --json
python3 ~/.codex/skills/agent-work-overview/scripts/overview.py --codex-home ~/.codex --claude-home ~/.claude
```

## Workflow

1. Run the overview command before opening new issue, PR, or continuation work.
2. Read the sections in this order: live processes, dirty or recent worktrees, recent sessions, finished logs.
3. If a process, session, or dirty worktree overlaps the intended task, inspect that existing work before starting a duplicate path.
4. Summarize only the relevant conflicts or handoff clues for the user.

## Next-slice Pairing

When using this with `next-slice`, run this skill first, before `next-slice` gathers GitHub context. Use the overview to answer:

- Is another Codex or Claude Code instance already working in this repo?
- Is there a dirty worktree or recent session for the same issue?
- Is there a finished agent log that should be read before selecting the next PR scope?

Then continue with the normal `next-slice` workflow.

## Safety

- Do not dump raw session JSONL or environment files into the conversation unless the user explicitly asks.
- Treat command lines as sensitive; the script redacts common token, key, secret, password, cookie, and credential forms.
- Prefer summarizing session metadata such as cwd, timestamp, originator, and file path before reading conversation bodies.
- Do not resolve conflicts by deleting worktrees or killing processes unless the user explicitly asks.
