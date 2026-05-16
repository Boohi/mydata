---
title: "Privacy paranoia test in CI"
labels: ["type:slice", "priority:p1", "area:ci", "risk:privacy"]
milestone: "v0.1"
---

## Goal

Add a CI test that fails if any shipped binary opens an outbound socket on launch.

## Why

The privacy promise (docs/privacy-promise.md) is load-bearing for the product's credibility. Code, not docs, must enforce it. See spec §5.

## Scope

In:
- A test harness that launches each built binary in a sandboxed environment (network namespace on Linux runners, or `nsjail`/`pf` rules) where outbound connections fail loudly.
- A CI job `privacy-paranoia` that runs on every PR and on main.
- Documented bypass procedure for the future (post-v0.1) day we genuinely add an opt-in network feature.

Out:
- Sandboxing the dev experience (test runs in CI only).
- Network-feature opt-in mechanism (post-v0.1).

## Dependencies

- #1 (need CI workflow).
- Should run before binaries actually exist; until then the test asserts "no binaries to check yet" passes trivially. The first slice that produces a binary (#3 or #4) flips it on.

## Acceptance criteria

- [ ] `npm run test:privacy` exists and is invoked by CI.
- [ ] On a binary that DOES make an outbound call (test fixture), the test fails clearly.
- [ ] On a binary that does NOT (real daemon/extension once they exist), the test passes.
- [ ] Doc updated in `docs/privacy-promise.md` with the exact assertion and how a contributor can run it locally.
