# Superify progress contract

`superify.progress.v1` is the authoritative, fail-closed persisted progress format. One owning orchestrator is the only writer. Subagents return bounded summaries and evidence; they never mutate shared state.

## CLI and storage

The frozen commands are exactly:

```text
node skills/superify/scripts/superify-state.mjs init --state-id <uuid> --input <file|->
node skills/superify/scripts/superify-state.mjs read --state-id <uuid>
node skills/superify/scripts/superify-state.mjs path --state-id <uuid>
node skills/superify/scripts/superify-state.mjs update --state-id <uuid> --expected-revision <n> --input <file|->
node skills/superify/scripts/superify-state.mjs recover-lock --state-id <uuid>
node skills/superify/scripts/superify-viewer.mjs --state-id <uuid> [--port <0-65535>]
```

Successful state commands print one JSON object containing `ok`, `stateId`, `path`, `revision`, `packageRevision`, and `planRevision` as applicable. Successful initialization additionally returns immutable `createdAt`, which is required for exact read-free reconstruction before the first update. The viewer prints one JSON line containing `url`, `stateId`, and `statePath`, then serves on `127.0.0.1`; port `0` is the default. Exit 0 is success, exit 1 is validation, malformed-lock, or operational failure, and exit 2 is an expected missing/existing-state, stale-revision, held-lock, or ineligible-recovery refusal. No other exit code is part of the contract.

State lives below the absolute platform state root, never a project-relative path. POSIX directories use `0700` and files `0600`. On Windows the user-profile ACL is trusted; only POSIX mode assertions are skipped while path, host, and schema checks remain mandatory.

State initialization requires a caller-supplied UUID-v4, validates the complete document before touching the filesystem, then atomically reserves that UUID directory. Replaying the exact UUID and writer-normalized-equivalent initialization input is idempotent only while the stored artifact remains the exact pristine revision-1 initialization. Replay serializes on the same writer lock, re-reads and compares under that lock, re-establishes the goal, goals-root, state-root, and XDG durability barriers, rechecks path and progress-file identity, and only then returns the original thin envelope without changing the artifact. Omitted optional empty arrays and explicit empty arrays are normalized-equivalent. A held lock or reserved directory without a readable artifact reports `INIT_IN_PROGRESS`; different normalized content reports `INIT_BINDING_MISMATCH`; any advanced artifact reports `INIT_STATE_ADVANCED`. All three are exit-2 refusals and preserve prior bytes. Reads are lock-free and read-only: they never create, chmod, repair, or acquire a writer lock. Existing path components are inspected without following symlinks, and opened progress files must be regular files whose device and inode still match the preceding inspection. Reads are capped at the document byte limit before parsing and validating the complete stored document.

Mutations use one non-waiting exclusive `.writer.lock`. The writer records and owns the lock inode, compares the expected revision only while holding it, and removes the lock only if the path still names that exact inode. It writes a same-directory exclusive temporary file, fsyncs and closes it, atomically renames it over `progress.json`, then fsyncs the goal directory. Initialization and newly consumed activation permission additionally fsync the required ancestor directories bottom-up before reporting success. A pre-rename failure preserves the prior bytes and removes only the owned temporary file. A post-rename barrier failure reports bounded `DURABILITY_UNKNOWN`; the renamed document remains authoritative and any consumed permission remains non-reusable.

On Windows, directory-open `EISDIR` and directory-fsync `EINVAL` or `ENOTSUP` are the only unsupported durability classifications. Ordinary non-activation updates may be internally best-effort in that case, but a newly consumed permission fails with `DURABILITY_UNSUPPORTED`. Permission, access, I/O, and every other error remain operational failures. The implementation uses repeated `lstat`, containment, open-without-following, and `fstat` identity checks; portable Node does not expose descriptor-relative `openat`, so same-user ancestor replacement is narrowed but not claimed to be fully eliminated.

