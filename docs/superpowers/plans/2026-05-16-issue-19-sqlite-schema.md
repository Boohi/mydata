# Issue #19 — SQLite schema, writer, retention sweeper

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Persist incoming flow events to `~/Library/Application Support/mydata/events.db` and sweep records older than the retention window.

**Architecture:** `Store` (raw sqlite3 wrapper, WAL, busy_timeout=5s), `Migrator` (applies versioned `.sql` files from the daemon resource bundle, tracks via `meta.schema_version`), `Writer` actor (batches 10 events or 250 ms), `Sweeper` (every 10 min, deletes rows older than `meta.retention_days`, default 30). All in the `MydataDaemon` library; the executable wires them together. Migration SQL in `packages/schema/migrations/` is authoritative — a CI check enforces the daemon's bundled copy stays in sync.

**Tech Stack:** Swift 5.9, `import SQLite3` (system sqlite, no SPM deps), XCTest, bash soak harness.

**Scope notes:** Issue body lists `#5` (DNS events) as a dependency. The schema includes an empty `dns_queries` table per spec, but the writer only handles `flowStarted` / `flowEnded` in this slice — that is all the IPC currently emits. DNS row writes follow when #18 lands.

---

### Task 1: Schema migration + Swift row structs

**Files:**
- Create: `packages/schema/migrations/0001_initial.sql`
- Create: `packages/schema/Swift/Sources/MydataIPC/SchemaRows.swift`
- Modify: `packages/schema/README.md`

- [ ] **Step 1: Write `0001_initial.sql`** with tables `apps`, `flows`, `dns_queries`, `exclusions`, `meta`. Forward-only. Schema:
  - `apps(bundle_id PK, name, first_seen)`
  - `flows(id PK, flow_id, started_ns, ended_ns NULL, family, protocol, src_addr BLOB(16), src_port, dst_addr BLOB(16), dst_port, bundle_id FK NULL, country NULL, asn NULL)` + indexes on `started_ns` and `flow_id`
  - `dns_queries(id PK, ts_ns, query_name, qtype, rcode NULL, bundle_id FK NULL)` + index on `ts_ns`
  - `exclusions(id PK, pattern UNIQUE, kind, created_at)`
  - `meta(key PK, value)` seeded with `('schema_version','1')` and `('retention_days','30')`
  - `PRAGMA foreign_keys = ON;` at top.
- [ ] **Step 2: Update `packages/schema/README.md`** to note migrations dir is authoritative, forward-only, applied in lexical order; row structs in `MydataIPC/SchemaRows.swift`; YAML/TS codegen deferred.
- [ ] **Step 3: Add `SchemaRows.swift`** with public `FlowRow` and `DNSQueryRow` Sendable Equatable structs covering all schema columns. Address blobs as `[UInt8]` (16 bytes). Mark all fields `var` to make construction easy.
- [ ] **Step 4: Commit** `schema: initial migration + Swift row structs (#19)`.

---

### Task 2: Store (sqlite wrapper) — WAL, busy_timeout, helpers

**Files:**
- Create: `apps/daemon/Sources/MydataDaemon/Store.swift`
- Create: `apps/daemon/Tests/MydataDaemonTests/StoreTests.swift`

- [ ] **Step 1: Failing test** `test_open_createsWALFiles` opens a temp DB, runs a no-op CREATE+INSERT, and asserts `path`, `path-wal`, `path-shm` all exist.
- [ ] **Step 2: Run** `swift test --package-path apps/daemon --filter StoreTests` — expect build failure.
- [ ] **Step 3: Implement `Store`** as `public final class` holding `OpaquePointer?`. Use `sqlite3_open_v2(SQLITE_OPEN_READWRITE|CREATE|FULLMUTEX)`. After open, run `PRAGMA journal_mode=WAL`, `PRAGMA busy_timeout=5000`, `PRAGMA synchronous=NORMAL`, `PRAGMA foreign_keys=ON`. Public API: `path`, `close()`, `runSQL(_ sql: String) throws` (uses `sqlite3_exec`), `prepare(_ sql: String) throws -> OpaquePointer`, `metaGet(_ key:) throws -> String?`, `metaSet(_ key:_ value:) throws`, `changes() -> Int` (wraps `sqlite3_changes`). Define module-level `SQLITE_TRANSIENT = unsafeBitCast(OpaquePointer(bitPattern: -1), to: sqlite3_destructor_type.self)`. Errors as `StoreError` enum (`open`, `prepare`, `step`, `bind` with code+message).
- [ ] **Step 4: Verify** test passes.
- [ ] **Step 5: Commit** `daemon: SQLite Store wrapper with WAL + busy_timeout (#19)`.

---

### Task 3: Migrator applies versioned `.sql` files

