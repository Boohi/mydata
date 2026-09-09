#!/bin/bash
# View a GitHub Pull Request as clean JSON (field-pinned, no GraphQL-deprecated fields)
# Usage: ./pr-view.sh <number> [repo]
# For a diffstat use `gh pr diff <n> | diffstat` (or `git diff --stat`),
# NOT `gh pr diff --stat` (invalid invocation).
# Note: do NOT append `2>&1` — the benign deprecation warning on stderr would
# otherwise pollute stdout and make a successful read look failed.

set -e

if [ -z "$1" ]; then
  echo "Usage: ./pr-view.sh <number> [repo]"
  exit 1
fi

gh pr view "$1" ${2:+-R "$2"} \
  --json number,title,body,state,headRefName,baseRefName,mergeable,isDraft,statusCheckRollup
