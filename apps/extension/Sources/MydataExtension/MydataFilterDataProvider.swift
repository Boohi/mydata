import Foundation
import NetworkExtension
import MydataIPC
import os.log

/// Allows every flow. Logs flow start (and end where the OS surfaces it).
/// Intentionally minimal — see AGENTS.md "Network Extension Rules":
/// the extension makes no blocking decisions and does no enrichment.
@objc(MydataFilterDataProvider)
public final class MydataFilterDataProvider: NEFilterDataProvider {

    private static let log = Logger(subsystem: "io.mydata.extension", category: "filter")

    private let ipcClient: IPCClient
    private let nextFlowId = FlowIdAllocator()

    public override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let path = support.appendingPathComponent("mydata/daemon.sock").path
        self.ipcClient = IPCClient(socketPath: path)
        super.init()
    }

    public override func startFilter(completionHandler: @escaping (Error?) -> Void) {
        Self.log.info("mydata filter starting")
        // Without applying NEFilterSettings with a catch-all rule, handleNewFlow
        // is never invoked. We need every outbound flow surfaced so we can log it,
        // even though we always return .allow().
        let rule = NEFilterRule(
            networkRule: NENetworkRule(
                remoteNetwork: nil,
                remotePrefix: 0,
                localNetwork: nil,
                localPrefix: 0,
                protocol: .any,
                direction: .outbound
            ),
            action: .filterData
        )
        let settings = NEFilterSettings(rules: [rule], defaultAction: .allow)
        apply(settings) { error in
            if let error {
                Self.log.error("apply filter settings failed: \(error.localizedDescription, privacy: .public)")
            }
            completionHandler(error)
        }
    }

    public override func stopFilter(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        Self.log.info("mydata filter stopping reason=\(reason.rawValue, privacy: .public)")
        completionHandler()
    }

    public override func handleNewFlow(_ flow: NEFilterFlow) -> NEFilterNewFlowVerdict {
        if let payload = Self.payload(for: flow, nextId: nextFlowId.next()) {
            Task { [ipcClient] in
                await ipcClient.send(.flowStarted(payload))
            }
            Self.log.info("flow id=\(payload.flowId, privacy: .public)")
        }
        return .allow()
    }

    private static func payload(for flow: NEFilterFlow, nextId: UInt64) -> FlowEventPayload? {
        guard let socket = flow as? NEFilterSocketFlow,
              let remote = socket.remoteEndpoint as? NWHostEndpoint,
              let local = socket.localEndpoint as? NWHostEndpoint else {
            return nil
        }
        let family: IPCAddressFamily = remote.hostname.contains(":") ? .ipv6 : .ipv4
        let proto: UInt8 = socket.socketProtocol == IPPROTO_UDP ? 17 : 6
        let src = (try? address(from: local.hostname, family: family)) ?? IPCAddress(bytes: Array(repeating: 0, count: 16))
        let dst = (try? address(from: remote.hostname, family: family)) ?? IPCAddress(bytes: Array(repeating: 0, count: 16))
        return FlowEventPayload(
            flowId: nextId,
            timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000),
            family: family,
            protocolNumber: proto,
            sourcePort: UInt16(local.port) ?? 0,
            destPort: UInt16(remote.port) ?? 0,
            sourceAddress: src,
            destAddress: dst
        )
    }

    private static func address(from hostname: String, family: IPCAddressFamily) throws -> IPCAddress {
        switch family {
        case .ipv4: return try .ipv4(hostname)
        case .ipv6: return try .ipv6(hostname)
        }
    }
}

final class FlowIdAllocator: @unchecked Sendable {
    private var counter: UInt64 = 0
    private let lock = NSLock()
    func next() -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        counter &+= 1
        return counter
    }
}
