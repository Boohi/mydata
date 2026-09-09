# Git Workflow Rules

Preserve user work and inspect status/diffs before mutation.

## Branch Operations

- Use `git switch` to change branches; avoid `git checkout`, force switches,
  history rewrites, or restore operations that discard changes.
- Resolve exact targets before branch deletion, cleanup, or other destructive
  operations and obtain required approval.

## Committing Changes

- Load `github-ops`; never use raw `git commit` or `git push`.
- Stage only reviewed files owned by the current task. Never stage unrelated
  user changes, secret-bearing files, real `.env` files, installed dependency
  trees, or generated output merely because they are dirty.
- Prefer the wrapper's `--staged-only --no-version` mode for a reviewed subset.
  If required versioning would make the wrapper capture unrelated work, isolate
  the change or stop for coordination.
- Describe the committed scope accurately and verify the resulting status.

```bash
./skills/github-ops/scripts/commit-push.sh <patch|minor|major> "entry1" "entry2" ...
./skills/github-ops/scripts/commit-push.sh --staged-only --no-version "chore: reviewed change"
```
