# `apps/daemon`

Swift XPC service. Receives flow + DNS events from the system extension, enriches with GeoIP/ASN/process attribution, and writes to a local SQLite database at `~/Library/Application Support/mydata/events.db`.

Implementation begins in issue **#4 — Daemon skeleton + XPC pipe from extension to daemon**.

This directory is intentionally empty until that issue is picked up.
