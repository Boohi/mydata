#!/bin/bash
# Hook: docs-list-context.sh
# Type: SessionStart
# Purpose: Advertise project docs without injecting the full catalog

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
DOCS_DIR="$PROJECT_DIR/docs"

if [[ ! -d "$DOCS_DIR" ]]; then
  exit 0
fi

DOC_COUNT=$(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null | wc -l)
if [[ "$DOC_COUNT" -le 0 ]]; then
  exit 0
fi

echo "Project docs detected ($DOC_COUNT Markdown files)."
echo "Before substantial work, use docs-ops or run the project docs-list command and read only relevant entries."

exit 0
