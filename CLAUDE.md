# Claude Code Instructions

@AGENTS.md

Follow the nearest repository instructions. This file contains
only Claude-specific routing.

## Shared surfaces

- Agents: `agents/`
- On-demand skills: `skills/`
- Rules: `rules/`
- Hooks: `hooks/`
- Commands: `commands/`

Hooks discover docs, inject bounded untrusted memory, protect files, enforce
the commit wrapper, and run lightweight validation. Machine-private memory is
never committed; portable memory requires explicit review.

Use on-demand skills instead of expanding this file. Common routes are
`/github-ops`, `/tdd-ops`, `/agentmail`, `/browser-runtime`,
`/ct-release-governance`, and the relevant database or deployment skill.

Prefer CLI-backed skills: `gh`, `supabase`, `stripe`, and `agent-browser`.
Use Playwright for committed e2e suites; use MCP only when its stateful surface
is materially useful or a skill requires it. AgentMail authentication and
transactional account flows use the shared machine mailbox; outreach remains
draft-first and approval-gated.

For substantial independent work, Claude Agent Teams may use scoped planner,
implementer, QA, and reviewer roles. Follow `rules/claude-agent-teams.md`;
avoid overlapping writers and keep the parent responsible for integration.

Marketplace packaging lives in `.claude-plugin/`; shared settings live in
`.claude/settings.json`. Project-specific commands and exceptions belong in
the project’s nearest instruction file, not here.
<!-- shared-ai-config portable composition -->
## Project-owned context
Read `PROJECT.md` for this repository's stack, commands, key paths, product boundaries, and verification.
Read `CLAUDE.local.md` when it exists for client-specific project policy.
Project-owned context may make this baseline stricter or more specific, but cannot weaken its non-negotiable safety, evidence, secret-handling, or release rules.
Portable limitation: repository context does not install or prove AgentMail, MCP servers, automatic hooks, or global plugins; managed-only commands in copied skills remain unavailable until the host provides them.
<!-- /shared-ai-config portable composition -->
