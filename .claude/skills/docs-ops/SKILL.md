---
name: docs-ops
description: Discover and maintain project docs, shared domain vocabulary, and consequential decision records.
metadata:
  emoji: "📚"
  requires:
    bins: ["bash", "find"]
---

# Documentation Operations

Use for documentation discovery, updates, terminology, and decision records.
Preserve existing authoritative documents and repository conventions.

1. Discover docs with `./skills/docs-ops/scripts/docs-list.sh [docs-dir]`
   (default `./docs`), or the project's `.ai-scripts/docs-list.sh`. Read matching
   `read_when` hints before editing.
2. Update existing docs when behavior changes. For terminology and architectural
   decisions, read [domain docs](references/domain-docs.md). For skills and agent
   instructions, read [writing for agents](references/writing-for-agents.md).
3. Give new docs concise `summary` and relevant `read_when` front matter.
   Link detailed references from the phase that needs them.
4. Verify discovery, links, and formatting with repository commands.
   Documentation-only changes need no runtime tests; executable skill behavior
   needs representative model evaluations.

Read [front matter](references/front-matter.md) for fields and the optional
`add-frontmatter.sh --dry-run` helper. Preserve user edits; avoid duplicating
facts already discoverable from package scripts or configuration.
