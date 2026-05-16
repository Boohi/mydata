---
title: "SQLite schema, writer, and retention sweeper"
labels: ["type:slice", "priority:p1", "area:daemon"]
milestone: "v0.1"
---

## Goal

Persist incoming flow and DNS events to `~/Library/Application Support/mydata/events.db` and sweep records older than the retention window.

## Why

Spec §6 (data model). All views depend on this.

## Scope

In:
- `packages/schema/` with the schema SQL in `packages/schema/migrations/0001_initial.sql` for tables `flows`, `dns_queries`, `apps`, `exclusions`, `meta`.
- Codegen: TS types + Swift structs from the migrations file (or a YAML source-of-truth → both).
- Daemon batches writes (10 events or 250ms, whichever first).
- Retention sweeper task: every 10 minutes deletes rows older than `meta.retention_days` (default 30).
- WAL mode, busy_timeout=5000ms.

Out:
- Enrichment fields (#7 fills them).
- Read-side UI integration (#8).

## Dependencies

- #4 (pipe exists), #5 (DNS events exist).

## Acceptance criteria

- [ ] `swift test` covers schema migrations forward, writer round-trip, and sweeper behavior with a seeded 31-day-old fixture.
- [ ] DB file is created at first daemon launch with WAL files.
- [ ] No unbounded growth under a 24h soak test (run via a `tests/e2e/soak.sh` harness).
