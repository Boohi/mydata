import Foundation
import MydataIPC

/// All callbacks are serialized on the original flow's session queue.
public protocol DNSUDPTransport: AnyObject {
    func start(_ failed: @escaping (Error) -> Void)
    func send(_ data: Data, completion: @escaping (Error?) -> Void)
    func receive(_ completion: @escaping (Data?, Error?) -> Void)
    func writeResponse(_ data: Data, completion: @escaping (Error?) -> Void)
    func cancel()
}

/// One original datagram and its response. Expiry seals this exchange before
/// cancelling transport, so delayed callbacks cannot tear down another exchange.
public final class DNSUDPExchange {
    private let transport: DNSUDPTransport
    private let data: Data
    private let emit: (IPCMessage) -> Void
    private let failed: (Error) -> Void
    private let finished: () -> Void
    private let activity: () -> Void
    private var observer = DNSFlowObserver(maximumPending: 1)
    private var active = true
    private var started = false

    public init(transport: DNSUDPTransport, data: Data, emit: @escaping (IPCMessage) -> Void = { _ in }, failed: @escaping (Error) -> Void, finished: @escaping () -> Void = {}, activity: @escaping () -> Void = {}) {
        self.transport = transport; self.data = data; self.emit = emit
        self.failed = failed; self.finished = finished; self.activity = activity
    }

    public func start() {
        guard active, !started else { return }
        started = true
        transport.start { [weak self] error in self?.fail(error) }
        guard active else { return }
        if let query = observer.query(data, timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000)) { emit(.dnsQueried(query)) }
        transport.send(data) { [weak self] error in
            guard let self, self.active else { return }
            if let error { self.fail(error); return }
            self.transport.receive { [weak self] response, error in
                guard let self, self.active else { return }
                if let error { self.fail(error); return }
                guard let response else { self.fail(NSError(domain: "io.mydata.dns", code: 1)); return }
                self.activity()
                if let result = self.observer.response(response) { self.emit(.dnsResolved(result)) }
                self.transport.writeResponse(response) { [weak self] error in
                    guard let self, self.active else { return }
                    if let error { self.fail(error) } else { self.stop() }
                }
            }
        }
    }

    public func stop() {
        guard active else { return }
        active = false
        transport.cancel()
        finished()
    }

    private func fail(_ error: Error) {
        guard active else { return }
        active = false
        transport.cancel()
        failed(error)
        finished()
    }
}
