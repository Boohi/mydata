---
name: issue-sync
description: Create, update, deduplicate, link, or close durable GitHub follow-up issues.
---

# Issue Sync

Use GitHub issues as the durable backlog, but keep the backlog small, specific,
and linked to real evidence.

## Workflow

1. Find existing state before creating anything:

   ```bash
   gh issue list --state open --limit 100 --search "<keywords>"
   gh pr list --state open --limit 50
   ```

2. Reuse an existing issue when the title, affected repo, failing command, or
   acceptance criteria match. Add a status comment instead of duplicating.
3. Create a new issue only when it has:
   - concrete current evidence
   - affected repo, branch, PR, command, or file path
   - next step that a cold agent can run
   - acceptance criteria
   - parent issue, epic, milestone, or rationale when it belongs to a sweep
4. During audits, cap new issue creation. Prefer a parent issue with an action
   backlog when there are many leads. Do not flood more issues than can be
   reviewed or assigned.
5. Keep PRs and issues linked both ways. PR comments should mention follow-up
   issues; issue comments should mention the PR, branch, or commit that changed
   state.
6. If GitHub is unavailable, write ready-to-run issue bodies into the handoff
   and say GitHub sync is blocked by the exact command failure.

## Issue Body Template

```markdown
## Context
Linked parent issue/PR/session:

## Current evidence
-

## Next step
-

## Acceptance criteria
-

## Links
-
```

Avoid vague reminders. "Clean up workflow mess" is not an issue; "Add
completion-gate skill and require it from wrapup before done claims" is.
