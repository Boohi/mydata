import Foundation
import Network
import NetworkExtension
import MydataIPC

/// Candidate original-flow relay. Installation remains gated by privacy policy
/// reconciliation and signed macOS acceptance; this class initiates no idle traffic.
@objc(MydataDNSProxyProvider)
public final class MydataDNSProxyProvider: NEDNSProxyProvider {
    private let queue = DispatchQueue(label: "io.mydata.extension.dns-relay")
    private let ipcClient: IPCClient
    private var sessions: [UUID: DNSNetworkSession] = [:]
    private var pendingMetadata: [IPCMessage] = []
    private var sendingMetadata = false
    private var stopped = false

    public override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        ipcClient = IPCClient(socketPath: support.appendingPathComponent("mydata/daemon.sock").path)
        super.init()
    }

    public override func startProxy(options: [String: Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
        completionHandler(nil)
    }

    public override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        queue.async {
            self.stopped = true
            for session in Array(self.sessions.values) { session.stop() }
            self.sessions.removeAll()
            self.pendingMetadata.removeAll()
            Task { await self.ipcClient.stop() }
            completionHandler()
        }
    }

    public override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        // Apple's false verdict discards a flow. It is not a pass-through verdict.
        guard flow is NEAppProxyUDPFlow || flow is NEAppProxyTCPFlow else { return false }
        queue.async {
            guard !self.stopped else {
                flow.closeReadWithError(nil); flow.closeWriteWithError(nil)
                return
            }
            let id = UUID()
            let emit: (IPCMessage) -> Void = { [weak self] in self?.enqueueMetadata($0) }
            let finished: () -> Void = { [weak self] in self?.sessions.removeValue(forKey: id) }
            let session: DNSNetworkSession
            if let tcp = flow as? NEAppProxyTCPFlow {
                session = DNSNetworkTCPTransport(flow: tcp, queue: self.queue, emit: emit, finished: finished)
            } else if let udp = flow as? NEAppProxyUDPFlow {
                session = DNSNetworkUDPSession(flow: udp, queue: self.queue, emit: emit, finished: finished)
            } else { return }
            self.sessions[id] = session
            session.start()
        }
        return true
    }

    /// One in-flight IPC operation and a finite queue; daemon outages cannot
    /// create an unbounded number of Tasks or block the transport pumps.
    private func enqueueMetadata(_ message: IPCMessage) {
        guard !stopped, pendingMetadata.count < 256 else { return }
        pendingMetadata.append(message)
        drainMetadata()
    }

    private func drainMetadata() {
        guard !stopped, !sendingMetadata, !pendingMetadata.isEmpty else { return }
        sendingMetadata = true
        let message = pendingMetadata.removeFirst()
        Task { [weak self, ipcClient] in
            await ipcClient.send(message)
            guard let self else { return }
            self.queue.async {
                self.sendingMetadata = false
                self.drainMetadata()
            }
        }
    }
}

protocol DNSNetworkSession: AnyObject {
    func start()
    func stop()
}

enum DNSUpstreamEndpoint {
    /// A hostname here could trigger an extra resolver query. Accept only the
    /// original numeric endpoint and its exact valid port, with no fallback.
    static func parse(_ endpoint: NWHostEndpoint) -> Network.NWEndpoint? {
        let host = Network.NWEndpoint.Host(endpoint.hostname)
        switch host {
        case .ipv4, .ipv6: break
        default: return nil
        }
        guard let rawPort = UInt16(endpoint.port), rawPort > 0,
              let port = Network.NWEndpoint.Port(rawValue: rawPort) else { return nil }
        return .hostPort(host: host, port: port)
    }
    static var invalid: NSError { NSError(domain: "io.mydata.dns", code: 1) }
    static var timedOut: NSError { NSError(domain: "io.mydata.dns", code: 2) }
}

/// Network adapter; the tested relay owns pump ordering and half-close behavior.
private final class DNSNetworkTCPTransport: DNSTCPTransport, DNSNetworkSession {
    private let flow: NEAppProxyTCPFlow
    private let queue: DispatchQueue
    private let emit: (IPCMessage) -> Void
    private let finished: () -> Void
    private var connection: NWConnection?
    private var relay: DNSTCPRelay?
    private var timer: DispatchSourceTimer?
    private var cancelled = false
    private var lastActivity = DispatchTime.now()

