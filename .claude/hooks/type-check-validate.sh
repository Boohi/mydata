#!/bin/bash
# Hook: type-check-validate.sh
# Type: PostToolUse (Edit, Write, MultiEdit, NotebookEdit)
# Purpose: Run TypeScript type check after editing .ts/.tsx files

HOOK_PAYLOAD="$(cat)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

get_file_paths() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY' 3<<<"$HOOK_PAYLOAD"
import json
import os
import sys

data = os.fdopen(3).read()
try:
    obj = json.loads(data) if data.strip() else {}
except Exception:
    obj = {}

paths = []
tool_name = obj.get("tool_name", "")
tool_input = obj.get("tool_input", {})

if tool_name == "MultiEdit":
    edits = tool_input.get("edits", [])
    for edit in edits:
        path = edit.get("file_path") or edit.get("filePath")
        if path:
            paths.append(path)
else:
    path = tool_input.get("file_path") or tool_input.get("filePath")
    if path:
        paths.append(path)

seen = set()
deduped = []
for path in paths:
    if path not in seen:
        seen.add(path)
        deduped.append(path)

print("\n".join(deduped))
PY
    return
  fi

  if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$HOOK_PAYLOAD" | jq -r '.tool_name // empty')
    if [[ "$tool_name" == "MultiEdit" ]]; then
      echo "$HOOK_PAYLOAD" | jq -r '.tool_input.edits[]? | (.file_path // .filePath // empty)'
    else
      echo "$HOOK_PAYLOAD" | jq -r '(.tool_input.file_path // .tool_input.filePath // empty)'
    fi
  fi
}

FILE_PATHS="$(get_file_paths)"
TS_FILE=""

while IFS= read -r FILE_PATH; do
  if [[ -z "$FILE_PATH" ]]; then
    continue
  fi

  # Only run for TypeScript files
  if [[ "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
    # Skip generated files
    if [[ "$FILE_PATH" == *".generated."* ]] || [[ "$FILE_PATH" == *"/generated/"* ]]; then
      continue
    fi

    TS_FILE="$FILE_PATH"
    break
  fi
done <<< "$FILE_PATHS"

if [[ -z "$TS_FILE" ]]; then
  exit 0
fi

# Resolve to absolute path when hook payload provides relative path.
if [[ "$TS_FILE" != /* ]]; then
  TS_FILE="$PROJECT_DIR/$TS_FILE"
fi

# Find the nearest tsconfig.json.
DIR=$(dirname "$TS_FILE")
TS_CONFIG=""
while [[ "$DIR" != "/" ]]; do
  if [[ -f "$DIR/tsconfig.json" ]]; then
    TS_CONFIG="$DIR/tsconfig.json"
    break
  fi
  DIR=$(dirname "$DIR")
done

if [[ -z "$TS_CONFIG" ]]; then
  # No tsconfig found, skip.
  exit 0
fi

hash_text() {
  local value="$1"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$value" | shasum -a 1 | awk '{print $1}'
    return
  fi
  if command -v md5 >/dev/null 2>&1; then
    printf '%s' "$value" | md5
    return
  fi
  printf '%s' "$value" | tr -cd '[:alnum:]'
}

KEY="$(hash_text "$TS_CONFIG")"
STATE_FILE="/tmp/claude-tsc-${KEY}.state"
LOCK_DIR="/tmp/claude-tsc-${KEY}.lock"
DEBOUNCE_SECONDS="${CLAUDE_TSC_DEBOUNCE_SECONDS:-25}"
NOW="$(date +%s)"

# Debounce frequent edits in the same TypeScript project.
if [[ -f "$STATE_FILE" ]]; then
  LAST_RUN="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"
  if [[ "$LAST_RUN" =~ ^[0-9]+$ ]]; then
    DELTA=$((NOW - LAST_RUN))
    if (( DELTA < DEBOUNCE_SECONDS )); then
      exit 0
    fi
  fi
fi

# Prevent concurrent background checks for the same tsconfig.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

echo "$NOW" > "$STATE_FILE"
cd "$(dirname "$TS_CONFIG")" || exit 0

# Run type check (quick, no emit) and limit output.
if command -v pnpm >/dev/null 2>&1; then
  pnpm tsc --noEmit --skipLibCheck --pretty false 2>&1 | head -60
elif command -v npx >/dev/null 2>&1; then
  npx tsc --noEmit --skipLibCheck --pretty false 2>&1 | head -60
fi

exit 0
