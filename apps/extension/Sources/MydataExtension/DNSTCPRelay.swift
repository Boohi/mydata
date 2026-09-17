import Foundation
import MydataIPC

/// Adapter boundary: implementations serialize callbacks on one session queue.
public protocol DNSTCPTransport: AnyObject {
    func readClient(_ completion: @escaping (Data?, Error?) -> Void)
    func readUpstream(_ completion: @escaping (Data?, Bool, Error?) -> Void)
    func writeUpstream(_ data: Data?, isComplete: Bool, completion: @escaping (Error?) -> Void)
    func writeClient(_ data: Data, completion: @escaping (Error?) -> Void)
    func closeClientRead(_ error: Error?)
    func closeClientWrite(_ error: Error?)
    func cancel()
}

/// Two independent byte pumps with bounded metadata side observation.
/// Each direction allows one read and one completed write before the next read.
public final class DNSTCPRelay {
    private let transport: DNSTCPTransport
    private let emit: (IPCMessage) -> Void
    private let activity: () -> Void
    private let stopped: () -> Void
    private var queries = DNSTCPFramer()
    private var responses = DNSTCPFramer()
    private var observer = DNSFlowObserver()
    private var started = false
    private var finished = false
    private var clientEOF = false
    private var clientFinishSent = false
    private var upstreamEOF = false

    public init(transport: DNSTCPTransport, emit: @escaping (IPCMessage) -> Void = { _ in }, activity: @escaping () -> Void = {}, stopped: @escaping () -> Void = {}) {
        self.transport = transport
        self.emit = emit
        self.activity = activity
        self.stopped = stopped
    }

    public func start() {
        guard !started, !finished else { return }
        started = true
        readClient()
        readUpstream()
    }

    public func stop(_ error: Error? = nil) {
        guard !finished else { return }
        finished = true
        if !clientEOF { transport.closeClientRead(error) }
        if !upstreamEOF { transport.closeClientWrite(error) }
        transport.cancel()
        stopped()
    }

    private func readClient() {
        guard !finished, !clientEOF else { return }
        transport.readClient { [weak self] data, error in
            guard let self, !self.finished else { return }
            if let error { self.stop(error); return }
            guard let data, !data.isEmpty else {
                self.clientEOF = true
                self.transport.closeClientRead(nil)
                self.transport.writeUpstream(nil, isComplete: true) { [weak self] error in
                    guard let self else { return }
                    if let error { self.stop(error) } else { self.clientFinishSent = true; self.finishIfClosed() }
                }
                return
            }
            self.activity()
            for packet in self.queries.append(data) {
                if let payload = self.observer.query(packet, timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000)) {
                    self.emit(.dnsQueried(payload))
                }
            }
            self.transport.writeUpstream(data, isComplete: false) { [weak self] error in
                guard let self else { return }
                if let error { self.stop(error) } else { self.readClient() }
            }
        }
    }

    private func readUpstream() {
        guard !finished, !upstreamEOF else { return }
        transport.readUpstream { [weak self] data, complete, error in
            guard let self, !self.finished else { return }
            if let error { self.stop(error); return }
            let continuation: (Error?) -> Void = { [weak self] writeError in
                guard let self, !self.finished else { return }
                if let writeError { self.stop(writeError); return }
                if complete {
                    self.upstreamEOF = true
                    self.transport.closeClientWrite(nil)
                    self.finishIfClosed()
                } else { self.readUpstream() }
            }
            guard let data, !data.isEmpty else { continuation(nil); return }
            self.activity()
            for packet in self.responses.append(data) {
                if let payload = self.observer.response(packet) { self.emit(.dnsResolved(payload)) }
            }
            self.transport.writeClient(data, completion: continuation)
        }
    }

    private func finishIfClosed() {
        if clientEOF && clientFinishSent && upstreamEOF { stop() }
    }
}
