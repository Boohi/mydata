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
        XCTAssertEqual(try store.metaGet("schema_version"), "1")

        // Idempotent: running again does not change version or fail.
        try migrator.migrate()
        XCTAssertEqual(try store.metaGet("schema_version"), "1")

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
}
