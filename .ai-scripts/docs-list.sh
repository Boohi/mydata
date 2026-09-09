#!/bin/bash
# docs-list.sh - List project docs with summaries
#
# Scans docs/*.md files for front-matter metadata and prints:
# - File path
# - Summary (from front-matter)
# - Read-when hints (when to consult this doc)
#
# Usage: ./scripts/docs-list.sh [docs-dir]
#        ./scripts/docs-list.sh              # uses ./docs
#        ./scripts/docs-list.sh ../other/docs

set -e

DOCS_DIR="${1:-docs}"

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "No docs directory found at: $DOCS_DIR"
  echo "Create docs/ with markdown files containing front-matter:"
  echo ""
  echo "  ---"
  echo "  summary: Brief description of this doc"
  echo "  read_when:"
  echo "    - working on authentication"
  echo "    - debugging login issues"
  echo "  ---"
  exit 0
fi

echo "📚 Project Documentation ($DOCS_DIR)"
echo "=================================="
echo ""

# Find all markdown files, excluding archive/research
find "$DOCS_DIR" -name "*.md" -type f \
  ! -path "*/archive/*" \
  ! -path "*/research/*" \
  ! -path "*/.git/*" \
  2>/dev/null | sort | while read -r file; do

  rel_path="${file#$DOCS_DIR/}"
  
  # Check if file has front-matter
  if ! head -1 "$file" | grep -q "^---"; then
    echo "⚠️  $rel_path [missing front-matter]"
    continue
  fi
  
  # Extract front-matter (between first --- and second ---)
  front_matter=$(awk '/^---$/{if(++c==2)exit}c' "$file" | tail -n +2)
  
  # Extract summary
  summary=$(echo "$front_matter" | grep -E "^summary:" | sed 's/^summary:\s*//' | sed 's/^["'\'']\|["'\'']$//g' | head -1)
  
  # Extract read_when hints (handles both inline array and list format)
  read_when=$(echo "$front_matter" | awk '
    /^read_when:/ {
      in_read_when=1
      # Check for inline array [...]
      if (match($0, /\[.*\]/)) {
        inline = substr($0, RSTART, RLENGTH)
        gsub(/[\[\]'\''"]/, "", inline)
        gsub(/,\s*/, "; ", inline)
        print inline
        in_read_when=0
      }
      next
    }
    in_read_when && /^[a-z_]+:/ { in_read_when=0 }
    in_read_when && /^  *- / {
      hint = $0
      gsub(/^  *- /, "", hint)
      printf "%s; ", hint
    }
  ' | sed 's/; $//')
  
  if [[ -n "$summary" ]]; then
    echo "📄 $rel_path"
    echo "   $summary"
    if [[ -n "$read_when" ]]; then
      echo "   └─ Read when: $read_when"
    fi
  else
    echo "⚠️  $rel_path [no summary in front-matter]"
  fi
  echo ""
done

echo "=================================="
echo "💡 Tip: Read relevant docs before coding. Update docs when behavior changes."
echo "   Add 'read_when' hints to help agents know when to consult each doc."
