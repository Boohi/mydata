# GitHub Project Management Policy

We use GitHub Issues, milestones, labels, and a project board as the canonical executable work tracker. This doc explains how.

## Issue lifecycle

1. **Created** with a slice/bug/chore template, labels, and a milestone.
2. **Triaged** to a priority (`priority:p1` / `p2` / `p3`) and assigned to a milestone.
3. **Picked** via the `next-slice` skill or manually. The PR references the issue with `Closes #N`.
4. **Implemented** in a PR scoped to that one issue.
5. **Closed** by merging the PR.

## Labels

Declarative source: `.github/labels.json`. Applied by `scripts/setup-labels.sh`.

- `type:slice` — a shippable vertical slice of behavior (the main type).
- `type:bug` — defect.
- `type:chore` — internal work with no user-visible behavior change.
- `type:docs` — docs-only change.
- `priority:p1` / `p2` / `p3`.
- `area:extension` / `area:daemon` / `area:ui` / `area:packaging` / `area:docs` / `area:ci`.
- `blocked` — cannot proceed until another issue closes.
- `good-first-issue` — newcomer-friendly.
- `risk:privacy` — touches privacy-promise surface; needs extra review.
- `risk:signing` — touches code-signing or notarization.

## Milestones

- `v0.1` — the launch milestone. Everything in §9 of the design spec.
- `post-v0.1` — backlog visible from day one; nothing here blocks v0.1.

## Project board

Single board with columns: Backlog, Ready, In Progress, In Review, Done. Issues move automatically via GitHub Actions where possible.

## Slice issues

Each slice issue body follows this structure:

- **Goal** (one sentence).
- **Why** (link to spec section or doc that explains motivation).
- **Scope** (bulleted list of what is in, what is out).
- **Dependencies** (other issues that must close first).
- **Acceptance criteria** (checklist that is true when the issue is done).
- **Notes** (anything non-obvious).
