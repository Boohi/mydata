#!/bin/bash
# Add entries to CHANGELOG.md
# Usage: ./changelog-add.sh <version> <entry1> [entry2] [entry3] ...
#
# Examples:
#   ./changelog-add.sh v1.2.0 "Add login feature" "Fix memory leak"
#   ./changelog-add.sh v1.2.0 "Single change only"

set -e

VERSION="$1"
shift
ENTRIES=("$@")

if [[ -z "$VERSION" ]] || [[ ${#ENTRIES[@]} -eq 0 ]]; then
  echo "Usage: ./changelog-add.sh <version> <entry1> [entry2] ..."
  exit 1
fi

CHANGELOG="CHANGELOG.md"

# Create if doesn't exist
if [[ ! -f "$CHANGELOG" ]]; then
  echo "# Changelog" > "$CHANGELOG"
  echo "" >> "$CHANGELOG"
fi

# Build new section
NEW_SECTION="## $VERSION\n\n"
for entry in "${ENTRIES[@]}"; do
  NEW_SECTION+="- $entry\n"
done
NEW_SECTION+="\n"

# Insert after "# Changelog" heading
# Using awk to insert after first line
awk -v section="$NEW_SECTION" '
  NR==1 { print; print ""; printf section; next }
  NR==2 && /^$/ { next }
  { print }
' "$CHANGELOG" > "$CHANGELOG.tmp" && mv "$CHANGELOG.tmp" "$CHANGELOG"

echo "✓ Added $VERSION to CHANGELOG.md"
