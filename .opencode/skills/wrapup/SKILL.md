---
name: wrapup
description: Finish a session with verification, GitHub sync, cleanup, follow-ups, and a resumable handoff.
---

# Wrapup

Make substantial work recoverable without chat history. Never discard changes
merely to report a clean end.

## Workflow

1. **Capture final state.** Record branch, HEAD, status, worktrees, PR/issues,
   checks, blockers, and relevant live processes. Collect all background agents;
   stop or document any sidecar that still owns work.
2. **Inspect and classify.** Review diffs, staged changes, and untracked files.
   Separate task-owned source/docs/tests/config from unrelated or ambiguous
   work, generated outputs, caches, logs, `.env` files, credentials, private
   data, and machine-local state. Preserve excluded files and report why.
3. **Verify and checkpoint.** Run meaningful checks. Never push WIP directly to
   the default branch; create a checkpoint branch. Use the canonical helper
   only after classification:

   ```bash
   ./skills/github-ops/scripts/commit-push.sh --no-version "chore: wrapup checkpoint"
   ```

   Use `--staged-only --no-version` for a reviewed task-owned set when unrelated
   changes coexist. Never publish secrets.
4. **Make GitHub durable.** Create or update a draft PR for incomplete work and
   record current state, exact checks, blockers, and the next action. Prefer an
   existing issue/PR over a duplicate.
5. **Sync follow-ups.** Use `issue-sync` for concrete unfinished work: search
   first, update matches, and keep broad sweeps behind a parent issue or capped
   backlog. Link every new issue to its branch, commit, PR, or parent.
6. **Make a memory decision.** Use `continuous-memory` to capture a reusable
   private observation, leave an unconfirmed candidate, explicitly review a
   portable memory, or record why no memory was warranted.
   Automation never stages or commits memory state.
7. **Prove the handoff.** Recheck branch/status and run `completion-gate`.
   Report `COMPLETE`, `PARTIAL`, or `BLOCKED` truthfully.

## Resumable Handoff

A durable PR comment, body, or issue contains:

- branch, latest commit, and PR/issue links;
- what changed and what remains local;
- `PASS`/`FAIL`/`NOT RUN` verification with commands;
- blockers and user-owned gates;
- numbered resume steps beginning with the exact next action.

Keep the final chat response short and point to that artifact.
For cross-session or cross-client continuity, use the
[handoff reference](references/handoff.md) to preserve ownership and source links.

## Cleanup Safety

Use `housekeeping` for branch/worktree cleanup. Remove a temporary worktree only
when it is clean, pushed or otherwise recoverable, no process needs it, and the
target is confirmed disposable. Use `git worktree remove`, never `rm -rf`.
Never reset, force-push, delete ambiguous work, or clean the main checkout to
make wrapup appear complete.

If GitHub is unavailable, preserve a local checkpoint and handoff, then name
exactly what still needs synchronization.
