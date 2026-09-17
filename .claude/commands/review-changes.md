---
description: Run a risk-first code review of current changes
---

Review the current diff with a bug-focused mindset:

1. Prioritize correctness, security, regressions, and missing tests.
2. List findings ordered by severity with file paths and line numbers.
3. Call out assumptions/questions separately from findings.
4. Keep summaries brief; findings first.

> For a deeper pass, use the built-in `/code-review` (append `ultra` for a
> multi-agent cloud review) or the `pr-review-toolkit` agents. Mirrors the
> Codex `/prompts:review-changes`.
