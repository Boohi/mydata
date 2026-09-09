#!/bin/sh
# Stop / SessionEnd hook: mark this agent offline so it stops showing as active
# work. Best-effort; never blocks shutdown.
set -u

HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=./mailbox-common.sh
. "${HOOK_DIR}/mailbox-common.sh"

mailbox_cli offline >/dev/null 2>&1 || true

# Best-effort worklog entry: record session end with a rough touched-file count.
# Guard the git call so a non-repo cwd never aborts shutdown.
_touched="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
[ -n "${_touched}" ] || _touched=0
mailbox_cli worklog --kind session "ended (${_touched} files touched)" >/dev/null 2>&1 || true

exit 0
