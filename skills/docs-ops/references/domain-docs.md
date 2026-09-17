# Domain language and decision records

Find the existing glossary and ADR convention before editing. A project may use
`CONTEXT.md` and `docs/adr/`, a `CONTEXT-MAP.md` for multiple domains, or another
documented location. Preserve that choice. Create a glossary lazily when the first
settled term needs a home; create an ADR only when a decision earns one.

## Shared vocabulary

Define domain concepts in language the owner and code both use. Explain overloaded
terms with concrete examples and edge cases. When a statement disagrees with code
or a prior decision, identify the discrepancy with evidence. Ask only if it is a
material unresolved choice; settled terminology can be recorded directly.

Keep the glossary focused on concepts and their relationships. Link technical
implementation details, plans, and decision rationale to their own authoritative
artifacts. Existing mixed-purpose docs can be improved incrementally without
silently removing useful material or inventing a second source of truth.

## Consequential decisions

Record an ADR when changing the choice later would be costly, its rationale would
otherwise surprise a future maintainer, and real alternatives were considered.
State the context, decision, alternatives, consequences, evidence, and status in
the project's existing format. A routine preference or reversible local choice
can stay in the issue/PR instead.

Preserve superseded decisions and link their replacements. A glossary correction
does not authorize changing architecture. Reopen a prior decision only when the
current request or concrete friction justifies that scope.

Adapted from Matt Pocock's `domain-modeling`; see
[upstream notice](upstream-notice.md).
