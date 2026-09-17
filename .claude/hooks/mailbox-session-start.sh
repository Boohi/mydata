#!/bin/sh
# SessionStart hook: register presence, then emit awareness to stdout so the
# harness injects it into the agent's context (mirrors memory-context.sh).
# Fail-safe: never abort the session on a mailbox error.
set -u

HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=./mailbox-common.sh
. "${HOOK_DIR}/mailbox-common.sh"

# Register (or upsert) this agent's presence. Identity is derived by the CLI.
mailbox_cli register >/dev/null 2>&1 || true

# Best-effort worklog entry: record session start. The branch derives from the
# same signal the CLI uses for identity; never abort the session on failure.
_branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-unknown}}"
mailbox_cli worklog --kind session "started ${_branch}" >/dev/null 2>&1 || true

# Emit awareness for context injection. Human-readable on stdout.
AWARENESS="$(mailbox_cli awareness 2>/dev/null || true)"
if [ -n "${AWARENESS}" ]; then
  echo "## Mailbox awareness"
  echo "${AWARENESS}"
fi

exit 0
