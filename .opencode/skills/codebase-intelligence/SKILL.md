---
name: codebase-intelligence
description: Use for explicit TypeScript or JavaScript structural analysis of dead code, dependencies, cycles, duplication, complexity, or architecture boundaries.
---

# Codebase Intelligence

Use this skill only for an explicit structural-analysis request, an existing
project script/config, or issue acceptance criteria that require project-wide
evidence. Do not run it after every edit.

## Route First

- Exact symbol, path, or text lookup: use `rg` and local language tooling.
- Semantic search across unfamiliar code: use the existing `smart-coding`
  capability when it is healthy.
- TypeScript/JavaScript dead code, unused exports/dependencies, cycles,
  duplication, complexity, or boundaries: consider Fallow CLI.
- Existing Knip project or Node 20 constraint: keep using Knip; do not add both
  analyzers by default.
- Syntax-aware multi-language search or codemod: consider ast-grep only when
  text search is demonstrably insufficient.
- Task orchestration, review ownership, and cross-session context: use the
  existing shared skills; do not add another service.

## Workflow

1. Read project instructions and inspect its package manager, Node version,
   scripts, lockfile, and existing analyzer config.
2. Prefer an already-pinned project script. For a one-off Fallow evaluation,
   read [the Fallow reference](references/fallow.md) before executing anything.
3. Start report-only: disable telemetry and cache, use structured output, and
   never run fixes, hook installation, initialization, paid runtime coverage,
   or MCP setup during a pilot.
4. Review findings against entry points, generated files, dynamic imports,
   reflection, and framework conventions. Label each finding confirmed,
   false-positive, or unresolved.
5. Delete or refactor only in a separate issue-backed change with tests.
6. Record the command, version, runtime, source-worktree cleanliness, and a
   bounded finding sample.

## Adoption Gate

Project adoption requires a focused issue, exact or lockfile-controlled version,
reviewed config, targeted tests, and a clean pilot. A CI gate or shared MCP
registration is a separate decision. Do not add Fallow to shared defaults,
fleet profiles, or every project from this skill.

Do not infer or integrate an unclear product name such as “Nipper” or
“UltraSight.” Identify the exact product and a concrete missing workflow first.
