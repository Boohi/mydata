import Foundation
import Network
import MydataIPC
import os.log

/// Sends framed IPC messages to the daemon over a Unix domain socket.
/// Reconnects on failure with exponential backoff (capped at 5 s per the
/// acceptance criterion for #17).
public actor IPCClient {

    public static let defaultBackoffCapSeconds: Double = 5.0

    private static let log = Logger(subsystem: "io.mydata.extension", category: "ipc")

    private let socketPath: String
    private let backoffCap: Double
    private var connection: NWConnection?
    private var currentBackoff: Double = 0.1
    private let queue = DispatchQueue(label: "io.mydata.extension.ipc")

    public init(socketPath: String, backoffCap: Double = IPCClient.defaultBackoffCapSeconds) {
        self.socketPath = socketPath
        self.backoffCap = backoffCap
    }

    public func send(_ message: IPCMessage) async {
        let conn = await ensureConnection()
        let data = IPCCodec.encode(message)
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            conn.send(content: data, completion: .contentProcessed { [weak self] error in
                if let error {
                    Self.log.error("ipc send failed: \(error.localizedDescription, privacy: .public)")
                    Task { await self?.tearDown() }
                }
                cont.resume()
            })
        }
    }

    /// Exposed for unit tests.
    public static func nextBackoff(current: Double, cap: Double) -> Double {
        return Swift.min(current * 2.0, cap)
    }

    private func ensureConnection() async -> NWConnection {
        if let conn = connection, conn.state == .ready { return conn }
        let conn = NWConnection(to: .unix(path: socketPath), using: .tcp)
        connection = conn
        let ready = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready: cont.resume(returning: true)
                case .failed, .cancelled: cont.resume(returning: false)
                default: break
                }
            }
            conn.start(queue: queue)
        }
        if !ready {
            try? await Task.sleep(nanoseconds: UInt64(currentBackoff * 1_000_000_000))
            currentBackoff = Self.nextBackoff(current: currentBackoff, cap: backoffCap)
            return await ensureConnection()
        }
        currentBackoff = 0.1
        return conn
    }

    private func tearDown() {
        connection?.cancel()
        connection = nil
    }
}
