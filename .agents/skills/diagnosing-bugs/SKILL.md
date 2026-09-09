---
name: diagnosing-bugs
description: Diagnose an unexplained bug or regression with an exact reproduction, falsifiable probes, and runtime evidence.
---

# Diagnosing Bugs

Use for unexplained failures, flakes, or performance regressions.
Use `tdd-ops` for understood changes and `codebase-triage` for broad audits.

1. Read the contract and current evidence. Run one command detecting the user's
   exact symptom. Use [feedback loops](references/feedback-loop.md) to select or
   tighten the reproduction, including flaky or inaccessible systems.
2. Minimize inputs and dependencies while preserving that failure. Record the
   command, expected result, and observed result with secrets removed.
3. Rank falsifiable causes and observations distinguishing them. Probe one
   variable at a time; share the working hypothesis and continue within scope.
4. Use `tdd-ops` to turn the reproduction into a failing regression at a suitable
   interface, apply the supported fix, and verify the error case.
5. Rerun the original scenario, remove task-owned instrumentation, and record the
   cause and exact verification in the existing issue/PR through `issue-sync`.

If evidence is unavailable, record attempted checks, the missing capability, and
the next command/artifact. Continue independent investigation with causes labelled
as hypotheses. Compilation or an unrelated failure cannot prove this bug fixed.

Verify with the repository reproduction/test command. Distinguish a diagnosis
finding from a verified fix.
