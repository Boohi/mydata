# Documentation front matter

Use `summary` for a one-line description and `read_when` for real task conditions:

```yaml
---
summary: Export recovery cursor semantics and failure handling
read_when:
  - changing export cursor persistence
  - investigating interrupted export recovery
status: current
updated: 2026-09-09
---
```

`summary` is required for useful discovery. `read_when`, `status` (draft, current,
deprecated), and `updated` are optional. Keep the dates and status accurate.

To add seed front matter to files that lack it:

```bash
./skills/docs-ops/scripts/add-frontmatter.sh --dry-run [docs-dir]
./skills/docs-ops/scripts/add-frontmatter.sh [docs-dir]
./skills/docs-ops/scripts/docs-list.sh [docs-dir]
```

The helper derives a starting summary from the first heading or filename; review
it and supply meaningful task-specific triggers. Inspect its dry run before
applying changes to existing documentation. Use the repository link/format check
after editing.
