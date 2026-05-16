# `packages/schema`

Shared SQLite schema and XPC IPC message schema for `mydata`.

## SQLite schema

The `migrations/` directory is the **single source of truth** for the on-disk
schema. Migrations are:

- **Forward-only.** There are no down migrations. Schema mistakes are corrected
  by a new forward migration.
- **Applied in lexical order** by the daemon's `Migrator`. Files are named
  `NNNN_description.sql` (four-digit zero-padded version, snake_case label).
- **Self-contained.** Each migration is responsible for updating
  `meta.schema_version` as part of its statements.

The current baseline is `0001_initial.sql` (tables: `apps`, `flows`,
`dns_queries`, `exclusions`, `meta`).

## Swift bindings

Row structs that mirror the schema live in
`Swift/Sources/MydataIPC/SchemaRows.swift` (`FlowRow`, `DNSQueryRow`). They are
hand-written for now and kept in sync with the migrations by review.

## TypeScript bindings / YAML codegen

Deferred to a follow-up issue. The UI does not consume these types yet.

## IPC

The XPC wire format between the extension and the daemon is documented in
`ipc.md`. Codec implementation: `Swift/Sources/MydataIPC/IPCCodec.swift`.
