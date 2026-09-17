#!/bin/bash
# Hook: memory-post-tool.sh
# Type: PostToolUse
# Purpose: Capture tool-level friction signals into continuous memory

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SCRIPT_PATH="$PROJECT_DIR/.ai-scripts/memory-capture.sh"

if [[ -f "$SCRIPT_PATH" ]]; then
  bash "$SCRIPT_PATH" post-tool claude "$PROJECT_DIR" >/dev/null 2>&1 || true
fi

exit 0
