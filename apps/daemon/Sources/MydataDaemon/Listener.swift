import Foundation
import Network
import MydataIPC

/// A Unix-domain-socket listener that accepts framed IPC messages and hands
/// each decoded message to a sink. Designed to be testable: the sink is just
/// a closure, so tests can inject their own.
public final class Listener {

    public typealias Sink = @Sendable (IPCMessage) -> Void

    public let socketPath: String
    private let sink: Sink
    private let queue = DispatchQueue(label: "io.mydata.daemon.listener")
    private var listener: NWListener?

    public init(socketPath: String, sink: @escaping Sink) {
        self.socketPath = socketPath
        self.sink = sink
    }

    public func start() throws {
        // NWListener does not handle stale socket files; remove if present.
        try? FileManager.default.removeItem(atPath: socketPath)

        let params = NWParameters.tcp
        params.requiredLocalEndpoint = NWEndpoint.unix(path: socketPath)
        let listener = try NWListener(using: params)
        listener.newConnectionHandler = { [weak self] conn in
            self?.handle(conn)
        }
        listener.start(queue: queue)
        self.listener = listener
    }

    public func stop() {
        listener?.cancel()
        listener = nil
        try? FileManager.default.removeItem(atPath: socketPath)
    }

    private func handle(_ conn: NWConnection) {
        conn.start(queue: queue)
        receive(on: conn, accumulator: Data())
    }

    private func receive(on conn: NWConnection, accumulator initial: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var buf = initial
            if let data, !data.isEmpty { buf.append(data) }

            while buf.count >= 4 {
                let length = Int(buf.readBE(at: 0, as: UInt32.self))
                // Spec caps frames at 65_535 bytes; anything larger is malformed
                // (or a DoS attempt). Drop the connection.
                if length > 65_535 {
                    conn.cancel()
                    return
                }
                let frameEnd = 4 + length
                guard buf.count >= frameEnd else { break }
                let frame = buf.subdata(in: buf.startIndex ..< buf.startIndex + frameEnd)
                do {
                    let (msg, _) = try IPCCodec.decode(frame)
                    self.sink(msg)
                } catch {
                    // Bad frame: drop the connection per spec.
                    conn.cancel()
                    return
                }
                buf = buf.subdata(in: buf.startIndex + frameEnd ..< buf.endIndex)
            }

            if error != nil || isComplete {
                conn.cancel()
                return
            }
            self.receive(on: conn, accumulator: buf)
        }
    }
}

// Reuse the same big-endian helper signature MydataIPC defines.
private extension Data {
    func readBE<T: FixedWidthInteger>(at offset: Int, as: T.Type) -> T {
        let size = MemoryLayout<T>.size
        let idx = self.startIndex + offset
        return self.subdata(in: idx ..< idx + size).withUnsafeBytes { raw in
            var v: T = 0
            Swift.withUnsafeMutableBytes(of: &v) { dst in
                dst.copyBytes(from: raw)
            }
            return T(bigEndian: v)
        }
    }
}
