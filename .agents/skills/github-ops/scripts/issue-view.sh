#!/bin/bash
# View a GitHub Issue as clean JSON (field-pinned, no GraphQL-deprecated fields)
# Usage: ./issue-view.sh <number> [repo]
# Note: do NOT append `2>&1` — the benign deprecation warning on stderr would
# otherwise pollute stdout and make a successful read look failed.

set -e

if [ -z "$1" ]; then
  echo "Usage: ./issue-view.sh <number> [repo]"
  exit 1
fi

gh issue view "$1" ${2:+-R "$2"} \
  --json number,title,body,labels,state,milestone,comments
