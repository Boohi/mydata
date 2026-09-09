# Documentation Workflow

Load `docs-ops` when discovering or changing documentation. Prefer the
repository's canonical docs-list command and read only documents relevant to
the task.

## Authoring

- Update behavior documentation in the same change as the behavior.
- Follow the repository's existing structure; do not create boilerplate docs for
  absent subsystems.
- Keep each document focused and mark obsolete guidance deprecated or remove it
  when safe.
- Use placeholders in examples and never include credentials or private data.

## Discovery metadata

When the repository uses docs discovery, add concise front matter:

```yaml
---
summary: What this document covers
read_when:
  - when this guidance is relevant
---
```
