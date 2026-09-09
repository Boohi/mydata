#!/bin/bash
# Hook: git-commit-policy.sh
# Type: PreToolUse (Bash)
# Purpose: Enforce commit/push workflow via commit-push.sh script

HOOK_PAYLOAD="$(cat)"

extract_command() {
  if command -v python3 >/dev/null 2>&1; then
    HOOK_PAYLOAD="$HOOK_PAYLOAD" python3 - <<'PY'
import json
import os

raw = os.environ.get("HOOK_PAYLOAD", "")
try:
    data = json.loads(raw) if raw.strip() else {}
except Exception:
    data = {}

tool_input = data.get("tool_input", {}) if isinstance(data, dict) else {}
command = (
    tool_input.get("command")
    or tool_input.get("cmd")
    or tool_input.get("input")
    or ""
)
print(str(command).strip())
PY
    return
  fi

  if command -v jq >/dev/null 2>&1; then
    echo "$HOOK_PAYLOAD" | jq -r '(.tool_input.command // .tool_input.cmd // .tool_input.input // empty)'
  fi
}

COMMAND="$(extract_command)"

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# Allow the approved wrapper directly.
if [[ "$COMMAND" == *"./skills/github-ops/scripts/commit-push.sh"* ]]; then
  exit 0
fi

# Explicitly allow non-destructive branch creation (routine op, not gated).
#   git checkout -b <branch>   /   git switch -c <branch>
if echo "$COMMAND" | grep -Eiq '(^|[;&|[:space:]])git[[:space:]]+(checkout[[:space:]]+-b|switch[[:space:]]+-c)\b'; then
  exit 0
fi

if echo "$COMMAND" | grep -Eiq '(^|[;&|[:space:]])git[[:space:]]+(commit|push)\b'; then
  echo "BLOCKED: Raw git commit/push is not allowed." >&2
  echo "Use: ./skills/github-ops/scripts/commit-push.sh <patch|minor|major> \"change 1\" ..." >&2
  exit 2
fi

exit 0
