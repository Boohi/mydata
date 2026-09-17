import XCTest
@testable import MydataExtension

final class DNSUDPExchangeTests: XCTestCase {
    final class Transport: DNSUDPTransport {
        var stateFailure: ((Error) -> Void)?
        var sendCompletion: ((Error?) -> Void)?
        var receiveCompletion: ((Data?, Error?) -> Void)?
        var writeCompletion: ((Error?) -> Void)?
        var sent: [Data] = []
        var delivered: [Data] = []
        var cancellations = 0
        func start(_ failed: @escaping (Error) -> Void) { stateFailure = failed }
        func send(_ data: Data, completion: @escaping (Error?) -> Void) { sent.append(data); sendCompletion = completion }
        func receive(_ completion: @escaping (Data?, Error?) -> Void) { receiveCompletion = completion }
        func writeResponse(_ data: Data, completion: @escaping (Error?) -> Void) { delivered.append(data); writeCompletion = completion }
        func cancel() { cancellations += 1 }
    }
    private let failure = NSError(domain: "synthetic", code: 1)

    func testExpiredSendAndStateCallbacksCannotCloseOtherExchange() {
        let expiredTransport = Transport(), liveTransport = Transport()
        var flowFailures = 0
        let expired = DNSUDPExchange(transport: expiredTransport, data: Data([255]), failed: { _ in flowFailures += 1 })
        let live = DNSUDPExchange(transport: liveTransport, data: Data([254]), failed: { _ in flowFailures += 1 })
        XCTAssertEqual(expiredTransport.sent, []) // startup alone has no traffic
        expired.start(); live.start()
        expired.stop() // session timer expires this datagram only
        expiredTransport.sendCompletion?(failure)
        expiredTransport.stateFailure?(failure)
        XCTAssertEqual(flowFailures, 0)
        liveTransport.sendCompletion?(nil)
        liveTransport.receiveCompletion?(Data([1, 2, 3]), nil)
        liveTransport.writeCompletion?(nil)
        XCTAssertEqual(liveTransport.sent, [Data([254])])
        XCTAssertEqual(liveTransport.delivered, [Data([1, 2, 3])])
        XCTAssertEqual(liveTransport.cancellations, 1)
    }

    func testExpiredReceiveAndWriteCallbacksCannotFailFlow() {
        let transport = Transport()
        var failures = 0, finished = 0
        let exchange = DNSUDPExchange(transport: transport, data: Data([255]), failed: { _ in failures += 1 }, finished: { finished += 1 })
        exchange.start()
        transport.sendCompletion?(nil)
        transport.receiveCompletion?(Data([9, 8]), nil)
        exchange.stop()
        transport.writeCompletion?(failure)
        transport.receiveCompletion?(nil, failure)
        transport.stateFailure?(failure)
        exchange.stop()
        XCTAssertEqual(failures, 0)
        XCTAssertEqual(finished, 1)
        XCTAssertEqual(transport.cancellations, 1)
        XCTAssertEqual(transport.delivered, [Data([9, 8])])
    }

    func testLiveFailureClosesExactlyOnceWithoutInventingResponse() {
        let transport = Transport()
        var failures = 0
        let exchange = DNSUDPExchange(transport: transport, data: Data([1]), failed: { _ in failures += 1 })
        exchange.start()
        transport.sendCompletion?(failure)
        transport.stateFailure?(failure)
        XCTAssertEqual(failures, 1)
        XCTAssertEqual(transport.cancellations, 1)
        XCTAssertEqual(transport.delivered, [])
    }
}
