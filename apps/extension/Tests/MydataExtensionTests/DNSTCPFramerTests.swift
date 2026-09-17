import XCTest
@testable import MydataExtension

final class DNSTCPFramerTests: XCTestCase {
    func testSplitLengthAndBodyThenCoalescedNextFrame() {
        var observer = DNSTCPFramer()
        XCTAssertEqual(observer.append(Data([0])), [])
        XCTAssertEqual(observer.append(Data([3, 1])), [])
        XCTAssertEqual(observer.append(Data([2, 3, 0, 2, 4, 5])), [Data([1, 2, 3]), Data([4, 5])])
        XCTAssertEqual(observer.bufferedByteCount, 0)
    }

    func testEverySplitOfTwoFramesPreservesMessages() {
        let bytes = Data([0, 3, 1, 2, 3, 0, 2, 4, 5])
        for split in 0...bytes.count {
            var observer = DNSTCPFramer()
            let messages = observer.append(Data(bytes.prefix(split))) + observer.append(Data(bytes.dropFirst(split)))
            XCTAssertEqual(messages, [Data([1, 2, 3]), Data([4, 5])])
        }
    }

    func testOversizeObservationSkipsFrameWithoutLosingFollowingFrame() {
        var observer = DNSTCPFramer(maximumMessageBytes: 3)
        XCTAssertEqual(observer.append(Data([0, 5, 1, 2])), [])
        XCTAssertLessThanOrEqual(observer.bufferedByteCount, 3)
        XCTAssertEqual(observer.append(Data([3, 4, 5, 0, 2, 8, 9])), [Data([8, 9])])
    }

    func testEmptyFrameAndIncompleteEOFDoNotEmitPartialMessage() {
        var observer = DNSTCPFramer()
        XCTAssertEqual(observer.append(Data([0, 0, 0, 4, 1, 2])), [])
        XCTAssertEqual(observer.append(Data()), [])
        XCTAssertLessThanOrEqual(observer.bufferedByteCount, 65535)
    }
}
