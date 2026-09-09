---
name: next-slice
description: Continue one bounded GitHub issue or PR through implementation, verification, review, and merge.
---

# Next Slice

Use GitHub as durable state. Run one user-specified or highest-priority eligible
slice unless the user gives another bound. Nearest repository instructions and
local workflow docs override this shared fallback.

## Preflight

Inspect active work before GitHub triage:

```bash
python3 skills/agent-work-overview/scripts/overview.py --limit 8
```

Use the installed path if shared skills are not linked. If a live session,
worktree, or PR overlaps the intended issue, coordinate with it instead of
starting a duplicate.

After `agent-work-overview`, run `capability-audit`. Read relevant docs,
repository instructions, issue/PR templates, memory context, and current
worktree state. Confirm capabilities from live evidence rather than old chat.

Gather a compact snapshot:

```bash
bash skills/next-slice/scripts/github-context.sh
```

If unavailable, inspect open issues/PRs and `git status` with the repo’s normal
tools.

## Workflow

1. Select the requested issue, or the next unblocked issue by milestone,
   priority, and dependency order. Read its full body and comments.
2. Extract acceptance criteria and define the smallest demonstrable slice,
   non-goals, ownership boundaries, and exact verification. For ticket breakdown,
   uncertain scope, or dependency graphs, read [slice planning](references/slice-planning.md).
3. Reuse an existing branch/PR when appropriate; otherwise create a focused
   branch from current authoritative main. Open a draft PR after the first
   meaningful checkpoint when the repo supports it.
4. For behavior changes, use `tdd-ops`. Keep edits minimal and delegate only
   independent read-only or disjoint scopes.
5. Verify targeted behavior, then relevant broader checks. Update docs when
   behavior or operations changed.
6. Keep the issue and PR synchronized with material decisions, evidence, and
   blockers. Use `issue-sync` for unfinished follow-ups.
7. Pin the actual PR base and current head, then run independent standards and
   specification reviews using [review](references/review.md). Include relevant
   security, operations, and runtime evidence. Resolve material concerns and
   rerun affected checks.
8. Run `completion-gate` before ready/merge claims. Use
   `production-readiness` only when claiming shipped, live, deployable, or
   release-ready.
9. Merge only when required checks are green and no material review concern
   remains. Finish through `wrapup`.

## Autonomy and stops

- Do not ask for confirmation when scope and authority are already defined.
- Prefer the lower-risk reversible choice and record material decisions.
- Use `superify` only for an explicit invocation; ordinary task planning uses
  the existing issue/PR and creates no goal or second planning authority.
- Do not duplicate active work or create overlapping writers.
- Stop for a hard authority, safety, or external-state blocker; record it in
  the issue or PR with the smallest next action.
- A slice is complete only when verified, committed, pushed, and represented by
  a PR or an explicit durable blocker.

Report the issue/PR, changed scope, exact verification, merge state, dirty
state, and true blockers.
