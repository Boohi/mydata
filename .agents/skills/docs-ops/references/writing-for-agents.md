# Write instructions agents can use

Give each rule one authoritative home at the narrowest reliable scope. Keep the
entrypoint to the trigger, ordered actions, meaningful authority boundary, and
observable completion criterion. Link reference material only from the phase
that needs it. A pointer should name the material and the concrete condition for
reading it; stronger discovery wording is cheaper than repeating a whole rule.

Use familiar terms and repository vocabulary. State the desired action directly.
Retain precise safety restrictions when necessary, with the safe next action.
Avoid restating package scripts, configuration, or ordinary model behavior when
a cheap lookup supplies the current answer.

Group each concept with its qualifications. Move examples, rare cases, recovery
procedures, and platform-specific detail into references. Split skills only when
a distinct trigger or reusable discipline needs independent discovery; another
human command is not automatically an improvement.

Distinguish internal disciplines from user-invoked workflows. A router can compose
ordinary skills within existing scope and authority. Explicit goal creation and
other consequential permissions remain governed by their owning contracts.
Verify actual discovery and invocation in each supported client rather than
assuming identical front-matter semantics or zero context cost.

Evaluate revisions with representative prompts and adversarial cases: routine
autonomy, unresolved authority, conflicting sources, existing ownership, and
missing runtime proof. Use held-out expected outcomes and negative controls.
Measure questions, duplicate state, correct routing, and evidence quality.
Passing keyword assertions, or a model listing the expected action names, is
insufficient evidence of real execution; retain model transcripts and inspect
actual tool outcomes when making execution claims.

Adapted from Matt Pocock's `writing-for-agents`; see
[upstream notice](upstream-notice.md).
