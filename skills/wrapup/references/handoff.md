# A handoff that preserves the work

Keep the issue/PR, branch, owner, and any bound goal identity as the durable thread.
Read live state before writing the final handoff. Record the existing owner and
whether a worker or service still needs the worktree; a new session should resume
that lineage rather than create another coordinator, branch, or goal.

Link the specification, decisions, commits, review, and verification artifacts
instead of duplicating their full contents. Distinguish observed results from
planned checks and old evidence. Include the exact next authorized action,
unresolved blocker, and capabilities needed to proceed.

When another harness, directory, or colleague needs a portable brief, add a small
local handoff document pointing to the durable artifacts. Name only the relevant
canonical skills. Include current scope, exclusions, assumptions, owner/worktree
state, and next action. Redact secrets and private payloads. A temporary file
alone does not satisfy GitHub synchronization or durable publication.

Preserve ambiguous or unrelated dirty changes and their locations. Checkpoint the
reviewed task-owned set with the canonical helper. A passing fix does not make
another worker's migration publishable or an active server's worktree disposable.
Follow the owning workflow's cleanup requirements before any removal.

Prepare the complete decision-ready handoff before asking for an unavoidable
approval. Routine resumption or communication inside native task collaboration
needs no new permission when already authorized. Starting an independent headless
owner is a separate action; never imply it is an app-native chat.

Adapted from Matt Pocock's `handoff` and phase-boundary guidance; see
[upstream notice](upstream-notice.md).