Lock recovery is never implicit. Only the explicit `recover-lock` command may remove the active lock name, and only when its bounded JSON record is at least 300,000 milliseconds old, names the current hostname, has a positive safe-integer PID that is no longer alive, and still names the same regular `0600` inode that was opened and inspected. `EPERM` liveness means alive, `ESRCH` means dead, and every other liveness error fails operationally. Recovery atomically renames the verified stale inode to a unique same-directory `0600` quarantine and retains it there: portable Node has no descriptor-relative conditional unlink, so deleting the quarantine by pathname would reintroduce a replacement race. The goal directory is fsynced before recovery is reported. Missing, young, foreign-host, live-PID, malformed, permissive, symlinked, or identity-changed locks remain untouched.

The state CLI emits one newline-terminated JSON object per success or failure. Failure envelopes contain exactly `ok` and a bounded stable `code`; they never contain candidate document bytes or native error text. Input may be one JSON document from stdin or an explicitly named file. Unknown, missing, duplicate, non-integer, and trailing input are rejected before state mutation. The help surface lists only `init`, `read`, `path`, `update`, and `recover-lock`.

## Viewer server boundary

The viewer binds only `127.0.0.1` and accepts no host or state-root override. Every request must carry exactly one Host header equal to `127.0.0.1:<selected-port>` or `localhost:<selected-port>`. Only `GET` and `HEAD` are accepted; every other method returns `405` with `Allow: GET, HEAD`. The exact route table is `/`, `/styles.css`, `/viewer.js`, and `/api/progress`. Targets are decoded once; malformed encoding, query/fragment selection, duplicate slashes, backslashes, traversal, absolute-form targets, malformed request lines, and unknown routes fail closed.

