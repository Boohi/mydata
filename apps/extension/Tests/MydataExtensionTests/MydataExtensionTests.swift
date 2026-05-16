import XCTest
@testable import MydataExtension

final class FlowEventTests: XCTestCase {
    func testStartLogLineIncludesDirectionAndEndpoints() {
        let event = FlowEvent(
            phase: .start,
            sourceEndpoint: "127.0.0.1:54321",
            remoteEndpoint: "1.1.1.1:443",
            protocolName: "tcp",
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let line = event.logLine
        XCTAssertTrue(line.contains("phase=start"), "got: \(line)")
        XCTAssertTrue(line.contains("src=127.0.0.1:54321"), "got: \(line)")
        XCTAssertTrue(line.contains("dst=1.1.1.1:443"), "got: \(line)")
        XCTAssertTrue(line.contains("proto=tcp"), "got: \(line)")
    }

    func testEndLogLineUsesEndPhase() {
        let event = FlowEvent(
            phase: .end,
            sourceEndpoint: "127.0.0.1:54321",
            remoteEndpoint: "1.1.1.1:443",
            protocolName: "tcp",
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
        XCTAssertTrue(event.logLine.contains("phase=end"))
    }

    func testLogLineIsSingleLine() {
        let event = FlowEvent(
            phase: .start,
            sourceEndpoint: "a",
            remoteEndpoint: "b",
            protocolName: "tcp",
            timestamp: Date()
        )
        XCTAssertFalse(event.logLine.contains("\n"))
    }
}

import MydataIPC

final class IPCClientBackoffTests: XCTestCase {
    func testBackoffDoubles() {
        XCTAssertEqual(IPCClient.nextBackoff(current: 0.1, cap: 5.0), 0.2, accuracy: 0.001)
        XCTAssertEqual(IPCClient.nextBackoff(current: 1.0, cap: 5.0), 2.0, accuracy: 0.001)
    }

    func testBackoffCapsAtFiveSeconds() {
        XCTAssertEqual(IPCClient.nextBackoff(current: 4.0, cap: 5.0), 5.0, accuracy: 0.001)
        XCTAssertEqual(IPCClient.nextBackoff(current: 10.0, cap: 5.0), 5.0, accuracy: 0.001)
    }
}
