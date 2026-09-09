# Incoming request triage

For an incoming issue or an explicitly selected external PR, read the full report,
discussion, current labels, prior triage, and related implementation. Reproduce
a claimed bug when possible; an external report is evidence to verify. Search by
domain concept for an existing implementation, duplicate ticket, or documented
reason the same request was previously declined.

Map readiness to the repository's existing labels and workflow. Suggested concepts
are needs investigation, needs information, ready for an agent, ready for a human,
and declined; these are not a mandate to create a new label taxonomy. Issues
already prepared for an authorized slice do not require another triage interview.

For agent-ready work, update the existing issue with current versus desired
behavior, relevant interfaces, independent acceptance criteria, dependencies,
scope exclusions, and evidence. Preserve stable issue IDs and active PRs. Include
current file/command pointers as navigation aids while making the behavioral
contract understandable if files later move.

Record unanswered material questions and confirmed facts so another session does
not ask them again. Apply outcomes within established tracker authority. A
rejected request needs a reason in the existing issue or decision record; an
already implemented request needs a link to implementation and proof. Avoid
inventing another rejection knowledge base where the project has one.

Adapted from Matt Pocock's `triage` and agent-brief reference; see
[upstream notice](upstream-notice.md).
