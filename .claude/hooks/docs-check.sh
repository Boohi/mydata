#!/bin/bash
# Hook: docs-check.sh
# Type: PreToolUse (Edit, Write, MultiEdit, NotebookEdit)
# Purpose: Remind agent to check docs before first edit in session

# This hook reads the hook JSON from stdin to get session_id.
HOOK_PAYLOAD="$(cat)"
SESSION_ID=""

if command -v python3 >/dev/null 2>&1; then
  SESSION_ID="$(python3 - <<'PY' 3<<<"$HOOK_PAYLOAD"
import json
import os
import sys

data = os.fdopen(3).read()
try:
    obj = json.loads(data) if data.strip() else {}
except Exception:
    obj = {}

print(obj.get("session_id", ""))
PY
)"
elif command -v jq >/dev/null 2>&1; then
  SESSION_ID="$(echo "$HOOK_PAYLOAD" | jq -r '.session_id // empty')"
fi

if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="unknown"
fi

SAFE_SESSION_ID="$(echo "$SESSION_ID" | tr -c '[:alnum:]' '_')"
DOCS_CHECK_FILE="/tmp/claude-docs-checked-${SAFE_SESSION_ID}"

# If already checked this session, allow the edit
if [[ -f "$DOCS_CHECK_FILE" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
DOCS_DIR="$PROJECT_DIR/docs"

# First edit of session - check if docs/ exists
if [[ -d "$DOCS_DIR" ]]; then
  # Count docs
  DOC_COUNT=$(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null | wc -l)
  
  if [[ "$DOC_COUNT" -gt 0 ]]; then
    echo "📚 This project has $DOC_COUNT docs. Run docs-list before making changes:"
    echo ""
    echo "  ./.ai-scripts/docs-list.sh"
    echo ""
    echo "Read relevant docs based on your task, then proceed with edits."
    echo "If your changes touch areas described in docs, update those docs and read_when hints."
    echo ""
    
    # Mark as reminded (don't block, just warn)
    touch "$DOCS_CHECK_FILE"
  fi
fi

# Don't block - just remind
exit 0
