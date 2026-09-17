#!/bin/bash
# Hook: memory-stop.sh
# Type: Stop
# Purpose: Finalize session memory extraction at session end

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SCRIPT_PATH="$PROJECT_DIR/.ai-scripts/memory-capture.sh"

if [[ -f "$SCRIPT_PATH" ]]; then
  bash "$SCRIPT_PATH" stop claude "$PROJECT_DIR" >/dev/null 2>&1 || true
fi

exit 0
