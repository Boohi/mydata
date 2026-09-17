#!/bin/bash
# memory-reflect.sh - Capture a high-value observation in machine-private state
# Usage:
#   ./memory-reflect.sh --source codex --task "..." --problem "..." --resolution "..." --tool-calls 10 --files "a,b"

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_PATH="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

node "$SCRIPT_DIR/memory/engine.mjs" reflect --project "$PROJECT_PATH" "$@"
