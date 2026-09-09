---
description: Validate scripts, tests, docs, and release readiness
---

Run a release-readiness pass for this repository:

1. Run relevant syntax checks, tests, and compatibility checks.
2. Verify docs/changelog updates for behavior or breaking-path changes.
3. Report pass/fail with exact failing commands.
4. If all checks pass, provide a concise changelog-style summary.

> Releases must go through `./skills/github-ops/scripts/commit-push.sh` (see the
> `github-ops` skill); never run raw `git commit`/`git push`. Mirrors the Codex
> `/prompts:pre-release-check`.
