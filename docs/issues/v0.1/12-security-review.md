---
title: "Security & privacy review before launch"
labels: ["type:slice", "priority:p1", "area:docs", "risk:privacy", "risk:signing"]
milestone: "v0.1"
---

## Goal

End-to-end review of the privacy promise, signing/notarization integrity, and security disclosure flow before tagging v0.1.

## Why

This is a privacy tool. A v0.1 with a leak destroys the brand forever.

## Scope

In:
- Run `security-review` skill against the full diff from main..v0.1.
- Re-run privacy paranoia test on every shipped binary.
- Audit XPC message handlers for input validation.
- Audit SQLite write path for SQL injection (parameterized queries everywhere).
- Verify SECURITY.md disclosure email works and is monitored.
- Independent reviewer (or `Agent` with `code-reviewer` subagent) reads docs/privacy-promise.md vs the implementation.

Out:
- Third-party paid audit (post-v0.1, when funded).

## Dependencies

- #11 (everything else implemented).

## Acceptance criteria

- [ ] Security review report committed to `docs/security-reviews/v0.1.md`.
- [ ] All P0/P1 findings closed before tagging.
- [ ] Privacy paranoia test green on the release artifact.