**Files:**
- Create: `apps/daemon/Sources/MydataDaemon/Migrator.swift`
- Create: `apps/daemon/Tests/MydataDaemonTests/MigratorTests.swift`
- Create: `apps/daemon/Sources/MydataDaemon/Migrations/0001_initial.sql` (copy of `packages/schema/migrations/0001_initial.sql`)
- Create: `tests/check-migrations-mirror.sh`
- Modify: `apps/daemon/Package.swift`

- [ ] **Step 1: Mirror migrations into target dir**:
  ```bash
  mkdir -p apps/daemon/Sources/MydataDaemon/Migrations
  cp packages/schema/migrations/0001_initial.sql apps/daemon/Sources/MydataDaemon/Migrations/0001_initial.sql
  ```
- [ ] **Step 2: Edit `apps/daemon/Package.swift`** — change the `MydataDaemon` target to include `resources: [.copy("Migrations")]`.
- [ ] **Step 3: Write `tests/check-migrations-mirror.sh`**:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  diff -r packages/schema/migrations apps/daemon/Sources/MydataDaemon/Migrations
  ```
  `chmod +x`. SPM forbids resource paths outside the target dir, so we duplicate the file and have CI enforce no drift. A build plugin can replace this later.
- [ ] **Step 4: Failing test** `test_migrate_appliesInitialMigrationOnce`: open temp DB, run `Migrator(store:).migrate()`, assert `metaGet("schema_version") == "1"`. Run migrate a second time — still "1" (idempotent). Insert one `apps` row and read it back to prove the schema is real.
- [ ] **Step 5: Implement `Migrator`** as `public struct` with `store: Store`, `bundle: Bundle = .module`. `migrate()` reads `metaGet("schema_version")` as Int (default 0), lists `<bundle>/Migrations/*.sql`, parses leading 4-digit version from each filename, sorts ascending, applies any with version > current inside a `BEGIN/COMMIT` (rollback on error). Each migration is responsible for updating `meta.schema_version`; trust the SQL.
- [ ] **Step 6: Verify** tests pass.
- [ ] **Step 7: Commit** `daemon: Migrator applies versioned SQL migrations + CI mirror check (#19)`.

---

### Task 4: Writer actor — batched inserts

**Files:**
- Create: `apps/daemon/Sources/MydataDaemon/Writer.swift`
- Create: `apps/daemon/Tests/MydataDaemonTests/WriterTests.swift`

- [ ] **Step 1: Failing tests**:
  - `test_flowStartedThenEnded_writesOneRow`: append `flowStarted(flowId=42, ts=1e9)` then `flowEnded(flowId=42, ts=2e9)`, force flush, assert one row with `started_ns=1e9`, `ended_ns=2e9`.
  - `test_batch_flushesAt10Events`: `batchSize=10`, `flushInterval=.seconds(60)`, append 10 `flowStarted`, sleep 100 ms, assert `COUNT(*)==10`.
- [ ] **Step 2: Run** — expect failure.
- [ ] **Step 3: Implement `Writer`** as `public actor`. Init: `store`, `batchSize=10`, `flushInterval=.milliseconds(250)`. Holds `pending: [IPCMessage]` and a `flushTask: Task<Void,Never>?`. API:
  - `start()` — launches a loop that sleeps `flushInterval` then calls `flush()`. Idempotent.
  - `stop()` — cancels and nils the task.
  - `append(_ msg:)` — switch on type. For `flowStarted`/`flowEnded` append to `pending`, if `pending.count >= batchSize` call `flushNow()`. Ignore ping/pong/unknown.
  - `flush()` — public wrapper around `flushNow()`.
  - Private `flushNow()` — if empty return; take batch, clear pending, `try writeBatch(batch)`; on failure write to stderr and re-insert at front of `pending`.
  - Private `writeBatch(_ batch:)` — `BEGIN IMMEDIATE`, prepare INSERT statement and UPDATE statement once, iterate:
    - `flowStarted(p)`: bind+step INSERT, `sqlite3_reset` after.
    - `flowEnded(p)`: bind+step UPDATE matching `flow_id=? AND ended_ns IS NULL`. If `store.changes() == 0`, fall back to INSERT with both `started_ns` and `ended_ns` set to the ended timestamp (so orphaned end events still record).
    - `COMMIT` on success, `ROLLBACK` on throw.
  - `bindFlow(stmt, payload, endedNs)` helper: column order matches the INSERT (flow_id, started_ns, ended_ns, family, protocol, src_addr blob, src_port, dst_addr blob, dst_port). Use `Int64(bitPattern:)` for `flowId: UInt64`. Address bytes via `withUnsafeBufferPointer { sqlite3_bind_blob(... , SQLITE_TRANSIENT) }`.
- [ ] **Step 4: Verify** tests pass.
- [ ] **Step 5: Commit** `daemon: batched Writer actor with start/end flow correlation (#19)`.

---

### Task 5: Sweeper — periodic retention deletion

**Files:**
- Create: `apps/daemon/Sources/MydataDaemon/Sweeper.swift`
- Create: `apps/daemon/Tests/MydataDaemonTests/SweeperTests.swift`

- [ ] **Step 1: Failing test** `test_sweep_deletes31DayOldFlows_keepsRecent`: migrate, insert one flow with `started_ns = now - 31 days` and one with `now - 1 day`, call `Sweeper(store: store).sweepOnce(nowNs:)`, assert only the recent row remains.
- [ ] **Step 2: Run** — expect failure.
- [ ] **Step 3: Implement `Sweeper`** as `public final class`. Init: `store`, `interval: TimeInterval = 600`. Holds `DispatchSourceTimer?`. `start()` schedules repeating timer that calls `sweepOnce(nowNs: now)`; idempotent. `stop()` cancels timer. `sweepOnce(nowNs:) throws`: reads `retention_days` from meta (default 30), computes `cutoffNs = nowNs - days * 86400 * 1e9`, `BEGIN IMMEDIATE`, deletes from `flows` and `dns_queries` where their timestamp column < cutoff, `COMMIT` (rollback on error).
- [ ] **Step 4: Verify** test passes.
- [ ] **Step 5: Commit** `daemon: retention sweeper (#19)`.

---

### Task 6: Wire it all into `mydata-daemon`

**Files:**
- Modify: `apps/daemon/Sources/mydata-daemon/main.swift`

- [ ] **Step 1: Update main**:
  - Compute `supportDir = ~/Library/Application Support/mydata/` and `mkdir -p`.
  - Resolve `socketPath` from `MYDATA_SOCK` env or `supportDir/daemon.sock`.
  - Resolve `dbPath` from `MYDATA_DB` env or `supportDir/events.db`.
  - Open `Store`, `try Migrator(store:).migrate()`, construct `Writer(store:)`, `Sweeper(store:)`.
  - `Task { await writer.start() }`, `sweeper.start()`.
  - Listener sink writes the printer line to stdout (kept for observability) AND `Task { await writer.append(message) }`.
  - Exit non-zero with stderr message if store/migrate fail.
- [ ] **Step 2: Smoke test**:
  ```bash
  swift build --package-path apps/daemon
  MYDATA_SOCK=/tmp/mydata-smoke.sock MYDATA_DB=/tmp/mydata-smoke.db .build/debug/mydata-daemon &
  sleep 1
  ls -la /tmp/mydata-smoke.db /tmp/mydata-smoke.db-wal /tmp/mydata-smoke.db-shm
  kill %1 || true
  rm -f /tmp/mydata-smoke.sock /tmp/mydata-smoke.db*
  ```
  Expect: all three DB files present.
- [ ] **Step 3: Commit** `daemon: persist flows to SQLite, run sweeper (#19)`.

---

### Task 7: Soak harness + CI

**Files:**
- Create: `tests/e2e/soak.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/build.md`

- [ ] **Step 1: Write `tests/e2e/soak.sh`** (chmod +x):
  - Default `SOAK_MINUTES=5` (CI smoke); README documents `SOAK_MINUTES=1440` for the real 24h soak.
  - Build daemon, start in temp dir with `MYDATA_SOCK` + `MYDATA_DB` pointing at the temp dir, set `retention_days=0` via `sqlite3`.
  - If `tests/e2e/loopback-talker.mjs` is not present, echo a skip notice and exit 0 (talker is a future deliverable).
  - Otherwise loop until time budget exhausted, driving the talker in bursts of 50 events with 5 s gaps. Track max `COUNT(*) FROM flows` seen; fail if it ever exceeds 100k.
  - trap to kill the daemon and clean temp dir on exit.
- [ ] **Step 2: CI** — in `.github/workflows/ci.yml`, in the `swift` job: add `bash tests/check-migrations-mirror.sh` step, and confirm `swift test --package-path apps/daemon` is already invoked. Add it if missing.
- [ ] **Step 3: Docs** — append a short `## Soak test` section to `docs/build.md` explaining the harness, env knobs, and the 24h target.
- [ ] **Step 4: Verify**:
  ```bash
  swift test --package-path apps/daemon
  bash tests/check-migrations-mirror.sh
  SOAK_MINUTES=1 bash tests/e2e/soak.sh
  ```
- [ ] **Step 5: Commit** `ci: migrations mirror check + soak harness (#19)`.

---

### Task 8: PR

- [ ] **Step 1: Push and create PR**:
  ```bash
  git push -u origin 19-sqlite-schema
  gh pr create --base main \
    --title "Daemon SQLite store: schema, batched writer, retention sweeper (#19)"
  ```
  PR body: summary bullets (schema migration; daemon opens events.db WAL+busy_timeout=5s at launch; Writer batches 10/250ms; Sweeper every 10 min; soak harness; CI mirror check). Acceptance checkboxes. Scope notes about DNS waiting on #18 and enrichment columns waiting on #20. `Closes #19.`
- [ ] **Step 2: Wait for CI** with `gh pr checks --watch`.
