#!/usr/bin/env bash
# Idempotently create GitHub issues from docs/issues/**/*.md.
# Each file has YAML front-matter (title, labels, milestone) and a markdown body.
# Re-running this script does NOT create duplicates: it looks up by exact title.
#
# REQUIRES: bash >= 4 (uses `declare -A` and `mapfile`). macOS ships bash 3.2;
# install a newer bash via `brew install bash` and invoke as
# `/opt/homebrew/bin/bash scripts/seed-issues.sh`.
set -euo pipefail

if ((BASH_VERSINFO[0] < 4)); then
  echo "ERROR: bash >= 4 required (found $BASH_VERSION). Install with: brew install bash" >&2
  exit 1
fi

REPO="${REPO:-Boohi/mydata}"

if ! command -v yq >/dev/null 2>&1; then
  echo "yq not found. Install: brew install yq" >&2
  exit 1
fi

# Cache milestone title -> number lookup.
declare -A MILESTONES
while IFS=$'\t' read -r num title; do
  MILESTONES["$title"]="$num"
done < <(gh api "repos/$REPO/milestones?state=all" -q '.[] | [.number, .title] | @tsv')

shopt -s globstar nullglob
for f in docs/issues/**/*.md; do
  fm=$(awk '/^---$/{c++; next} c==1{print} c==2{exit}' "$f")
  body=$(awk 'c==2{print} /^---$/{c++}' "$f")
  title=$(echo "$fm" | yq -r '.title')
  milestone_title=$(echo "$fm" | yq -r '.milestone')
  mapfile -t labels < <(echo "$fm" | yq -r '.labels[]')

  # Skip if an issue with this exact title already exists.
  existing=$(gh issue list --repo "$REPO" --state all --search "in:title \"$title\"" --json title,number \
    -q ".[] | select(.title == \"$title\") | .number" | head -1)
  if [[ -n "$existing" ]]; then
    echo "exists  #$existing: $title"
    continue
  fi

  ms_num="${MILESTONES[$milestone_title]:-}"
  if [[ -z "$ms_num" ]]; then
    echo "ERROR: milestone '$milestone_title' not found in repo. Aborting." >&2
    exit 1
  fi

  label_args=()
  for l in "${labels[@]}"; do
    label_args+=(--label "$l")
  done

  num=$(gh issue create --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --milestone "$milestone_title" \
    "${label_args[@]}" \
    | tail -1 \
    | sed 's|.*/||')
  echo "created #$num: $title"
done