    init(flow: NEAppProxyTCPFlow, queue: DispatchQueue, emit: @escaping (IPCMessage) -> Void, finished: @escaping () -> Void) {
        self.flow = flow; self.queue = queue; self.emit = emit; self.finished = finished
    }

    func start() {
        guard let host = flow.remoteEndpoint as? NWHostEndpoint,
              let endpoint = DNSUpstreamEndpoint.parse(host) else { fail(DNSUpstreamEndpoint.invalid); return }
        let connection = NWConnection(to: endpoint, using: .tcp)
        self.connection = connection
        relay = DNSTCPRelay(transport: self, emit: emit, activity: { [weak self] in self?.lastActivity = .now() })
        let timer = DispatchSource.makeTimerSource(queue: queue)
        self.timer = timer
        timer.schedule(deadline: .now() + 30, repeating: 5)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            if DispatchTime.now().uptimeNanoseconds - self.lastActivity.uptimeNanoseconds >= 30_000_000_000 {
                self.fail(DNSUpstreamEndpoint.timedOut)
            }
        }
        timer.resume()
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            self.queue.async {
                guard !self.cancelled else { return }
                if let error { self.fail(error); return }
                connection.stateUpdateHandler = { [weak self] state in
                    guard let self, !self.cancelled else { return }
                    switch state {
                    case .ready: self.relay?.start()
                    case .failed(let error): self.fail(error)
                    default: break
                    }
                }
                connection.start(queue: self.queue)
            }
        }
    }

    func stop() { fail(nil) }
    private func fail(_ error: Error?) {
        if let relay { relay.stop(error) }
        else if !cancelled { flow.closeReadWithError(error); flow.closeWriteWithError(error); cancel() }
    }
    func cancel() {
        guard !cancelled else { return }
        cancelled = true
        timer?.cancel(); timer = nil
        connection?.stateUpdateHandler = nil
        connection?.cancel(); connection = nil
        relay = nil
        finished()
    }
    func readClient(_ completion: @escaping (Data?, Error?) -> Void) {
        flow.readData { [weak self] data, error in self?.queue.async { completion(data, error) } }
    }
    func readUpstream(_ completion: @escaping (Data?, Bool, Error?) -> Void) {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, complete, error in completion(data, complete, error) }
    }
    func writeUpstream(_ data: Data?, isComplete: Bool, completion: @escaping (Error?) -> Void) {
        connection?.send(content: data, contentContext: isComplete ? .finalMessage : .defaultMessage, isComplete: isComplete, completion: .contentProcessed { completion($0) })
    }
    func writeClient(_ data: Data, completion: @escaping (Error?) -> Void) {
        flow.write(data) { [weak self] error in self?.queue.async { completion(error) } }
    }
    func closeClientRead(_ error: Error?) { flow.closeReadWithError(error) }
    func closeClientWrite(_ error: Error?) { flow.closeWriteWithError(error) }
}

/// Up to 64 concurrent original datagram exchanges per flow. Stop reading while
/// full; no additional application queue is accumulated across read batches.
private final class DNSNetworkUDPSession: DNSNetworkSession {
    private let flow: NEAppProxyUDPFlow
    private let queue: DispatchQueue
    private let emit: (IPCMessage) -> Void
    private let finished: () -> Void
    private var exchanges: [UUID: DNSUDPExchange] = [:]
    private var deadlines = DNSExchangeDeadlines<UUID>(capacity: 64)
    private var batch: [(Data, NWHostEndpoint)] = []
    private var index = 0
    private var reading = false
    private var cancelled = false
    private var timer: DispatchSourceTimer?
    private var lastActivity = DispatchTime.now()

