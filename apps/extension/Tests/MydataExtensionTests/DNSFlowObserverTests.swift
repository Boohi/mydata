import XCTest
import MydataIPC
@testable import MydataExtension

final class DNSFlowObserverTests: XCTestCase {
    private func query(_ id: UInt8) -> Data {
        Data([0, id, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 97, 0, 0, 1, 0, 1])
    }
    private func response(_ id: UInt8) -> Data {
        var data = query(id)
        data[2] = 0x81; data[3] = 0x80; data[7] = 1
        data.append(contentsOf: [0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 1, 0, 4, 192, 0, 2, id])
        return data
    }
    func testPipelinedOutOfOrderResponsesMatchOriginalQueries() {
        var observer = DNSFlowObserver()
        XCTAssertNotNil(observer.query(query(1), timestampNanos: 10))
        XCTAssertNotNil(observer.query(query(2), timestampNanos: 20))
        XCTAssertEqual(observer.response(response(2))?.query.timestampNanos, 20)
        XCTAssertEqual(observer.response(response(1))?.resolvedIPs, ["192.0.2.1"])
        XCTAssertNil(observer.response(response(1)))
        XCTAssertEqual(observer.pendingCount, 0)
    }
    func testUnmatchedTransactionAndQuestionDoNotEmitMetadata() {
        var observer = DNSFlowObserver()
        _ = observer.query(query(1), timestampNanos: 1)
        XCTAssertNil(observer.response(response(2)))
        var wrong = response(1); wrong[13] = 98
        XCTAssertNil(observer.response(wrong))
        XCTAssertNotNil(observer.response(response(1)))
    }
    func testObservationLimitAndIDReuseDisableMetadataOnly() {
        var observer = DNSFlowObserver(maximumPending: 1)
        _ = observer.query(query(1), timestampNanos: 1)
        XCTAssertNil(observer.query(query(2), timestampNanos: 2))
        XCTAssertEqual(observer.pendingCount, 0)
        XCTAssertNil(observer.response(response(1)))
        var reused = DNSFlowObserver()
        _ = reused.query(query(1), timestampNanos: 1)
        XCTAssertNil(reused.query(query(1), timestampNanos: 2))
        XCTAssertNil(reused.response(response(1)))
    }
}
