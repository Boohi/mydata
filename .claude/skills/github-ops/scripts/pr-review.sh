#!/bin/bash
# Review a GitHub Pull Request
# Usage: ./pr-review.sh <pr_number> [--approve|--request-changes|--comment]

set -e

if [ -z "$1" ]; then
  echo "Usage: ./pr-review.sh <pr_number> [--approve|--request-changes|--comment]"
  exit 1
fi

PR="$1"
shift

gh pr review "$PR" "$@"
