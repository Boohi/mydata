#!/bin/bash
# Commit changes with version bump or changelog fragment, then push
# Usage: ./commit-push.sh [--dry-run] [--staged-only] <patch|minor|major> "entry1" "entry2" ...
#        ./commit-push.sh --push-only
#
# This script:
# For repos that provide scripts/changelog-fragments.mjs and .changeset/,
# versioned commits create per-PR changelog fragments instead of touching
# package.json or CHANGELOG.md. Other repos keep the legacy version bump flow.
# By default it stages all changes. Use --dry-run to preview without mutation,
# or --staged-only --no-version to commit an already-reviewed staged set.
#
# Examples:
#   ./commit-push.sh patch "Fix login timeout" "Improve error messages"
#   ./commit-push.sh minor "Add OAuth authentication" "Add user profiles"
#   ./commit-push.sh major "Breaking: new API format" "Remove deprecated endpoints"
#
# For commits without version bump:
#   ./commit-push.sh --no-version "chore: update deps"
# Preview without mutating files, commits, or remotes:
#   ./commit-push.sh --dry-run --no-version "chore: preview"
# Commit only already-reviewed staged files:
#   ./commit-push.sh --staged-only --no-version "chore: reviewed files"
# Retry a push after the commit succeeded but the remote push failed:
#   ./commit-push.sh --push-only

set -e

# Parse arguments
NO_VERSION=false
DRY_RUN=false
STAGED_ONLY=false
PUSH_ONLY=false
VERSION_BUMP=""
COMMIT_MSG=""
CHANGELOG_ENTRIES=()

while [[ "$1" == "--dry-run" || "$1" == "--staged-only" || "$1" == "--push-only" ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --staged-only) STAGED_ONLY=true ;;
    --push-only) PUSH_ONLY=true ;;
  esac
  shift
done

