# Architecture as an evidence-backed audit lens

Scope to the user's subsystem or to recent change hotspots before scanning.
Respect the project's domain vocabulary and existing ADRs. Look for real caller
or maintainer friction: duplicated business rules, one change scattered across
many files, complex interfaces exposing internals, or tests unable to reach the
actual failure. File count or line count alone is not a design defect.

For each candidate, compare the current interface with the behavior it provides.
A useful module hides meaningful complexity behind a manageable interface. Ask
whether deleting it removes complexity or merely distributes the same knowledge
among callers. Avoid generic advice to extract every function or merge every
small module; retain justified service, component, and platform boundaries.

Identify the dependency strategy before proposing a refactor: pure code, a local
owned dependency with a test substitute, a remote owned interface, or a third-party
contract. Use the existing test/production adapters when appropriate. Introduce a
new interface when it serves a real caller, substitution, or verification need.

Report affected areas, measured friction, proposed improvement, a representative
caller/test, confidence, and a before/after diagram when it clarifies the change.
An ADR conflict needs concrete evidence strong enough to justify reconsideration.
Retain test coverage for independent contracts and failure modes.

If an interface choice has consequential alternatives, give independent read-only
agents different design constraints and compare results: smallest caller surface,
clearest common case, or needed flexibility. Recommend one using actual use cases.
This audit proposes a bounded issue through `issue-sync`; execution stays with
`next-slice` and the user's authorized scope.

Adapted from Matt Pocock's `codebase-design` and
`improve-codebase-architecture`; see
[upstream notice](upstream-notice.md).
