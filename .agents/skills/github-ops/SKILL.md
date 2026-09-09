---
name: github-ops
description: Manage GitHub issues, PRs, reviews, commits, pushes, merges, and releases.
trigger:
  - commit
  - push
  - "commit and push"
  - "push and commit"
  - "commit all"
  - "push all"
  - release
  - "ship it"
metadata:
  emoji: "🐙"
  requires:
    bins: ["gh"]
---

# GitHub Operations

Use `gh` plus repository helpers. Follow local instructions and release rules.

## Commit And Push

This skill is mandatory for commits in repositories that provide it. Do not use
raw `git commit` or `git push`; use:

```bash
./skills/github-ops/scripts/commit-push.sh <patch|minor|major> "change"
./skills/github-ops/scripts/commit-push.sh --no-version "chore: message"
```

Before invoking either form:

1. Inspect status, diffs, staged changes, and untracked files.
2. Classify every path as task-owned and publishable, unrelated/ambiguous,
   generated/disposable, or secret-sensitive.
3. Run relevant checks. Preserve unrelated work; never stage credentials,
   `.env` files, private data, logs, caches, or machine-local state.

The default helper stages the worktree; use it only when every dirty path is
safe. Otherwise stage only reviewed task-owned files and use:

```bash
./skills/github-ops/scripts/commit-push.sh --staged-only --no-version "chore: reviewed files"
```

Use a version bump only when the change warrants a release entry. Changelog
fragments are automatic. Retry a failed post-commit push without another commit:

```bash
./skills/github-ops/scripts/commit-push.sh --push-only
```

## Read Issues And PRs

Use the field-pinned wrappers so changing GitHub fields and legacy project
warnings do not corrupt inspection output:

```bash
./skills/github-ops/scripts/issue-view.sh <number> [owner/repo]
./skills/github-ops/scripts/pr-view.sh <number> [owner/repo]
gh pr diff <number>
```

Do not append `2>&1` to wrapper reads. For diff statistics use
`gh pr diff <number> | diffstat`, not the unsupported `gh pr diff --stat`.

## Durable Workflow

- Search existing issues and PRs before creating duplicates; use `issue-sync`
  when available.
- Create a draft PR for incomplete work or missing checks. A ready PR needs a
  factual summary, verification, linked issue, and current base.
- Review the diff and checks before approval or merge. Do not merge drafts,
  conflicts, failing checks, or material unresolved review concerns.
- Prefer the repository's established merge strategy; do not force, rewrite
  history, or delete branches without authority.
- Keep secrets and raw private logs out of bodies, comments, and releases.
- For releases, use the canonical release-governance workflow when one exists;
  do not substitute an ad hoc `gh release create`.

Useful helpers:

```bash
./skills/github-ops/scripts/issue-list.sh
./skills/github-ops/scripts/pr-create.sh "Title" "Body"
./skills/github-ops/scripts/pr-review.sh <number>
./skills/github-ops/scripts/release-create.sh <tag>
```

If access fails, preserve the branch and a resumable local handoff, then report
the exact unsynced state.
