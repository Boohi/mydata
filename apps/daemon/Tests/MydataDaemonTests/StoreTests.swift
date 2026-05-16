import XCTest
@testable import MydataDaemon

final class StoreTests: XCTestCase {

    func test_open_createsWALFiles() throws {
        let path = NSTemporaryDirectory() + "mydata-store-\(UUID().uuidString).db"
        defer {
            for suffix in ["", "-wal", "-shm"] {
                try? FileManager.default.removeItem(atPath: path + suffix)
            }
        }

        let store = try Store(path: path)
        try store.runSQL("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);")
        try store.runSQL("INSERT INTO t (v) VALUES ('hello');")

        XCTAssertTrue(FileManager.default.fileExists(atPath: path), "db file should exist")
        XCTAssertTrue(FileManager.default.fileExists(atPath: path + "-wal"), "WAL file should exist")
        XCTAssertTrue(FileManager.default.fileExists(atPath: path + "-shm"), "shm file should exist")

        store.close()
    }
}