Every success and error response sets the self-only content security policy, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`; no CORS header is emitted. `HEAD` returns the same status and metadata as `GET` with no body, including parser-level errors. Assets and state reads are capped. The production progress provider reuses the read-only state-path inspection boundary, opens without following the final file, requires the exact selected state ID plus a regular user-owned `0600` inode, validates fatal UTF-8 and the complete document, and fingerprints the exact raw artifact bytes. Missing state is an opaque bounded `404`; unsafe or invalid state is an opaque bounded `422`. Neither response exposes local paths, artifact bytes, or validation details.

## Shape and limits

Unknown keys and enum values are rejected at every level. State IDs are UUID v4. Local record IDs match `^[a-z][a-z0-9-]{0,63}$`. Timestamps are canonical ISO-8601 instants. Display strings are at most 160 characters, summaries 500, persisted goal objectives 2,025, and package array entries 500. New generated `create_goal` objectives remain capped at 2,000 by the separate pre-side-effect activation helper; the additional 25 persisted characters exist only to mirror the one documented pre-fix runtime objective exactly during same-state recovery. There are at most 20 milestones, 200 each of steps, blockers, decisions, and verifications, 50 links, and 100 activity records. Package arrays contain at most 50 entries. Documents are capped at 524,288 encoded bytes.

The exact top-level keys are `schemaVersion`, `revision`, `packageRevision`, `planRevision`, `createdAt`, `updatedAt`, `package`, `goal`, `activation`, `milestones`, `steps`, `blockers`, `decisions`, `blockedAudit`, `activity`, `telemetry`, `links`, `state`, `error`, `staleAfterMs`, `planProjection`, and `verification`.

Nested allowed keys are:

- package: `outcome`, `userValue`, `intendedArtifact`, `startingState`, `firstSlice`, `confirmedRequirements`, `preferences`, `assumptions`, `constraints`, `resourceEnvelope`, `nonGoals`, `laterHorizons`, `milestoneIds`, `researchTasks`, `risks`, `approvalBoundaries`, `verificationSurfaces`, `iterationPolicy`, `blockedStopCondition`, `definitionOfDone`;
- goal: `status`, `title`, `objective`, `id`, `source`;
- activation: `stateId`, `status`, `attempt`, `approvedPackageRevision`, `approvedPlanRevision`, `approvedAt`, `permissionConsumedAt`, `associatedGoal`, `lastError`, `runtime`; associated goal: `externalId`, `confirmedAt`;
- milestone: `id`, `title`, `status`, `stepIds`; step: `id`, `milestoneId`, `title`, `status`, `source`, `verificationIds`, `blockerIds`, `updatedAt`;
- blocker: `id`, `label`, `status`, `severity`, `milestoneId`, `stepId`, `openedAt`, `resolvedAt`, `source`; decision: `id`, `label`, `status`, `approvalRequired`, `resolvedAt`;
- blocked audit: `conditionId`, `lastObservedGoalTurnId`, `resumedAt`, `resetReason`, `consecutiveGoalTurns`;
- activity: `seq`, `at`, `type`, `label`, `actor`, `stepId`; telemetry: exactly `tokens` and `elapsedMs`, each either `{ availability: "unavailable" }` or `{ availability: "reported"|"derived", value, source, observedAt }`, except tokens cannot be derived;
- link: `id`, `label`, `href`, `kind`; projection: `status`, `lastProjectedPlanRevision`, `observedAt`, `lastError`, `client`;
- verification: `id`, `label`, `status`, `required`, `stepIds`, `summary`, `observedAt`, `evidenceRefs`, `skipReason`, `approvalDecisionId`.

Initialization requires `package`, `milestones`, and `steps`; `blockers`, `decisions`, `verification`, and `links` are optional. When `verification` is omitted, the writer deterministically creates one planned, required record for every unique step `verificationIds` value, in first-seen step order, and fills reciprocal `stepIds` in step order. An explicitly supplied `verification` array is authoritative and must already be complete and reciprocal; malformed or incomplete explicit arrays fail closed and are never replaced by synthesized records.

Every `error`, `activation.lastError`, and `planProjection.lastError` is either null or exactly `{ code, summary }`. Top-level document state `error` requires a non-null top-level `error`, and every other document state requires it to be null. Accepted enum vocabularies are: goal status `active|complete|blocked`; goal source `superify.skill`; activation status `awaiting_approval|approved|not_started|active|conflict|unsupported`; runtime and projection client `codex`; milestone and step status `pending|in_progress|blocked|completed`; blocker status `open|resolved`; blocker severity `watch|blocking`; decision status `open|resolved`; verification status `planned|passed|failed|skipped`; document state `draft|ready|blocked|complete|conflict|unsupported|error`; projection status `not_projected|stale|synced|error`; telemetry availability `unavailable|reported|derived` subject to the tokens restriction; activity actor `orchestrator`; activity type `goal_activated|milestone_completed|verification_passed|step_started|package_approved|activation_permission_consumed|step_completed|blocker_opened|blocker_resolved|decision_resolved|projection_updated|telemetry_updated`; link kind `issue|pull_request|artifact|evidence|viewer`.

Exactly one step may be `in_progress`. Every executable step has at least one required verification. A completed step is valid only when all required checks passed or were explicitly skipped. A required skip needs a reason and a resolved, approval-required decision. Each blocker targets exactly one milestone or step. Package `milestoneIds` equals the ordered top-level milestone IDs. A `complete` associated runtime goal and document state are equivalent, and completion requires every step to be completed with every required verification passed or explicitly skipped. A `blocked` associated runtime goal and document state are likewise equivalent; compile-only blocked documents may keep `goal` null.

Graph references are reciprocal: every verification `stepIds` edge appears in the corresponding step `verificationIds`, and vice versa. Step `blockerIds` contain exactly blockers that directly target that step; milestone-targeted blockers apply through the milestone and are not duplicated onto child steps. Causal timestamps never precede their cause: document update follows creation, permission consumption follows approval, association confirmation follows consumption, blocker resolution follows opening, and approved-skip observation follows its resolved decision.

The writer recomputes milestone status from steps, blockers, and verification. Completed means every child is completed and verified; blocked means an open blocking blocker targets the milestone or a child; in-progress means the sole active child or completed-but-unverified work; otherwise pending. Inconsistent stored status is invalid.

Telemetry provenance is mandatory. Tokens may only be reported from a documented runtime source. Elapsed time may be sourced or derived and names its source and observation time. Agent turns remain unavailable until a public source exists.

## Identity, activation, and blocked audit

State identity and creation time are immutable. Before permission, `approvedPackageRevision`, `approvedPlanRevision`, `approvedAt`, and `permissionConsumedAt` are all null. Consumed permission requires a positive attempt, both exact approved revisions, and approval time. It is persisted before any side effect and cannot be reused after a crash or failure.

Runtime association is exactly-once. `associatedGoal` stays null until documented successful activation with goal status `active`, then freezes exactly `{ externalId, confirmedAt }`, where `externalId` may be null. It cannot be cleared or swapped, and an active document cannot create another association. Once associated, the attempt, approval/permission tuple, and goal identity fields (`id`, `title`, `objective`, and `source`) freeze; material mirroring may move only the goal status from `active` to `complete` or `blocked` without changing the association or consumed activation checkpoint.

The normal goal mirror uses the exact prevalidated objective capped at 2,000 characters. The single legacy recovery may adopt the exact 2,025-character runtime objective only when the prior permission is consumed, association is null, activation is `conflict`, documented creation succeeded, and `get_goal` confirms the same state. Before that first association, the current document must contain the exact live `ASSOCIATION_REJECTED` activation error; the one association transition clears it, requires active status plus the immutable state ID inside the objective, and preserves the consumed attempt and approved tuple. Direct or new over-2,000 association bypasses fail closed. Once associated, the exact recovered objective freezes and may pass unchanged through later status and projection updates. The recovered objective is never truncated or restated, and this compatibility ceiling does not enlarge future `create_goal` input.

Blocked audit contains the nullable open blocking blocker `conditionId`, consecutive owning goal-turn count, last observed opaque UUID-v4 goal-turn ID, resume timestamp, and reset reason. The writer advances it exactly once per owning goal turn with one nullable condition. The opaque turn ID is correlation state, not displayed telemetry. Duplicate turns do not count; a cleared condition resets with `condition_cleared`, a different condition resets with `condition_changed`, and resume resets before observation with `resumed`. Blocked status is permitted only at count three or above.

A null audit condition has count zero. A non-null audit condition has count at least one and a non-null last-observed goal-turn ID.

## Revisions and projection

| Changed content | `revision` | `packageRevision` | `planRevision` |
| --- | --- | --- | --- |
| Any accepted mutation | +1 | conditional | conditional |
| Any `package` field except its system counters | +1 | +1 | unchanged unless `milestoneIds` also forces matching plan records |
| Milestone title/order/`stepIds`, or step title/order/`milestoneId`/status/`verificationIds` | +1 | unchanged | +1 |
| Derived milestone status change after normalization | +1 | unchanged | +1 |
| Blocker record, verification record status/evidence, decision record, or step `blockerIds` | +1 | unchanged | +1 only when normalized milestone status also changes |
| Step `source` or `updatedAt` | +1 | unchanged | unchanged |
| Goal, activation, blocked audit, activity, telemetry, links, document state, or error | +1 | unchanged | unchanged |
| Projection status/observed time only | +1 | unchanged | unchanged |
| Combined package and plan edit | +1 | +1 | +1 |

The milestone, step, and verification identity sets freeze after initialization: records may reorder, but IDs cannot be added, removed, or remapped. Every candidate must present the exact current `revision`, `packageRevision`, and `planRevision` tuple before the writer derives the next counters. Either reviewed preactivation revision changing clears approval and returns activation to `awaiting_approval`. Active plan changes make projection stale before projection. Nonactive plans remain `not_projected`. `not_projected` has no projected revision, observation, or error; `synced` has the exact current plan revision, a non-null observation, and no error; `error` has a non-null observation and bounded error; `stale` retains no error. Projection failure preserves the last projected revision and leaves the artifact authoritative; successful retry synchronizes exactly the current plan revision.

## Presentation and privacy

Stored fields are direct evidence. Counts, percentages, current focus, health, and staleness are derived and labeled as such; zero steps displays `No tasks yet` with no percentage.

The skill owns semantic sanitization. The validator mechanically rejects obvious private-key blocks, bearer tokens, `sk-`/`sk_`, `ghp_`, `github_pat_`, and key/value secret signatures without echoing candidates in errors. Persisted links allow only `http` and `https` without URL userinfo; the viewer separately permits its bounded loopback URL and rejects credential-bearing links in defense in depth.

Material mirror triggers are goal status, step or milestone change, blocker change, verification, incorporated subagent result, and sourced telemetry. Narration, raw tool calls, repetitive logs, and private source payloads are excluded.
