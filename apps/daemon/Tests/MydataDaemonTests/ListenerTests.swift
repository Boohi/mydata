import XCTest
import Network
@testable import MydataDaemon
import MydataIPC

final class ListenerTests: XCTestCase {

    func testPrinterFormatsFlowStartedLine() throws {
        let payload = FlowEventPayload(
            flowId: 7,
            timestampNanos: 1_700_000_000_000_000_000,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 51_000,
            destPort: 443,
            sourceAddress: try .ipv4("127.0.0.1"),
            destAddress: try .ipv4("1.1.1.1")
        )
        let line = MessagePrinter.line(for: .flowStarted(payload))
        XCTAssertTrue(line.hasPrefix("flow-start"), line)
        XCTAssertTrue(line.contains("tcp"), line)
        XCTAssertTrue(line.contains("127.0.0.1:51000"), line)
        XCTAssertTrue(line.contains("1.1.1.1:443"), line)
    }

    func testPrinterHandlesPing() {
        XCTAssertEqual(MessagePrinter.line(for: .ping), "ping")
    }

    func testListenerReceivesEncodedFrames() throws {
        let sockPath = NSTemporaryDirectory() + "mydata-test-\(UUID().uuidString).sock"
        let received = ReceivedBox()
        let listener = Listener(socketPath: sockPath) { msg in received.append(msg) }
        try listener.start()
        defer { listener.stop() }

        let conn = NWConnection(
            to: .unix(path: sockPath),
            using: .tcp
        )
        let connQueue = DispatchQueue(label: "test.client")
        let ready = expectation(description: "client ready")
        conn.stateUpdateHandler = { state in
            if case .ready = state { ready.fulfill() }
        }
        conn.start(queue: connQueue)
        wait(for: [ready], timeout: 2.0)

        let msg = IPCMessage.flowStarted(FlowEventPayload(
            flowId: 42,
            timestampNanos: 1,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 1, destPort: 2,
            sourceAddress: try .ipv4("10.0.0.1"),
            destAddress: try .ipv4("10.0.0.2")
        ))
        let sent = expectation(description: "sent")
        conn.send(content: IPCCodec.encode(msg), completion: .contentProcessed { _ in sent.fulfill() })
        wait(for: [sent], timeout: 2.0)

        // Poll briefly for the listener to surface the message.
        let deadline = Date().addingTimeInterval(2.0)
        while received.snapshot().isEmpty && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.02)
        }
        XCTAssertEqual(received.snapshot(), [msg])
        conn.cancel()
    }
}

private final class ReceivedBox: @unchecked Sendable {
    private var items: [IPCMessage] = []
    private let lock = NSLock()
    func append(_ m: IPCMessage) { lock.lock(); items.append(m); lock.unlock() }
    func snapshot() -> [IPCMessage] { lock.lock(); defer { lock.unlock() }; return items }
}
