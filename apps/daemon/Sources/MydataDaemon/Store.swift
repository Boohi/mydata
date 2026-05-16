import Foundation
import SQLite3

/// Sentinel passed to sqlite3_bind_* to indicate that SQLite should make its
/// own copy of the bound data. SQLite expects `SQLITE_TRANSIENT` to be a
/// specific magic pointer, which the C macro defines as `(sqlite3_destructor_type)-1`.
let SQLITE_TRANSIENT = unsafeBitCast(
    OpaquePointer(bitPattern: -1),
    to: sqlite3_destructor_type.self
)

/// Errors thrown by ``Store`` for low-level SQLite failures.
public enum StoreError: Error, CustomStringConvertible {
    case open(Int32, String)
    case prepare(Int32, String)
    case step(Int32, String)
    case bind(Int32, String)

    public var description: String {
        switch self {
        case let .open(rc, msg):    return "Store.open failed rc=\(rc): \(msg)"
        case let .prepare(rc, msg): return "Store.prepare failed rc=\(rc): \(msg)"
        case let .step(rc, msg):    return "Store.step failed rc=\(rc): \(msg)"
        case let .bind(rc, msg):    return "Store.bind failed rc=\(rc): \(msg)"
        }
    }
}

/// Thin wrapper around a single SQLite connection opened in WAL mode.
///
/// Not thread-safe. The daemon is the single writer, and Store instances are
/// expected to be confined to a serial actor or dispatch queue (Writer /
/// Sweeper). Callers must serialize access externally.
public final class Store {
    public let path: String
    private var db: OpaquePointer?

    /// Opens (or creates) a SQLite database at `path` and configures WAL +
    /// safe pragmas.
    public init(path: String) throws {
        self.path = path
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let rc = sqlite3_open_v2(path, &handle, flags, nil)
        guard rc == SQLITE_OK, let opened = handle else {
            let msg = handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            if let h = handle { sqlite3_close(h) }
            throw StoreError.open(rc, msg)
        }
        self.db = opened

        do {
            try runSQL("PRAGMA journal_mode=WAL;")
            try runSQL("PRAGMA busy_timeout=5000;")
            try runSQL("PRAGMA synchronous=NORMAL;")
            try runSQL("PRAGMA foreign_keys=ON;")
        } catch {
            sqlite3_close(opened)
            self.db = nil
            throw error
        }
    }

    deinit { close() }

    /// Close the underlying connection. Idempotent.
    public func close() {
        if let handle = db {
            sqlite3_close(handle)
            self.db = nil
        }
    }

    /// Execute one or more SQL statements with no result set.
    public func runSQL(_ sql: String) throws {
        guard let handle = db else {
            throw StoreError.step(SQLITE_MISUSE, "database is closed")
        }
        var err: UnsafeMutablePointer<CChar>?
        let rc = sqlite3_exec(handle, sql, nil, nil, &err)
        if rc != SQLITE_OK {
            let msg = err.map { String(cString: $0) } ?? String(cString: sqlite3_errmsg(handle))
            if let e = err { sqlite3_free(e) }
            throw StoreError.step(rc, msg)
        }
    }

    /// Prepare a statement. The caller is responsible for `sqlite3_finalize`.
    public func prepare(_ sql: String) throws -> OpaquePointer {
        guard let handle = db else {
            throw StoreError.prepare(SQLITE_MISUSE, "database is closed")
        }
        var stmt: OpaquePointer?
        let rc = sqlite3_prepare_v2(handle, sql, -1, &stmt, nil)
        guard rc == SQLITE_OK, let s = stmt else {
            let msg = String(cString: sqlite3_errmsg(handle))
            throw StoreError.prepare(rc, msg)
        }
        return s
    }

    /// Read a value from the `meta` key/value table. Returns nil if missing.
    public func metaGet(_ key: String) throws -> String? {
        let stmt = try prepare("SELECT value FROM meta WHERE key = ?1;")
        defer { sqlite3_finalize(stmt) }
        let brc = sqlite3_bind_text(stmt, 1, key, -1, SQLITE_TRANSIENT)
        if brc != SQLITE_OK {
            throw StoreError.bind(brc, errmsg())
        }
        let rc = sqlite3_step(stmt)
        switch rc {
        case SQLITE_ROW:
            guard let cstr = sqlite3_column_text(stmt, 0) else { return nil }
            return String(cString: cstr)
        case SQLITE_DONE:
            return nil
        default:
            throw StoreError.step(rc, errmsg())
        }
    }

    /// Upsert a value into the `meta` key/value table.
    public func metaSet(_ key: String, _ value: String) throws {
        let stmt = try prepare(
            "INSERT INTO meta(key,value) VALUES(?1,?2) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
        )
        defer { sqlite3_finalize(stmt) }
        var brc = sqlite3_bind_text(stmt, 1, key, -1, SQLITE_TRANSIENT)
        if brc != SQLITE_OK {
            throw StoreError.bind(brc, errmsg())
        }
        brc = sqlite3_bind_text(stmt, 2, value, -1, SQLITE_TRANSIENT)
        if brc != SQLITE_OK {
            throw StoreError.bind(brc, errmsg())
        }
        let rc = sqlite3_step(stmt)
        guard rc == SQLITE_DONE else {
            throw StoreError.step(rc, errmsg())
        }
    }

    /// Number of rows changed by the most recent INSERT/UPDATE/DELETE.
    public func changes() -> Int {
        guard let handle = db else { return 0 }
        return Int(sqlite3_changes(handle))
    }

    private func errmsg() -> String {
        guard let handle = db else { return "database is closed" }
        return String(cString: sqlite3_errmsg(handle))
    }
}
