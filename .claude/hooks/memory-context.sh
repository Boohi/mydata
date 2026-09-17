#!/bin/bash
# Hook: memory-context.sh
# Type: SessionStart
# Purpose: Inject relevant durable memory for this project at session start

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SCRIPT_PATH="$PROJECT_DIR/.ai-scripts/memory-context.sh"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  exit 0
fi

OUTPUT="$(bash "$SCRIPT_PATH" "$PROJECT_DIR" 2>/dev/null || true)"
if [[ -n "$OUTPUT" ]]; then
  echo "$OUTPUT"
fi

exit 0
