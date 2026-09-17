import XCTest
@testable import MydataExtension

final class DNSTCPRelayTests: XCTestCase {
    final class Transport: DNSTCPTransport {
        var clientReads: [(Data?, Error?) -> Void] = []
        var upstreamReads: [(Data?, Bool, Error?) -> Void] = []
        var sent: [Data] = []
        var delivered: [Data] = []
        var finalWrites = 0
        var cancellations = 0
        var closedReads = 0
        var closedWrites = 0
        var sendError: Error?
        func readClient(_ completion: @escaping (Data?, Error?) -> Void) { clientReads.append(completion) }
        func readUpstream(_ completion: @escaping (Data?, Bool, Error?) -> Void) { upstreamReads.append(completion) }
        func writeUpstream(_ data: Data?, isComplete: Bool, completion: @escaping (Error?) -> Void) {
            if let data { sent.append(data) }
            if isComplete { finalWrites += 1 }
            completion(sendError)
        }
        func writeClient(_ data: Data, completion: @escaping (Error?) -> Void) { delivered.append(data); completion(nil) }
        func closeClientRead(_ error: Error?) { closedReads += 1 }
        func closeClientWrite(_ error: Error?) { closedWrites += 1 }
        func cancel() { cancellations += 1 }
    }
    func testNoReadsBeforeStartAndByteExactIndependentPumps() {
        let transport = Transport()
        let relay = DNSTCPRelay(transport: transport)
        XCTAssertEqual(transport.clientReads.count, 0)
        relay.start()
        let fragments = [Data([0]), Data([5, 255, 254]), Data([1, 2, 3, 0, 1, 4])]
        for fragment in fragments { transport.clientReads.removeFirst()(fragment, nil) }
        XCTAssertEqual(transport.sent, fragments) // metadata-invalid bytes still forwarded
        XCTAssertEqual(transport.clientReads.count, 1) // pipelining does not wait for a reply
        for fragment in fragments { transport.upstreamReads.removeFirst()(fragment, false, nil) }
        XCTAssertEqual(transport.delivered, fragments)
        relay.stop()
    }
    func testClientHalfCloseKeepsPartialResponseAlive() {
        let transport = Transport()
        let relay = DNSTCPRelay(transport: transport)
        relay.start()
        transport.clientReads.removeFirst()(Data(), nil)
        XCTAssertEqual(transport.finalWrites, 1)
        XCTAssertEqual(transport.cancellations, 0)
        transport.upstreamReads.removeFirst()(Data([0]), false, nil)
        transport.upstreamReads.removeFirst()(Data([1, 7]), true, nil)
        XCTAssertEqual(transport.delivered, [Data([0]), Data([1, 7])])
        XCTAssertEqual(transport.cancellations, 1)
        XCTAssertEqual(transport.closedReads, 1)
        XCTAssertEqual(transport.closedWrites, 1)
    }
    func testErrorAndRepeatedStopCloseExactlyOnce() {
        let transport = Transport()
        let relay = DNSTCPRelay(transport: transport)
        relay.start()
        transport.sendError = NSError(domain: "synthetic", code: 1)
        transport.clientReads.removeFirst()(Data([1]), nil)
        relay.stop()
        transport.upstreamReads.removeFirst()(Data([9]), false, nil)
        XCTAssertEqual(transport.cancellations, 1)
        XCTAssertEqual(transport.closedReads, 1)
        XCTAssertEqual(transport.closedWrites, 1)
        XCTAssertEqual(transport.delivered, [])
    }
}
