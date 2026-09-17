#!/bin/bash
# add-frontmatter.sh - Add front-matter to docs without it
#
# Usage: ./scripts/add-frontmatter.sh [docs-dir]
#        ./scripts/add-frontmatter.sh              # uses ./docs
#        ./scripts/add-frontmatter.sh --dry-run    # show what would change
#
# Adds basic front-matter to markdown files that don't have it.
# Summary is extracted from first heading or filename.

set -e

DRY_RUN=false
DOCS_DIR="docs"

for arg in "$@"; do
  case "$arg" in
    --dry-run|-n)
      DRY_RUN=true
      ;;
    *)
      DOCS_DIR="$arg"
      ;;
  esac
done

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "No docs directory found at: $DOCS_DIR"
  exit 1
fi

echo "📝 Adding front-matter to docs in: $DOCS_DIR"
[[ "$DRY_RUN" == "true" ]] && echo "   (dry-run mode)"
echo ""

count=0

find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null | while read -r file; do
  # Skip if already has front-matter
  if head -1 "$file" | grep -q "^---"; then
    continue
  fi
  
  # Extract summary from first H1 heading or filename
  first_heading=$(grep -m1 "^# " "$file" | sed 's/^# //' | head -c 80)
  if [[ -z "$first_heading" ]]; then
    # Use filename as fallback
    first_heading=$(basename "$file" .md | tr '_-' ' ')
  fi
  
  rel_path="${file#"$DOCS_DIR"/}"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would add to: $rel_path"
    echo "  summary: $first_heading"
    echo ""
  else
    # Create temp file with front-matter + original content
    tmp_file=$(mktemp)
    cat > "$tmp_file" << EOF
---
summary: $first_heading
read_when: []
---

EOF
    cat "$file" >> "$tmp_file"
    mv "$tmp_file" "$file"
    echo "✅ $rel_path"
    ((count++)) || true
  fi
done

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Run without --dry-run to apply changes."
else
  echo "Done! Added front-matter to files."
  echo "Edit the files to add proper 'read_when' hints."
fi
