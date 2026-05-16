#!/usr/bin/env bash
set -euo pipefail
diff -r packages/schema/migrations apps/daemon/Sources/MydataDaemon/Migrations
