---
name: tdd-ops
description: Apply red-green-refactor with edge-case coverage and verification evidence to behavior changes.
trigger:
  - tdd
  - test-driven
  - regression test
  - write tests first
  - red green refactor
metadata:
  emoji: "🧪"
---

# Agentic TDD Operations

Use for behavior changes; skip docs, formatting, and metadata with no runtime
effect. Use `diagnosing-bugs` first for an unexplained failure.

Choose the observable public interface from acceptance criteria and existing
tests, then proceed within authorized scope without separate seam approval.
Read [behavioral testing](references/behavioral-testing.md) for assertions,
test doubles, and interface design.

## Required Loop

1. **Red**: Write one behavioral test with an independent expected result.
   Run it and observe the requested failure.
2. **Green**: Implement the smallest coherent slice that makes it pass.
3. **Refactor**: Clean up code/tests while preserving behavior.
4. **Verify**: Run affected tests, including an edge or error case. Run broader
   checks near handoff and required risk gates before external actions.
   Repeat when relevant inputs or evidence change.

Repeat vertically for remaining behavior, learning from each working slice.

## Completion Contract

Report test files, observed red/green commands and results, edge coverage, and
broader verification. Add runtime/browser/device/provider proof when applicable.

Name the missing interface/runtime and next evidence step if the test cannot
reach the failure. Give a concrete reason whenever tests are skipped.

## Teaming Pattern

A QA agent may establish red before the implementer fixes it. Parallelize
independent research/review; preserve test-before-fix ordering and disjoint writers.
