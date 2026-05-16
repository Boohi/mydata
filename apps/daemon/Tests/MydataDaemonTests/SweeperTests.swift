import XCTest
import SQLite3
@testable import MydataDaemon

final class SweeperTests: XCTestCase {

    private func makeStore() throws -> (Store, String) {
        let path = NSTemporaryDirectory() + "mydata-sweeper-\(UUID().uuidString).db"
        let store = try Store(path: path)
        try Migrator(store: store).migrate()
        return (store, path)
    }

    private func cleanup(_ path: String) {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    private func insertFlow(_ store: Store, flowId: Int64, startedNs: Int64) throws {
        let stmt = try store.prepare(
            "INSERT INTO flows(flow_id, started_ns, family, protocol, src_addr, src_port, dst_addr, dst_port) " +
            "VALUES(?1, ?2, 4, 6, zeroblob(16), 1, zeroblob(16), 2);"
        )
        defer { sqlite3_finalize(stmt) }
        XCTAssertEqual(sqlite3_bind_int64(stmt, 1, flowId), SQLITE_OK)
        XCTAssertEqual(sqlite3_bind_int64(stmt, 2, startedNs), SQLITE_OK)
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_DONE)
    }

    func test_sweep_deletes31DayOldFlows_keepsRecent() throws {
        let (store, path) = try makeStore()
        defer { store.close(); cleanup(path) }

        let nowNs = Int64(Date().timeIntervalSince1970 * 1_000_000_000)
        let oldNs = nowNs - 31 * 86_400 * 1_000_000_000
        let recentNs = nowNs - 1 * 86_400 * 1_000_000_000

        try insertFlow(store, flowId: 1, startedNs: oldNs)
        try insertFlow(store, flowId: 2, startedNs: recentNs)

        try Sweeper(store: store).sweepOnce(nowNs: nowNs)

        let stmt = try store.prepare("SELECT flow_id FROM flows ORDER BY flow_id;")
        defer { sqlite3_finalize(stmt) }
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(stmt, 0), 2)
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_DONE)
    }
}
