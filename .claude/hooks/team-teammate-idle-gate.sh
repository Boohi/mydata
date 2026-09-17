#!/bin/bash
# Hook: team-teammate-idle-gate.sh
# Type: TeammateIdle
# Purpose: Prevent idle handoffs while repository is in an invalid state

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [[ ! -d "$PROJECT_DIR" ]]; then
  exit 0
fi

cd "$PROJECT_DIR" || exit 0

if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

if git diff --name-only --diff-filter=U | grep -q .; then
  echo "BLOCKED: teammate cannot idle while merge conflicts remain unresolved." >&2
  exit 2
fi

mapfile -t CHANGED < <(git status --porcelain=1 | awk '{print $2}')

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  conflict_hits="$(rg -n '^(<<<<<<<|=======|>>>>>>>)' "${CHANGED[@]}" 2>/dev/null || true)"
  if [[ -n "$conflict_hits" ]]; then
    echo "BLOCKED: teammate cannot idle with conflict markers in changed files." >&2
    echo "$conflict_hits" >&2
    exit 2
  fi
fi

exit 0
