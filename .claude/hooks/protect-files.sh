#!/bin/bash
# Hook: protect-files.sh
# Type: PreToolUse (Edit, Write, MultiEdit, NotebookEdit)
# Purpose: Block editing protected files/directories

HOOK_PAYLOAD="$(cat)"

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

if [[ -z "$FILE_PATHS" ]]; then
  exit 0
fi

while IFS= read -r FILE_PATH; do
  if [[ -z "$FILE_PATH" ]]; then
    continue
  fi

  case "$FILE_PATH" in
    node_modules/*|.git/*|dist/*|build/*|.next/*|coverage/*|*"/node_modules/"*|*"/.git/"*|*"/dist/"*|*"/build/"*|*"/.next/"*|*"/coverage/"*)
      echo "BLOCKED: Cannot edit protected path: $FILE_PATH" >&2
      exit 2
      ;;
  esac

  case "$FILE_PATH" in
    *.lock|package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb|*/package-lock.json|*/pnpm-lock.yaml|*/yarn.lock|*/bun.lockb)
      echo "BLOCKED: Cannot edit lockfile: $FILE_PATH" >&2
      exit 2
      ;;
  esac
done <<< "$FILE_PATHS"

exit 0
