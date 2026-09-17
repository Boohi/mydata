# Plan one deliverable slice

Start from the current user request, existing issue, active owner, and branch/PR.
Read prior decisions before drafting anything. A current plan or set of tickets
is the starting point; replace it only when the user changes the scope or live
evidence makes it invalid. Keep current identifiers and link revisions.

## A useful slice

Describe the observable result, why it matters, current behavior, acceptance
criteria, verification, exclusions, and real dependencies. A slice crosses only
the layers needed to demonstrate that result. For example, restoring an export
cursor includes a resumed export and recovery proof, rather than separate
unusable database, API, and UI tickets.

Size the result to the authorized run. Work blockers first. Native tracker
dependencies should express real gating relationships when available; retain
explicit issue links when the tracker lacks them. Search existing issues and PRs
through `issue-sync` before creating or restructuring tickets. An unblocked ticket
is eligible, not automatically authority to exceed the user's slice bound.

For a broad mechanical migration, use expand-contract: add a compatible form,
migrate bounded caller groups while maintaining checks, then remove the old form
after callers and proof have converged. A shared integration branch is justified
only when slices cannot remain independently green; record that limitation and
the final integration gate rather than claiming each batch complete.

## Bounded uncertainty

Research facts from code, docs, tools, or primary sources. Delegate independent
research with an evidence artifact and keep the main critical path moving.
Re-use settled preferences and repository conventions. Record reversible choices
as assumptions and proceed within existing authority.

Ask only when the missing answer materially changes the outcome, scope, risk, or
authority and cannot be discovered. Bundle only independent decisions, give a
recommendation, and keep independent work moving. Prepare the concrete proposal,
comparison, prototype, or verification before requiring a human decision. Stop
interviewing when remaining uncertainty can be resolved by reversible assumptions.

Use a throwaway prototype only to answer a specific question that needs runnable
evidence. Keep its decision and provenance linked to the existing issue; isolate
scratch data and preserve active work. Prototype code or a planning decision is
not product-completion proof.

## Human review surface

The owner should see the result, the consequential choice, its evidence, and the
next action. Internal skill selection belongs to the orchestrator. Planning does
not create or activate a goal implicitly; explicit `superify` compilation keeps
its own normative receipt and approval contract.

Adapted from Matt Pocock's `to-spec`, `to-tickets`, `grilling`, `research`,
`prototype`, and the checkpoint principle in beta `loop-me`; see
[upstream notice](upstream-notice.md).
