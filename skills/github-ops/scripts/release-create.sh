#!/bin/bash
# Create a GitHub Release
# Usage: ./release-create.sh <tag> [--title "Title"] [--notes "Notes"] [--draft]

set -e

if [ -z "$1" ]; then
  echo "Usage: ./release-create.sh <tag> [--title \"Title\"] [--notes \"Notes\"] [--draft]"
  exit 1
fi

TAG="$1"
shift

gh release create "$TAG" "$@"
