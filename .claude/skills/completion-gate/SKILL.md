---
name: completion-gate
description: Verify scope, tests, GitHub, dirty state, and blockers before a substantial completion claim.
---

# Completion Gate

Use this before substantial code, config, docs, workflow, issue, PR, deployment,
or multi-agent work is claimed finished. This includes PR-ready claims,
issue-closing comments, and handoffs that imply the task is done. The gate
prevents "demo at best" closures by requiring evidence and an honest status.

Skip this for simple read-only answers, small status reports, or routine
questions where no repo, GitHub, deployment, memory, or background-agent state
was changed.

## Required Evidence

1. **Scope matched**: map the latest user request and linked GitHub issue or PR
   acceptance criteria to what changed. If a request changed mid-session, the
   newest request wins.
2. **Verification run**: list exact commands, browser checks, smoke tests,
   screenshots, CI status, or manual checks. If something was not run, say
   `NOT RUN` with the concrete reason.
3. **GitHub synced**: relevant issue, PR body, PR comment, branch, or follow-up
   issue reflects the real state. Use `issue-sync` for unfinished work.
4. **Dirty state known**: run `git status --short --branch`; either the worktree
   is clean or every dirty/untracked file is classified as committed, ignored,
   unsafe, unrelated, or intentionally left.
5. **Production claim checked**: before saying shipped, live, released,
   deployed, or production-ready, run `production-readiness`. If not applicable,
   state that production readiness was not evaluated.
6. **Memory decision made**: capture a machine-private observation/candidate,
   explicitly review an evidenced project-portable memory, or record a skip
   reason. Completion automation never stages or commits memory.
7. **Agents collected**: wait for, summarize, or close background agents whose
   output could affect the final answer.
8. **Blockers named**: if any blocker remains, do not use done/fixed/ready
   language. Name the blocker and the next durable artifact to resume from.

## Status Labels

- `COMPLETE`: scope satisfied, verification passed, GitHub is synced, dirty state
  is understood, and no known blocker remains.
- `PARTIAL`: useful work landed, but acceptance criteria, verification, deploy,
  review, or cleanup remains. Link the follow-up issue or PR.
- `BLOCKED`: progress cannot continue safely without user input or an external
  state change. Record the blocker in GitHub before ending.

## Final Response Shape

Use concise evidence, not optimism:

```markdown
Status: COMPLETE | PARTIAL | BLOCKED
Changed:
Verification:
GitHub:
Remaining dirty state:
Memory:
Blockers:
```

Never call work done, fixed, ready, shipped, or production-ready unless the
matching label and evidence support that exact claim.
