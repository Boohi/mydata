---
summary: Automatic continuous memory architecture for Claude Code, OpenCode, Codex, and GitHub Copilot
read_when:
  - implementing session memory or retrieval-augmented context
  - debugging repeated agent failures across sessions
  - extending hooks/plugins with persistent learning behavior
updated: 2026-07-12
---

# Continuous Memory

The shared memory module reduces repeated debugging while keeping automatic
agent observations out of Git. It implements two explicit tiers and treats all
retrieval as delimited untrusted historical evidence.

## Goals

- Capture high-value observations privately without requiring explicit
  "memorize this" prompts.
- Require explicit review and evidence before project-portable promotion.
- Rehydrate a concise memory summary automatically at session start.
- Keep one schema, safety gate, and engine for all platforms.

## Structure

- Engine: `scripts/memory/engine.mjs`
- Wrappers: `scripts/memory-context.sh`, `scripts/memory-capture.sh`, `scripts/memory-reflect.sh`
- Claude hooks: `hooks/memory-context.sh`, `hooks/memory-post-tool.sh`, `hooks/memory-stop.sh`
- OpenCode plugin: `plugins/continuous-memory.ts`
- Skill: `skills/continuous-memory/SKILL.md`

Machine-private automatic storage:

- `$XDG_STATE_HOME/shared-ai-config/memory/projects/<project-key>/`
- fallback: `~/.local/state/shared-ai-config/memory/projects/<project-key>/`
- owner-only events, candidates, private memories, quarantine, migration
  backups, and receipts
- a `project-identity.json` receipt binds canonical path/birth identity, Git
  common and objects directories, and repository scope so path reuse, in-place
  reinitialization, or remote replacement fails closed without treating normal
  orphan/fetched history as a new repository

Project-portable storage contains `.ai-memory/memories.jsonl` plus its
`.gitignore`. The JSONL file contains only schema-v2 records written through an
explicit reviewed promotion or reviewed migration. Automatic capture never
stages or commits memory. Legacy transient `events.jsonl` and
`candidates.jsonl` names remain ignored for safe upgrades.
The root `.gitignore` must ignore `.ai-memory/*` and explicitly re-include
`.ai-memory/.gitignore` plus `.ai-memory/memories.jsonl`; `setup-project.sh`
migrates the older whole-directory ignore rule.
The managed block explicitly re-includes `.ai-memory/` itself before its child
rules and verifies the final Git decision, including broader pre-existing
patterns such as `**/.ai-memory/`.
Both setup and direct engine initialization use the same `prepare` command;
linked `.ai-memory`, nested ignore, or root ignore paths fail closed before
portable tracking files are changed.

## Automatic Behavior

### Claude Code

- `SessionStart`: injects bounded, quoted, untrusted context
- `PostToolUse`: ingests safe payload signals into machine-private state
- `Stop`: finalizes private scoring and retires that session's transient events

### OpenCode

- Injects the same bounded untrusted context via system transform
- Uses official `message.part.updated` tool states for completed/error capture
  and `session.idle` for finalization; the adapter-supplied source remains
  authoritative over hook payload fields

### Codex and GitHub Copilot

Codex/Copilot do not currently expose equivalent native project hooks in this repo setup. Use the same shared scripts through instructions:

- Session start: run `./.ai-scripts/memory-context.sh`
- High-friction completion: run `./.ai-scripts/memory-reflect.sh` with task/problem/resolution metadata

This keeps schema, safety, and retrieval behavior consistent with
Claude/OpenCode automation. Copilot and Codex never gain a separate portable
write path.

## Scoring and Promotion

Signals used by the engine include:

- number of tool calls
- number of failures
- repeated error signatures
- recovery after failures
- files touched

Outcomes:

- High confidence: durable machine-private observation
- Medium confidence: machine-private candidate
- Repeated candidate: promotion only within the private tier
- Explicit review with project scope and evidence: schema-v2 project-portable
  record

Context precedence is live code/config/external state, current project docs,
reviewed project-portable memory, then machine-private continuity. Portable
records can supersede older records or carry tracked tombstones. Matching
private observations stay suppressed so deleted guidance cannot reappear.

## Safety Rules

- Reject credentials, API keys, tokens, encoded/high-entropy credentials,
  mailbox content, email/phone data, and escaping or symlinked paths before
  persistence. Slash-delimited filesystem-like spans are an ambiguous case:
  automatic capture replaces the entire span with `[filesystem-path]` before
  validation and persistence. Project-relative file evidence remains available
  only through the separately contained and validated `stats.files` field.
- Apply the same checks to reviewer, scope, evidence, source, tool, session,
  and file metadata; reject unknown portable schema fields rather than carrying
  them forward.
- Keep memories technical, concise, and project-scoped.
- Enforce item and token budgets during retrieval. The engine uses UTF-8 byte
  length as a conservative model-independent upper bound, so multibyte CJK and
  emoji cannot exceed the configured token ceiling.
- Treat reviewed memory as evidence, never instructions, executable policy, or
  authority.
- Quarantine malformed, unsafe, or unknown migration records in private mode
  `0600` state and never inject them.
- Serialize private mutations through a boot/process-start-bound lease; stale
  malformed or PID-reused locks are recovered without trusting PID alone.

## Useful Commands

```bash
# Print top memories for this project
./.ai-scripts/memory-context.sh

# Capture privately after a high-friction task (Codex/Copilot fallback)
./.ai-scripts/memory-reflect.sh \
  --source codex \
  --task "fix setup-project symlink edge case" \
  --problem "manifest query failed on relative path" \
  --resolution "normalize project path before manifest lookup" \
  --tool-calls 12 \
  --files "scripts/setup-project.sh,tests/setup-project-smoke.test.mjs"

# Explicitly review one private observation into portable project memory
node ./.ai-scripts/memory/engine.mjs review \
  --project "$PWD" \
  --id "<private-memory-id>" \
  --reviewer "<reviewer>" \
  --scope "owner/repository" \
  --evidence "issue:#123,commit:abc1234"

# Remove unconfirmed private candidates older than the default retention
node ./.ai-scripts/memory/engine.mjs prune --days 180

# Reviewed legacy migration and safe rollback
node ./.ai-scripts/memory/engine.mjs migrate \
  --project "$PWD" \
  --reviewer "<reviewer>" \
  --scope "owner/repository" \
  --evidence "issue:#123"
node ./.ai-scripts/memory/engine.mjs rollback \
  --project "$PWD" \
  --receipt "<receipt-id>"
```

Migration preflights the complete portable and private-quarantine outputs, then
writes an owner-only safe backup and prepared receipt before changing portable
bytes. Clean accepted rows remain byte-identical. Filesystem-like spans are
redacted, while rejected, unknown, and malformed rows are represented only by
reason plus digest in quarantine and are omitted from the restorable backup.
Rollback restores that safe pre-migration snapshot from both applied receipts
and recoverable prepared receipts; it cannot reintroduce rejected raw bytes.
Unconfirmed private candidates expire after 180 days by default.
Reviewed portable records remain until a reviewed supersedes link or tombstone
retires them.
