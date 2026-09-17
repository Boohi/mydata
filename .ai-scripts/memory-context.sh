#!/bin/bash
# memory-context.sh - Print top durable memory entries for session context
# Usage: ./memory-context.sh [project-path] [max-items]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_PATH="${1:-$(pwd)}"
MAX_ITEMS="${2:-${MEMORY_MAX_ITEMS:-5}}"
MAX_TOKENS="${MEMORY_MAX_TOKENS:-800}"

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

node "$SCRIPT_DIR/memory/engine.mjs" context \
  --project "$PROJECT_PATH" \
  --max "$MAX_ITEMS" \
  --max-tokens "$MAX_TOKENS"
