import XCTest
import SQLite3
import MydataIPC
@testable import MydataDaemon

final class WriterTests: XCTestCase {

    private func makeStore() throws -> (Store, String) {
        let path = NSTemporaryDirectory() + "mydata-writer-\(UUID().uuidString).db"
        let store = try Store(path: path)
        try Migrator(store: store).migrate()
        return (store, path)
    }

    private func cleanup(_ path: String) {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    private func loopbackIPv4() throws -> IPCAddress {
        try IPCAddress.ipv4("127.0.0.1")
    }

    func test_flowStartedThenEnded_writesOneRow() async throws {
        let (store, path) = try makeStore()
        defer { store.close(); cleanup(path) }

        let writer = Writer(store: store, batchSize: 1, flushInterval: .milliseconds(50))
        await writer.start()
        defer { Task { await writer.stop() } }

        let src = try IPCAddress.ipv4("10.0.0.1")
        let dst = try IPCAddress.ipv4("1.1.1.1")
        let start = FlowEventPayload(
            flowId: 42,
            timestampNanos: 1_000_000_000,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 1234,
            destPort: 443,
            sourceAddress: src,
            destAddress: dst
        )
        let end = FlowEventPayload(
            flowId: 42,
            timestampNanos: 2_000_000_000,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 1234,
            destPort: 443,
            sourceAddress: src,
            destAddress: dst
        )

        await writer.append(.flowStarted(start))
        await writer.append(.flowEnded(end))
        await writer.flush()

        let stmt = try store.prepare("SELECT flow_id, started_ns, ended_ns FROM flows;")
        defer { sqlite3_finalize(stmt) }
        let rc = sqlite3_step(stmt)
        XCTAssertEqual(rc, SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(stmt, 0), 42)
        XCTAssertEqual(sqlite3_column_int64(stmt, 1), 1_000_000_000)
        XCTAssertEqual(sqlite3_column_int64(stmt, 2), 2_000_000_000)
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_DONE)
    }

    func testWritesDNSRow() async throws {
        let (store, path) = try makeStore()
        defer { store.close(); cleanup(path) }

        let writer = Writer(store: store, batchSize: 1, flushInterval: .milliseconds(10))
        await writer.start()
        defer { Task { await writer.stop() } }

        let payload = DNSQueryPayload(timestampNanos: 1_700_000_000_000_000_000, qtype: 1, qname: "example.com")
        await writer.append(.dnsQueried(payload))
        try await Task.sleep(for: .milliseconds(200))

        let stmt = try store.prepare("SELECT ts_ns, query_name, qtype FROM dns_queries")
        defer { sqlite3_finalize(stmt) }
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(stmt, 0), 1_700_000_000_000_000_000)
        XCTAssertEqual(String(cString: sqlite3_column_text(stmt, 1)), "example.com")
        XCTAssertEqual(sqlite3_column_int(stmt, 2), 1)
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_DONE)
    }

    func test_batch_flushesAt10Events() async throws {
        let (store, path) = try makeStore()
        defer { store.close(); cleanup(path) }

        let writer = Writer(store: store, batchSize: 10, flushInterval: .seconds(60))
        await writer.start()
        defer { Task { await writer.stop() } }

        let src = try loopbackIPv4()
        let dst = try loopbackIPv4()
        for i in 0..<10 {
            let p = FlowEventPayload(
                flowId: UInt64(i),
                timestampNanos: Int64(i) * 1000,
                family: .ipv4,
                protocolNumber: 17,
                sourcePort: 1,
                destPort: 2,
                sourceAddress: src,
                destAddress: dst
            )
            await writer.append(.flowStarted(p))
        }

        try await Task.sleep(for: .milliseconds(100))

        let stmt = try store.prepare("SELECT COUNT(*) FROM flows;")
        defer { sqlite3_finalize(stmt) }
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(stmt, 0), 10)
    }
}
