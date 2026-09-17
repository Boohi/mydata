# Claude Agent Teams Rule

In Claude Code, use enabled Agent Teams for substantial work with genuinely
separate concerns. Follow `rules/delegation.md` for shared ownership rules.

## Team shape

- Parallelize independent research, review, or disjoint write scopes.
- Serialize work when one result gates another or files overlap.
- Use only the roles needed. For behavior changes, a useful sequence is
  planner -> qa-engineer (red) -> implementer (green) -> reviewer.
- Keep the parent agent responsible for integration and final verification.

## Quality floor

- Prompts name scope, exclusions, deliverable, acceptance criteria, and checks.
- Teammates inherit the parent model unless the user requests otherwise.
- Keep `TaskCompleted` and `TeammateIdle` quality hooks enabled.
- Do not complete behavior-changing work without tests or a concrete no-test
  reason; reject conflict markers and syntax-invalid edits.

Enablement and hook configuration live in `docs/claude-agent-teams.md`.
