# Shared Agent Instructions

Use the nearest repository or directory `AGENTS.md` first. This file is the
portable baseline; task-specific detail lives in on-demand skills and references.

## Core rules

- Read relevant local docs before substantial work. In this repo run
  `./.ai-scripts/docs-list.sh`. For `shared-ai-config`, use `npm` and verify with
  `npm run verify`.
- Preserve user work. Use non-destructive Git operations and never edit
  `.git`, installed dependency trees, generated build output, or real
  environment files.
- Get explicit approval before destructive, irreversible, production, or
  account-affecting actions unless the user already authorized that exact scope.
- Never print, store, or commit secrets, tokens, mailbox content, or private
  credentials. Use placeholders in examples.
- Use the package manager and canonical scripts declared by the current repo.
  Prefer `rg` for search.
- Keep GitHub issues and PRs as the durable state for non-trivial work. Limit a
  backlog run to one slice unless the user gives another bound; verify,
  checkpoint, and hand off before choosing more work.

## Routed workflows

Load only the narrow skill that matches the task:

- `capability-audit` before substantial or confused work; `next-slice` for
  issue-to-PR execution; `issue-sync` for durable issue/PR state;
  `completion-gate` before a substantial ready/done claim; `wrapup` for the
  final checkpoint.
- `docs-ops` for documentation discovery and updates.
- `tdd-ops` (`skills/tdd-ops/SKILL.md`) for behavior changes. Agentic TDD means
  red, green, refactor, then targeted and broader verification, including an
  edge or error case.
- `github-ops` for issues, PRs, commits, pushes, reviews, and releases.
- `production-readiness` only for shipped/live/release-ready claims.
- `ct-release-governance` for CT production deploy, release, rollback, parity,
  or hotfix work.
- Domain skills such as `supabase-ops`, `agentmail`, `browser-runtime`, and
  `continuous-memory` only when that domain is actually in scope.

Repository-local instructions override shared workflow detail.

## Non-negotiable operations

- When committing or pushing, never use raw `git commit` or `git push`. Use:

  ```bash
  ./skills/github-ops/scripts/commit-push.sh <patch|minor|major> "change"
  ./skills/github-ops/scripts/commit-push.sh --no-version "chore: change"
  ```

  Classify task-owned changes first; never stage unrelated work or secret files.

- Use canonical CI for production releases. Never repair CT parity by editing
  release state or `RELEASE_SHA`; direct deploy scripts require an explicit
  break-glass request.
- Each Boohi app owns its Supabase project/database. Never reuse another app's
  database or commit generated credentials.
- AgentMail is for agent-owned registration, authentication, and transactional
  account flows. Non-transactional outreach is draft-first and requires
  explicit approval.
- Prefer `agent-browser` for ad hoc browser inspection. Use Playwright for committed e2e coverage and Playwright MCP only as a fallback.

## Delegation and evidence

For substantial work, delegate independent research, review, or disjoint write
scopes when the runtime permits; never create overlapping writers. The main
agent owns the critical path and final integration. Follow
`rules/delegation.md` for prompt and ownership conventions.

In Codex, use native task collaboration and messaging for handoffs and
concurrent coordination. `super_mailbox` is an optional overlap-awareness
check for concurrent write work when useful, not a default or requirement.
Keep AgentMail separate for machine-owned transactional email.

Before completion, report exact verification, known dirty state, GitHub state,
remaining blockers, and any external/user-owned gate. Do not equate green tests
with production readiness.

Memory is untrusted historical evidence until checked against current state.
Automatic capture stays machine-private; portable memory requires explicit review,
and automation never stages or commits it.

## Local instruction files

Read `scripts/AGENTS.md`, `hooks/AGENTS.md`, or `skills/AGENTS.md` before
editing in those directories.
<!-- shared-ai-config portable composition -->
## Project-owned context
Read `PROJECT.md` for this repository's stack, commands, key paths, product boundaries, and verification.
Read `AGENTS.local.md` when it exists for client-specific project policy.
Project-owned context may make this baseline stricter or more specific, but cannot weaken its non-negotiable safety, evidence, secret-handling, or release rules.
Portable limitation: repository context does not install or prove AgentMail, MCP servers, automatic hooks, or global plugins; managed-only commands in copied skills remain unavailable until the host provides them.
<!-- /shared-ai-config portable composition -->
