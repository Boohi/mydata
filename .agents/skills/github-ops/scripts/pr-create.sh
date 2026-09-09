#!/bin/bash
# Create a GitHub Pull Request
# Usage: ./pr-create.sh [--title "Title"] [--body "Body"] [--base main]

set -e

gh pr create "$@"
