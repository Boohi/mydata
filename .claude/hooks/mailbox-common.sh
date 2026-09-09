#!/bin/sh
# Shared helpers for the Ultrasonic mailbox lifecycle hooks (platform issue #285).
# POSIX sh, fail-safe: a mailbox error must NEVER abort the agent. Everything
# here degrades quietly and logs to stderr only.
#
# Locating the repo + CLI:
#   - MAILBOX_CLI_REPO_DIR (explicit) wins.
#   - else CLAUDE_PROJECT_DIR (set by Claude Code) if it contains the CLI.
#   - else walk up from this script's directory to find apps/super/src/mailbox-cli.ts.
#
# Shared visibility prerequisite: every agent on a host must point at the same
# store. Export ULTRASONIC_STATE_DIR (preferred) or SUPER_MAILBOX_PATH before
# launching agents so they coordinate through one mailbox.json.

mailbox_resolve_repo() {
  if [ -n "${MAILBOX_CLI_REPO_DIR:-}" ] && [ -f "${MAILBOX_CLI_REPO_DIR}/apps/super/src/mailbox-cli.ts" ]; then
    printf '%s\n' "${MAILBOX_CLI_REPO_DIR}"
    return 0
  fi

  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "${CLAUDE_PROJECT_DIR}/apps/super/src/mailbox-cli.ts" ]; then
    printf '%s\n' "${CLAUDE_PROJECT_DIR}"
    return 0
  fi

  # Walk up from this script's location.
  _dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  while [ "${_dir}" != "/" ]; do
    if [ -f "${_dir}/apps/super/src/mailbox-cli.ts" ]; then
      printf '%s\n' "${_dir}"
      return 0
    fi
    _dir="$(dirname -- "${_dir}")"
  done

  return 1
}

# Run the mailbox CLI fail-safe. Args are passed straight through. Output goes
# to the caller's stdout/stderr; a non-zero exit is suppressed UNLESS the caller
# opts in by setting MAILBOX_PROPAGATE_EXIT=1 (used only by the gate hook).
mailbox_cli() {
  _repo="$(mailbox_resolve_repo)" || {
    echo "mailbox-hook: could not locate mailbox CLI; skipping" >&2
    return 0
  }

  _node="${MAILBOX_NODE_BIN:-node}"
  if ! command -v "${_node}" >/dev/null 2>&1; then
    echo "mailbox-hook: node not on PATH; skipping" >&2
    return 0
  fi

  if [ "${MAILBOX_PROPAGATE_EXIT:-0}" = "1" ]; then
    ( cd "${_repo}" && "${_node}" apps/super/src/mailbox-cli.ts "$@" )
    return $?
  fi

  ( cd "${_repo}" && "${_node}" apps/super/src/mailbox-cli.ts "$@" ) || {
    echo "mailbox-hook: mailbox CLI exited non-zero; degrading quietly" >&2
    return 0
  }
}
