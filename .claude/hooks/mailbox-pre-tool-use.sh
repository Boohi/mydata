#!/bin/sh
# PreToolUse hook for Edit|Write|MultiEdit: run the mailbox pre-edit gate.
#
# Policy (issue #285):
#   - BLOCK (exit 2) ONLY on a genuine duplicate-work collision — a second
#     active agent on the same activityKey.
#   - WARN/non-block (exit 0) for everything else: no duplicate, pending
#     messages only, blocked bootstrap, degraded, or any CLI/transport error.
#
# The CLI encodes the block decision in its EXIT CODE
# (`awareness --block-on-duplicate-work`: exit 2 iff collision, else 0), so this
# hook does ZERO JSON parsing and simply branches on that single exit code. The
# separate `awareness --gate` 0/10/20/30 contract is unaffected.
set -u

HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=./mailbox-common.sh
. "${HOOK_DIR}/mailbox-common.sh"

# Propagate the exit code so we can read the block decision. mailbox_common's
# runner returns the CLI status verbatim under MAILBOX_PROPAGATE_EXIT=1; any
# non-block CLI failure surfaces as a non-2 status and is treated as warn.
MAILBOX_PROPAGATE_EXIT=1 mailbox_cli awareness --block-on-duplicate-work
GATE_STATUS=$?

if [ "${GATE_STATUS}" -eq 2 ] 2>/dev/null; then
  echo "mailbox-gate: BLOCKED — another active agent shares this activityKey." >&2
  echo "Coordinate via the mailbox (send/receive) before editing." >&2
  exit 2
fi

# Any other status (0, or a non-block error) is non-blocking.
exit 0
