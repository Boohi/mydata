import XCTest
import SQLite3
@testable import MydataDaemon

final class MigratorTests: XCTestCase {

    func test_migrate_appliesInitialMigrationOnce() throws {
        let path = NSTemporaryDirectory() + "mydata-migrator-\(UUID().uuidString).db"
        defer {
            for suffix in ["", "-wal", "-shm"] {
                try? FileManager.default.removeItem(atPath: path + suffix)
            }
        }

        let store = try Store(path: path)
        let migrator = Migrator(store: store)

        try migrator.migrate()
        XCTAssertEqual(try store.metaGet("schema_version"), "2")

        // Idempotent: running again does not change version or fail.
        try migrator.migrate()
        XCTAssertEqual(try store.metaGet("schema_version"), "2")

        // Schema exists: insert into apps and read it back via prepare+step.
        try store.runSQL(
            "INSERT INTO apps (bundle_id, name, first_seen) " +
            "VALUES ('com.example.app', 'Example', 1700000000);"
        )

        let stmt = try store.prepare(
            "SELECT bundle_id, name, first_seen FROM apps WHERE bundle_id = 'com.example.app';"
        )
        defer { sqlite3_finalize(stmt) }
        let rc = sqlite3_step(stmt)
        XCTAssertEqual(rc, SQLITE_ROW)
        let bundleId = String(cString: sqlite3_column_text(stmt, 0))
        let name = String(cString: sqlite3_column_text(stmt, 1))
        let firstSeen = sqlite3_column_int64(stmt, 2)
        XCTAssertEqual(bundleId, "com.example.app")
        XCTAssertEqual(name, "Example")
        XCTAssertEqual(firstSeen, 1700000000)

        store.close()
    }
    func testPopulatedVersionOneUpgradePreservesDNSAndFlowRows() throws {
        let path = NSTemporaryDirectory() + "mydata-upgrade-\(UUID().uuidString).db"
        defer {
            for suffix in ["", "-wal", "-shm"] { try? FileManager.default.removeItem(atPath: path + suffix) }
        }
        let store = try Store(path: path)
        defer { store.close() }
        let migrator = Migrator(store: store)
        let root = try XCTUnwrap(migrator.bundle.resourceURL)
        let initial = try String(contentsOf: root.appendingPathComponent("Migrations/0001_initial.sql"), encoding: .utf8)
        try store.runSQL(initial)
        try store.runSQL("INSERT INTO dns_queries(ts_ns,query_name,qtype) VALUES(42,'legacy.example',1)")
        try store.runSQL("INSERT INTO flows(flow_id,started_ns,family,protocol,src_addr,src_port,dst_addr,dst_port) VALUES(7,42,4,17,zeroblob(16),1234,zeroblob(16),53)")
        XCTAssertEqual(try store.metaGet("schema_version"), "1")
        try migrator.migrate()
        try migrator.migrate()
        let dns = try store.prepare("SELECT ts_ns,query_name,event_kind,resolved_ips FROM dns_queries")
        defer { sqlite3_finalize(dns) }
        XCTAssertEqual(sqlite3_step(dns), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(dns, 0), 42)
        XCTAssertEqual(String(cString: sqlite3_column_text(dns, 1)), "legacy.example")
        XCTAssertEqual(String(cString: sqlite3_column_text(dns, 2)), "query")
        XCTAssertEqual(String(cString: sqlite3_column_text(dns, 3)), "[]")
        XCTAssertEqual(sqlite3_step(dns), SQLITE_DONE)
        let flow = try store.prepare("SELECT flow_id,started_ns FROM flows")
        defer { sqlite3_finalize(flow) }
        XCTAssertEqual(sqlite3_step(flow), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(flow, 0), 7)
        XCTAssertEqual(sqlite3_column_int64(flow, 1), 42)
        XCTAssertEqual(sqlite3_step(flow), SQLITE_DONE)
    }

}
