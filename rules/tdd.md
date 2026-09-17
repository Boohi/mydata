# Test-Driven Development (TDD)

Use a strict red-green-refactor loop for new behavior and fixes.

## Workflow

1. **Plan**: Define one coherent implementation slice, its affected behavior,
   and the checks that will prove it.
2. **Red**: Write the smallest focused failing test that defines the behavior,
   including an edge or error case.
3. **Green**: Implement the whole planned slice. Run the focused test once at
   the completed-slice boundary to establish Green. Use other targeted syntax,
   lint, or type checks only at meaningful boundaries where they can change the
   next implementation decision, not after every edit.
4. **Refactor**: Clean up the slice, then rerun its targeted checks because the
   implementation changed.
5. **Verify**: Run broad verification once near handoff, before a risky
   external mutation, or when repository-specific policy requires it. Required
   CI may own the final cross-runtime or full-regression matrix.

Do not repeat checks unless source, tests, configuration, dependencies, or the
environment changed, the previous result failed or became stale, or a focused
rerun is needed to diagnose a flake. Reuse conclusive evidence for an unchanged
revision and environment. Do not run an umbrella command immediately after
running every command it already contains.

## Required For

- New functionality
- Bug fixes
- Refactors that can change runtime behavior
- API/contract changes

## Verification Contract

Before completion, include:

- test files added or updated
- at least one edge/error case for changed behavior
- exact commands run for verification
- concise pass/fail summary

If no tests are added for a behavior change, provide a concrete reason.

## Risk Boundaries

This cadence does not relax security, destructive-operation, migration,
release, device, canary, or production-readiness gates. Run those checks at the
boundary where the corresponding external risk is introduced. A local demo or
ordinary implementation slice does not inherit release gates unless it is
actually being released.

## Guidelines

- Keep tests focused and deterministic.
- Prefer unit tests for core logic; add integration tests for end-to-end behavior.
- If a bug is reported, write a regression test first.
- Record enough revision and environment context to know whether evidence is
  still reusable.
- Update docs when behavior or interfaces change.
