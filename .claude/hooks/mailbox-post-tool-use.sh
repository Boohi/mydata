#!/bin/sh
# PostToolUse hook: throttled, best-effort heartbeat. Never blocks the agent.
# Throttle: at most one heartbeat per MAILBOX_HEARTBEAT_INTERVAL seconds
# (default 60) using a stamp file in the system temp dir.
set -u

HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck source=./mailbox-common.sh
. "${HOOK_DIR}/mailbox-common.sh"

INTERVAL="${MAILBOX_HEARTBEAT_INTERVAL:-60}"
STAMP="${TMPDIR:-/tmp}/ultrasonic-mailbox-heartbeat.$(id -u)"

NOW="$(date +%s 2>/dev/null || echo 0)"
LAST=0
if [ -f "${STAMP}" ]; then
  LAST="$(cat "${STAMP}" 2>/dev/null || echo 0)"
fi

# Skip if within the throttle window.
if [ "${NOW}" -ne 0 ] 2>/dev/null && [ "${LAST}" -ne 0 ] 2>/dev/null; then
  ELAPSED=$((NOW - LAST))
  if [ "${ELAPSED}" -lt "${INTERVAL}" ]; then
    exit 0
  fi
fi

echo "${NOW}" >"${STAMP}" 2>/dev/null || true
mailbox_cli heartbeat >/dev/null 2>&1 || true
exit 0
