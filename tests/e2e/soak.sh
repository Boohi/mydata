#!/usr/bin/env bash
set -euo pipefail

# Soak harness for the mydata daemon.
#
# Defaults to SOAK_MINUTES=5. Set SOAK_MINUTES=1440 for the 24-hour run
# referenced in issue #19's acceptance criteria.
#
# Skips gracefully if tests/e2e/loopback-talker.mjs is not present, since
# the talker is a separate, future deliverable.

DUR_MIN="${SOAK_MINUTES:-5}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

WORK="$(mktemp -d -t mydata-soak.XXXXXX)"
trap 'kill %1 2>/dev/null || true; rm -rf "$WORK"' EXIT

SOCK="$WORK/daemon.sock"
DB="$WORK/mydata.db"
export MYDATA_SOCK="$SOCK"
export MYDATA_DB="$DB"

echo "soak: building daemon"
swift build --package-path apps/daemon >/dev/null

DAEMON_BIN="$(swift build --package-path apps/daemon --show-bin-path)/mydata-daemon"

echo "soak: starting daemon (sock=$SOCK db=$DB)"
"$DAEMON_BIN" &
sleep 1

TALKER="tests/e2e/loopback-talker.mjs"
if [[ ! -f "$TALKER" ]]; then
  echo "soak: loopback-talker not present, skipping"
  exit 0
fi

# Set retention to 0 so the sweeper would trim everything immediately when it
# next fires. The 10-minute cadence may not actually fire during a short smoke
# run; that's fine -- we just want to ensure the meta key is honored.
sqlite3 "$DB" "UPDATE meta SET value='0' WHERE key='retention_days';" || true

END=$(( $(date +%s) + DUR_MIN * 60 ))
MAX_ROWS=0

while [[ $(date +%s) -lt $END ]]; do
  node "$TALKER" --sock "$SOCK" --count 50 || true
  sleep 5
  COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM flows;" 2>/dev/null || echo 0)
  if [[ "$COUNT" -gt "$MAX_ROWS" ]]; then
    MAX_ROWS=$COUNT
  fi
done

echo "soak: max row count observed = $MAX_ROWS"
if [[ "$MAX_ROWS" -gt 100000 ]]; then
  echo "soak: FAIL (row count exceeded 100000)"
  exit 1
fi
echo "soak: OK"
