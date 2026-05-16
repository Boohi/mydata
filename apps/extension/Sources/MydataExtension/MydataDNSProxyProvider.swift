import Foundation
import Network
import NetworkExtension
import MydataIPC
import os.log

/// Transparently proxies DNS queries while emitting a `.dnsQueried` IPC
/// message per question. Always-on, never blocking, no caching. The actual
/// resolution is delegated to the system resolver via NWConnection.
@objc(MydataDNSProxyProvider)
public final class MydataDNSProxyProvider: NEDNSProxyProvider {

    private static let log = Logger(subsystem: "io.mydata.extension", category: "dnsproxy")

    private let ipcClient: IPCClient

    public override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let path = support.appendingPathComponent("mydata/daemon.sock").path
        self.ipcClient = IPCClient(socketPath: path)
        super.init()
    }

    public override func startProxy(options: [String : Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
        Self.log.info("mydata dns proxy starting")
        completionHandler(nil)
    }

    public override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        Self.log.info("mydata dns proxy stopping reason=\(reason.rawValue, privacy: .public)")
        completionHandler()
    }

    public override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        if let udp = flow as? NEAppProxyUDPFlow {
            handleUDP(udp)
            return true
        }
        if let tcp = flow as? NEAppProxyTCPFlow {
            handleTCP(tcp)
            return true
        }
        return false
    }

    // MARK: UDP

    private func handleUDP(_ flow: NEAppProxyUDPFlow) {
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            if let error {
                Self.log.error("udp open failed: \(error.localizedDescription, privacy: .public)")
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            self.pumpUDP(flow)
        }
    }

    private func pumpUDP(_ flow: NEAppProxyUDPFlow) {
        flow.readDatagrams { [weak self] datagrams, endpoints, error in
            guard let self, let datagrams, let endpoints, error == nil, !datagrams.isEmpty else {
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            for datagram in datagrams {
                self.emitDNSEvent(from: datagram)
            }
            // Resolve upstream endpoint (the OS-supplied destination).
            guard let host = (endpoints.first as? NWHostEndpoint) else {
                flow.closeReadWithError(nil)
                flow.closeWriteWithError(nil)
                return
            }
            // Send to upstream, then read response and pump back.
            let conn = NWConnection(
                host: Network.NWEndpoint.Host(host.hostname),
                port: Network.NWEndpoint.Port(host.port) ?? 53,
                using: .udp
            )
            conn.start(queue: .global())
            for datagram in datagrams {
                conn.send(content: datagram, completion: .contentProcessed { _ in })
            }
            conn.receiveMessage { [weak self] data, _, _, _ in
                if let data {
                    flow.writeDatagrams([data], sentBy: [host]) { _ in }
                }
                conn.cancel()
                self?.pumpUDP(flow)  // continue with next datagram
            }
        }
    }

    // MARK: TCP

    private func handleTCP(_ flow: NEAppProxyTCPFlow) {
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            if let error {
                Self.log.error("tcp open failed: \(error.localizedDescription, privacy: .public)")
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            self.pumpTCP(flow)
        }
    }

    private func pumpTCP(_ flow: NEAppProxyTCPFlow) {
        flow.readData { [weak self] data, error in
            guard let self, let data, !data.isEmpty, error == nil else {
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            // TCP DNS: 2-byte length prefix, then the DNS message.
            if data.count >= 2 {
                let len = (Int(data[data.startIndex]) << 8) | Int(data[data.startIndex + 1])
                if data.count >= 2 + len {
                    self.emitDNSEvent(from: data.subdata(in: (data.startIndex + 2) ..< (data.startIndex + 2 + len)))
                }
            }
            guard let host = (flow.remoteEndpoint as? NWHostEndpoint) else {
                flow.closeReadWithError(nil)
                flow.closeWriteWithError(nil)
                return
            }
            let conn = NWConnection(
                host: Network.NWEndpoint.Host(host.hostname),
                port: Network.NWEndpoint.Port(host.port) ?? 53,
                using: .tcp
            )
            conn.start(queue: .global())
            conn.send(content: data, completion: .contentProcessed { _ in
                conn.receive(minimumIncompleteLength: 1, maximumLength: 65535) { resp, _, _, _ in
                    if let resp { flow.write(resp) { _ in } }
                    conn.cancel()
                    self.pumpTCP(flow)
                }
            })
        }
    }

    // MARK: shared

    private func emitDNSEvent(from datagram: Data) {
        guard let question = try? DNSPacket.parseQuestion(datagram) else { return }
        let payload = DNSQueryPayload(
            timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000),
            qtype: question.qtype,
            qname: question.qname
        )
        Task { [ipcClient] in
            await ipcClient.send(.dnsQueried(payload))
        }
        Self.log.info("dns qname=\(question.qname, privacy: .public) qtype=\(question.qtype, privacy: .public)")
    }
}
