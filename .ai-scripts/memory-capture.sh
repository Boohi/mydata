#!/bin/bash
# memory-capture.sh - Ingest hook/plugin payload into machine-private memory state
# Usage: cat payload.json | ./memory-capture.sh <post-tool|stop> [source] [project-path]

set -e

MODE="${1:-post-tool}"
SOURCE="${2:-unknown}"
PROJECT_PATH="${3:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

node "$SCRIPT_DIR/memory/engine.mjs" ingest-payload --project "$PROJECT_PATH" --source "$SOURCE" --mode "$MODE" >/dev/null 2>&1 || true

exit 0
