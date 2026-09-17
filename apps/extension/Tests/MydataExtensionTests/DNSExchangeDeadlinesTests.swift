import XCTest
@testable import MydataExtension

final class DNSExchangeDeadlinesTests: XCTestCase {
    func testFastCompletionLeavesNoPendingTimeoutWork() {
        var deadlines = DNSExchangeDeadlines<Int>(capacity: 64)
        for request in 0..<10000 {
            XCTAssertTrue(deadlines.insert(request, deadline: 15))
            deadlines.remove(request)
        }
        XCTAssertEqual(deadlines.count, 0)
        XCTAssertEqual(deadlines.expire(at: 20), [])
    }
    func testCapacityAndExpiryTrackOnlyLiveExchanges() {
        var deadlines = DNSExchangeDeadlines<Int>(capacity: 2)
        XCTAssertTrue(deadlines.insert(1, deadline: 10))
        XCTAssertTrue(deadlines.insert(2, deadline: 20))
        XCTAssertFalse(deadlines.insert(3, deadline: 30))
        XCTAssertEqual(deadlines.expire(at: 9), [])
        XCTAssertEqual(deadlines.expire(at: 10), [1])
        XCTAssertTrue(deadlines.insert(3, deadline: 30))
        deadlines.remove(2)
        XCTAssertEqual(deadlines.expire(at: 30), [3])
        XCTAssertEqual(deadlines.count, 0)
    }
}
