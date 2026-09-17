---
mode: "agent"
description: "Audit and synchronize shared AI config support across tools"
tools:
  - "codebase"
  - "changes"
---

Audit this repository as a shared AI tooling source of truth.

Deliver:
1. A compatibility matrix for Claude Code, Codex, OpenCode, and GitHub Copilot.
2. Any gaps that prevent portable setup on a fresh machine/project.
3. Concrete file-level fixes with tests and docs updates.

Constraints:
- Keep changes minimal and reversible.
- Preserve existing workflows unless they are broken.
- Verify with script checks and tests.
