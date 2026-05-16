#!/usr/bin/env bash
# Idempotently apply labels from .github/labels.json.
# Re-running edits existing labels in place; never errors on duplicates.
# Requires: gh CLI authenticated, jq.
set -euo pipefail

REPO="${REPO:-Boohi/mydata}"
LABELS_FILE=".github/labels.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. Install: brew install jq" >&2
  exit 1
fi

existing=$(gh label list --repo "$REPO" --json name -q '.[].name' | sort -u)

jq -c '.[]' "$LABELS_FILE" | while read -r row; do
  name=$(echo "$row" | jq -r '.name')
  color=$(echo "$row" | jq -r '.color')
  desc=$(echo "$row" | jq -r '.description')

  if echo "$existing" | grep -Fxq "$name"; then
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "updated: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "created: $name"
  fi
done
