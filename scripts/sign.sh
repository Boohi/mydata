#!/usr/bin/env bash
# Codesigns the built MydataExtension system extension bundle.
# Reads Apple Developer credentials from scripts/signing.env (gitignored).
#
# Usage: scripts/sign.sh path/to/MydataExtension.systemextension
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/signing.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  echo "Copy scripts/signing.env.example to scripts/signing.env and fill it in." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${TEAM_ID:?TEAM_ID must be set in signing.env}"
: "${SIGNING_IDENTITY:?SIGNING_IDENTITY must be set in signing.env}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 path/to/MydataExtension.systemextension" >&2
  exit 2
fi

BUNDLE="$1"
if [[ ! -d "$BUNDLE" ]]; then
  echo "ERROR: bundle '$BUNDLE' not found." >&2
  exit 1
fi

ENTITLEMENTS="$SCRIPT_DIR/../apps/extension/Bundle/MydataExtension.entitlements"

codesign --force \
  --options runtime \
  --sign "$SIGNING_IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  --timestamp \
  "$BUNDLE"

echo "Signed $BUNDLE with $SIGNING_IDENTITY (team $TEAM_ID)."