if [[ "$PUSH_ONLY" == "true" ]]; then
  if [[ "$DRY_RUN" == "true" || "$STAGED_ONLY" == "true" || $# -ne 0 ]]; then
    echo "Error: --push-only must be used by itself." >&2
    exit 1
  fi

  BRANCH=$(git branch --show-current)
  if [[ -z "$BRANCH" ]]; then
    echo "Error: --push-only requires a named branch." >&2
    exit 1
  fi

  echo "=== Push-only retry ==="
  echo "Pushing existing commits: origin $BRANCH"
  git push origin "$BRANCH"
  echo ""
  echo "✓ Push-only retry complete for $BRANCH"
  exit 0
fi

if [[ "$1" == "--no-version" ]]; then
  NO_VERSION=true
  shift
  COMMIT_MSG="$1"
  shift
  CHANGELOG_ENTRIES=("$@")
elif [[ "$1" =~ ^(patch|minor|major)$ ]]; then
  VERSION_BUMP="$1"
  shift
  CHANGELOG_ENTRIES=("$@")
else
  echo "Usage: ./commit-push.sh [--dry-run] [--staged-only] <patch|minor|major> \"entry1\" \"entry2\" ..."
  echo "       ./commit-push.sh [--dry-run] [--staged-only] --no-version \"commit message\" [\"entry1\" ...]"
  echo "       ./commit-push.sh --push-only"
  echo ""
  echo "Examples:"
  echo "  ./commit-push.sh patch \"Fix login bug\" \"Improve performance\""
  echo "  ./commit-push.sh minor \"Add new feature\" \"Update docs\""
  echo "  ./commit-push.sh --no-version \"chore: update dependencies\""
  echo "  ./commit-push.sh --dry-run --no-version \"chore: preview\""
  echo "  ./commit-push.sh --staged-only --no-version \"chore: reviewed files\""
  echo "  ./commit-push.sh --push-only"
  exit 1
fi

if [[ "$NO_VERSION" == "false" && ${#CHANGELOG_ENTRIES[@]} -eq 0 ]]; then
  echo "Error: At least one changelog entry required for versioned commits"
  exit 1
fi

if [[ "$STAGED_ONLY" == "true" && "$NO_VERSION" == "false" && "$DRY_RUN" == "false" ]]; then
  echo "Error: --staged-only requires --no-version because versioned commits generate unstaged package/changelog edits." >&2
  exit 1
fi

# Get current version from package.json
get_version() {
  if [[ -f "package.json" ]]; then
    grep -o '"version": *"[^"]*"' package.json | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+'
  else
    echo "0.0.0"
  fi
}

# Bump version
bump_version() {
  local version="$1"
  local bump="$2"

  IFS='.' read -r major minor patch <<< "$version"

  case "$bump" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

clean_text_line() {
  local value="$1"
  value="$(echo "$value" | tr '\n' ' ' | tr '\r' ' ')"
  value="$(echo "$value" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
  printf '%s' "$value"
}

build_summary_line() {
  local entries=("$@")
  local summary_parts=()
  local max_parts=2
  local max_len=90

  for entry in "${entries[@]}"; do
    entry="$(clean_text_line "$entry")"
    [[ -z "$entry" ]] && continue
    summary_parts+=("$entry")
    [[ ${#summary_parts[@]} -ge $max_parts ]] && break
  done

  local summary=""
  if [[ ${#summary_parts[@]} -gt 0 ]]; then
    for i in "${!summary_parts[@]}"; do
      if [[ -n "$summary" ]]; then
        summary="$summary; "
      fi
      summary="$summary${summary_parts[$i]}"
    done
  fi

  if [[ ${#summary} -gt $max_len ]]; then
    summary="${summary:0:$((max_len - 3))}..."
  fi

  printf '%s' "$summary"
}

build_commit_body() {
  local entries=("$@")

  if [[ ${#entries[@]} -gt 0 ]]; then
    echo "Changes:"
    for entry in "${entries[@]}"; do
      entry="$(clean_text_line "$entry")"
      [[ -z "$entry" ]] && continue
      echo "- $entry"
    done
    echo ""
  fi

  echo "Co-Authored-By: Claude <noreply@anthropic.com>"
}

commit_type_for_bump() {
  local bump="$1"

  case "$bump" in
    major) echo "feat!" ;;
    minor) echo "feat" ;;
    patch) echo "fix" ;;
  esac
}

supports_changelog_fragments() {
  [[ -f "scripts/changelog-fragments.mjs" && -d ".changeset" ]]
}

add_changelog_fragments() {
  local bump="$1"
  shift
  local entries=("$@")

  for entry in "${entries[@]}"; do
    entry="$(clean_text_line "$entry")"
    [[ -z "$entry" ]] && continue
    node scripts/changelog-fragments.mjs add --type "$bump" "$entry"
  done
}

# Update package.json version
update_package_json() {
  local new_version="$1"
  if [[ -f "package.json" ]]; then
    sed -i.bak "s/\"version\": *\"[^\"]*\"/\"version\": \"$new_version\"/" package.json
    rm -f package.json.bak
    echo "  package.json → v$new_version"
  fi
}

# Update CHANGELOG.md
update_changelog() {
  local version="$1"
  shift
  local entries=("$@")

  local changelog="CHANGELOG.md"
  local date=$(date +%Y-%m-%d)

  # Build entries text
  local entries_text=""
  for entry in "${entries[@]}"; do
    entries_text+="- $entry\n"
  done

  if [[ -f "$changelog" ]]; then
    # Check for Unreleased section
    if grep -q "^## Unreleased" "$changelog"; then
      # Replace "## Unreleased" with versioned header and prepend new entries
      awk -v version="$version" -v date="$date" -v entries="$entries_text" '
        /^## Unreleased$/ {
          print "## v" version " (" date ")"
          print ""
          printf entries
          next
        }
        { print }
      ' "$changelog" > "$changelog.tmp" && mv "$changelog.tmp" "$changelog"
      echo "  CHANGELOG.md → Unreleased → v$version with new entries"
    else
      # Insert new section after # Changelog heading
      local new_section="## v$version ($date)\n\n${entries_text}\n"
      awk -v section="$new_section" '
        NR==1 { print; print ""; printf section; next }
        NR==2 && /^$/ { next }
        { print }
      ' "$changelog" > "$changelog.tmp" && mv "$changelog.tmp" "$changelog"
      echo "  CHANGELOG.md → Added v$version section"
    fi
  else
    # Create new changelog
    {
      echo "# Changelog"
      echo ""
      echo "## v$version ($date)"
      echo ""
      echo -e "$entries_text"
    } > "$changelog"
    echo "  CHANGELOG.md → Created with v$version"
  fi
}

echo "=== Preparing commit ==="
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run: no files will be modified, staged, committed, or pushed"
fi

if [[ "$NO_VERSION" == "true" ]]; then
  echo "Mode: No version bump"
  echo "Message: $COMMIT_MSG"
else
  CURRENT_VERSION=$(get_version)
  NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$VERSION_BUMP")
  SUMMARY_LINE=$(build_summary_line "${CHANGELOG_ENTRIES[@]}")
  if supports_changelog_fragments; then
    COMMIT_TYPE=$(commit_type_for_bump "$VERSION_BUMP")
    if [[ -n "$SUMMARY_LINE" ]]; then
      COMMIT_MSG="$COMMIT_TYPE: $SUMMARY_LINE"
    else
      COMMIT_MSG="$COMMIT_TYPE: update changelog fragments"
    fi
  else
    if [[ -n "$SUMMARY_LINE" ]]; then
      COMMIT_MSG="release: v$NEW_VERSION - $SUMMARY_LINE"
    else
      COMMIT_MSG="release: v$NEW_VERSION"
    fi
  fi

  echo "Mode: $VERSION_BUMP bump"
  if supports_changelog_fragments; then
    echo "Version: v$CURRENT_VERSION (unchanged; changelog fragments enabled)"
  else
    echo "Version: v$CURRENT_VERSION → v$NEW_VERSION"
  fi
  echo "Entries:"
  for entry in "${CHANGELOG_ENTRIES[@]}"; do
    echo "  - $entry"
  done

  if [[ "$DRY_RUN" == "true" ]]; then
    ENTRY_WORD="entries"
    if [[ ${#CHANGELOG_ENTRIES[@]} -eq 1 ]]; then
      ENTRY_WORD="entry"
    fi
    if supports_changelog_fragments; then
      echo "Would add ${#CHANGELOG_ENTRIES[@]} changelog $ENTRY_WORD"
    else
      echo "Would update package.json to v$NEW_VERSION"
      echo "Would update CHANGELOG.md with ${#CHANGELOG_ENTRIES[@]} $ENTRY_WORD"
    fi
  else
    echo ""
    echo "=== Updating files ==="
    if supports_changelog_fragments; then
      add_changelog_fragments "$VERSION_BUMP" "${CHANGELOG_ENTRIES[@]}"
    else
      update_package_json "$NEW_VERSION"
      update_changelog "$NEW_VERSION" "${CHANGELOG_ENTRIES[@]}"
    fi
  fi
fi

echo ""
echo "=== Changes to commit ==="
git status --short

if [[ "$STAGED_ONLY" == "true" ]]; then
  echo "Staging: staged-only (git add -A skipped)"
else
  echo "Staging: all changes (git add -A)"
fi

COMMIT_BODY="$(build_commit_body "${CHANGELOG_ENTRIES[@]}")"

if [[ "$DRY_RUN" == "true" ]]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "<unknown>")
  if [[ "$STAGED_ONLY" == "true" ]]; then
    echo "Would commit already staged changes only"
  else
    echo "Would stage all changes with git add -A"
  fi
  echo "Would commit: $COMMIT_MSG"
  if [[ -n "$COMMIT_BODY" ]]; then
    echo "$COMMIT_BODY"
  fi
  echo "Would push: origin $BRANCH"
  echo ""
  echo "✓ Dry run complete"
  exit 0
fi

if [[ "$STAGED_ONLY" == "true" ]] && git diff --cached --quiet; then
  echo "No staged changes to commit; stage reviewed files first or omit --staged-only." >&2
  exit 1
fi

echo ""
echo "=== Committing ==="
if [[ "$STAGED_ONLY" == "false" ]]; then
  git add -A
fi
git commit -m "$COMMIT_MSG" -m "$COMMIT_BODY"

# Push
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"

echo ""
echo "✓ Committed and pushed to $BRANCH"
if [[ "$NO_VERSION" == "false" && ! supports_changelog_fragments ]]; then
  echo "✓ Released v$NEW_VERSION"
elif [[ "$NO_VERSION" == "false" ]]; then
  echo "✓ Added changelog fragment(s)"
fi
