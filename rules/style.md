# Code Style Rules

- Match the nearest repository conventions, formatter, linter, and language
  configuration.
- Keep diffs minimal and focused; do not refactor unrelated code.
- Prefer simple, readable names and structures over speculative abstraction.
- Preserve public contracts unless the task explicitly changes them.
- Colocate code and tests according to existing patterns.
- Comment non-obvious intent, constraints, or workarounds; remove stale and
  commented-out code.
- Follow the routed TDD workflow for behavior changes and run canonical
  formatting/lint checks before completion.
- Write tool-agnostic instructions that describe the desired outcome.