    init(flow: NEAppProxyUDPFlow, queue: DispatchQueue, emit: @escaping (IPCMessage) -> Void, finished: @escaping () -> Void) {
        self.flow = flow; self.queue = queue; self.emit = emit; self.finished = finished
    }
    func start() {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        self.timer = timer
        timer.schedule(deadline: .now() + 1, repeating: 1)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            let now = DispatchTime.now().uptimeNanoseconds
            if now - self.lastActivity.uptimeNanoseconds >= 30_000_000_000 {
                self.close(DNSUpstreamEndpoint.timedOut)
                return
            }
            let expired = self.deadlines.expire(at: now)
            for id in expired {
                self.exchanges[id]?.stop()
            }
            if !expired.isEmpty { self.pump() }
        }
        timer.resume()
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            self.queue.async { if let error { self.close(error) } else { self.pump() } }
        }
    }
    func stop() { close(nil) }
    private func close(_ error: Error?) {
        guard !cancelled else { return }
        cancelled = true
        for exchange in Array(exchanges.values) { exchange.stop() }
        exchanges.removeAll(); batch.removeAll()
        deadlines = DNSExchangeDeadlines(capacity: 64)
        timer?.cancel(); timer = nil
        flow.closeReadWithError(error); flow.closeWriteWithError(error)
        finished()
    }
    private func pump() {
        guard !cancelled else { return }
        while index < batch.count && exchanges.count < 64 {
            let (data, endpoint) = batch[index]; index += 1
            guard let original = DNSUpstreamEndpoint.parse(endpoint) else { close(DNSUpstreamEndpoint.invalid); return }
            exchange(data, endpoint: endpoint, original: original)
        }
        guard index == batch.count, exchanges.count < 64, !reading else { return }
        batch.removeAll(); index = 0; reading = true
        flow.readDatagrams { [weak self] data, endpoints, error in
            guard let self else { return }
            self.queue.async {
                self.reading = false
                guard !self.cancelled else { return }
                if let error { self.close(error); return }
                guard let data, let endpoints, data.count == endpoints.count, !data.isEmpty else { self.close(nil); return }
                self.lastActivity = .now()
                var incoming: [(Data, NWHostEndpoint)] = []
                for (packet, endpoint) in zip(data, endpoints) {
                    guard let host = endpoint as? NWHostEndpoint else { self.close(DNSUpstreamEndpoint.invalid); return }
                    incoming.append((packet, host))
                }
                self.batch = incoming
                self.index = 0
                self.pump()
            }
        }
    }
    private func exchange(_ data: Data, endpoint: NWHostEndpoint, original: Network.NWEndpoint) {
        let id = UUID()
        guard deadlines.insert(id, deadline: DispatchTime.now().uptimeNanoseconds + 15_000_000_000) else {
            close(DNSUpstreamEndpoint.invalid)
            return
        }
        let transport = DNSNetworkUDPTransport(flow: flow, endpoint: endpoint, original: original, queue: queue)
        let exchange = DNSUDPExchange(transport: transport, data: data, emit: emit, failed: { [weak self] error in
            self?.close(error)
        }, finished: { [weak self] in
            guard let self else { return }
            self.exchanges.removeValue(forKey: id)
            self.deadlines.remove(id)
            self.pump()
        }, activity: { [weak self] in self?.lastActivity = .now() })
        exchanges[id] = exchange
        exchange.start()
    }
}

/// No lifecycle decisions here: every completion goes through DNSUDPExchange's
/// active-state guard, including callbacks already queued at cancellation time.
private final class DNSNetworkUDPTransport: DNSUDPTransport {
    private let connection: NWConnection
    private let flow: NEAppProxyUDPFlow
    private let endpoint: NWHostEndpoint
    private let queue: DispatchQueue
    init(flow: NEAppProxyUDPFlow, endpoint: NWHostEndpoint, original: Network.NWEndpoint, queue: DispatchQueue) {
        self.flow = flow; self.endpoint = endpoint; self.queue = queue
        connection = NWConnection(to: original, using: .udp)
    }
    func start(_ failed: @escaping (Error) -> Void) {
        connection.stateUpdateHandler = { state in if case .failed(let error) = state { failed(error) } }
        connection.start(queue: queue)
    }
    func send(_ data: Data, completion: @escaping (Error?) -> Void) {
        connection.send(content: data, completion: .contentProcessed { completion($0) })
    }
    func receive(_ completion: @escaping (Data?, Error?) -> Void) {
        connection.receiveMessage { data, _, _, error in completion(data, error) }
    }
    func writeResponse(_ data: Data, completion: @escaping (Error?) -> Void) {
        flow.writeDatagrams([data], sentBy: [endpoint]) { [weak self] error in self?.queue.async { completion(error) } }
    }
    func cancel() {
        connection.stateUpdateHandler = nil
        connection.cancel()
    }
}
