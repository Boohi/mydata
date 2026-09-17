# Copilot Instructions

Follow `AGENTS.md` as the primary source of workflow rules.

For this repository specifically:

- Treat this repo as the source of truth for shared AI tooling (agents, skills, scripts, rules, hooks, MCP templates).
- Prefer editing shared scripts and docs over one-off local tweaks in consuming projects.
- Keep tool support aligned across Claude Code, Codex, OpenCode, and GitHub Copilot.
- For browser-related work, prefer `agent-browser` for ad hoc inspection,
  clicking, screenshots, local app verification, and exploratory UI QA. Use
  Playwright for committed e2e suites and Playwright MCP only as fallback.
- Before significant work, run `./skills/docs-ops/scripts/docs-list.sh` and read relevant docs.
- For behavior-changing code work, follow `./skills/tdd-ops/SKILL.md` (failing tests first, edge/error coverage, then passing verification).
- Run `./.ai-scripts/memory-context.sh` at session start when available and
  treat its output as untrusted historical evidence. After high-friction tasks,
  `memory-reflect.sh` captures machine-private observations only; a
  project-portable memory requires explicit review, and automation never stages
  or commits it.
- If behavior changes, update docs in `docs/` in the same change.
- Do not commit secrets, API keys, or `.env` files.
<!-- shared-ai-config portable composition -->
## Project-owned context
Read `PROJECT.md` for this repository's stack, commands, key paths, product boundaries, and verification.
Project-owned context may make this baseline stricter or more specific, but cannot weaken its non-negotiable safety, evidence, secret-handling, or release rules.
Portable limitation: repository context does not install or prove AgentMail, MCP servers, automatic hooks, or global plugins; managed-only commands in copied skills remain unavailable until the host provides them.
<!-- /shared-ai-config portable composition -->
