-- PRAGMA foreign_keys is set by Store at connection time; not repeated here
-- because pragma statements inside an explicit transaction are no-ops.

CREATE TABLE IF NOT EXISTS apps (
    bundle_id  TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    first_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id    INTEGER NOT NULL,
    started_ns INTEGER NOT NULL,
    ended_ns   INTEGER,
    family     INTEGER NOT NULL,
    protocol   INTEGER NOT NULL,
    src_addr   BLOB NOT NULL,
    src_port   INTEGER NOT NULL,
    dst_addr   BLOB NOT NULL,
    dst_port   INTEGER NOT NULL,
    bundle_id  TEXT,
    country    TEXT,
    asn        INTEGER,
    FOREIGN KEY (bundle_id) REFERENCES apps(bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_flows_started_ns ON flows(started_ns);
CREATE INDEX IF NOT EXISTS idx_flows_flow_id    ON flows(flow_id);

CREATE TABLE IF NOT EXISTS dns_queries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_ns      INTEGER NOT NULL,
    query_name TEXT NOT NULL,
    qtype      INTEGER NOT NULL,
    rcode      INTEGER,
    bundle_id  TEXT,
    FOREIGN KEY (bundle_id) REFERENCES apps(bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_dns_queries_ts_ns ON dns_queries(ts_ns);

CREATE TABLE IF NOT EXISTS exclusions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern    TEXT NOT NULL UNIQUE,
    kind       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO meta (key, value) VALUES ('retention_days', '30');
