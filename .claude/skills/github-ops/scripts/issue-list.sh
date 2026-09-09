#!/bin/bash
# List GitHub Issues
# Usage: ./issue-list.sh [--state open|closed|all] [--label "label"]

set -e

gh issue list "$@"
