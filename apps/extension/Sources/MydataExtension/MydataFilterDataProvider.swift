import Foundation
import NetworkExtension
import os.log

/// Allows every flow. Logs flow start (and end where the OS surfaces it).
/// Intentionally minimal — see AGENTS.md "Network Extension Rules":
/// the extension makes no blocking decisions and does no enrichment.
@objc(MydataFilterDataProvider)
public final class MydataFilterDataProvider: NEFilterDataProvider {

    private static let log = Logger(subsystem: "io.mydata.extension", category: "filter")

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
        if let event = Self.event(for: flow, phase: .start) {
            Self.log.info("\(event.logLine, privacy: .public)")
        }
        return .allow()
    }

    private static func event(for flow: NEFilterFlow, phase: FlowPhase) -> FlowEvent? {
        let (src, dst, proto): (String, String, String)
        if let socket = flow as? NEFilterSocketFlow {
            src = socket.localEndpoint.map(describe) ?? "unknown"
            dst = socket.remoteEndpoint.map(describe) ?? "unknown"
            proto = protocolName(socket.socketProtocol)
        } else {
            src = "unknown"
            dst = flow.url?.absoluteString ?? "unknown"
            proto = "browser"
        }
        return FlowEvent(
            phase: phase,
            sourceEndpoint: src,
            remoteEndpoint: dst,
            protocolName: proto,
            timestamp: Date()
        )
    }

    private static func describe(_ endpoint: NWEndpoint) -> String {
        if let host = endpoint as? NWHostEndpoint {
            return "\(host.hostname):\(host.port)"
        }
        return String(describing: endpoint)
    }

    private static func protocolName(_ proto: Int32) -> String {
        switch proto {
        case Int32(IPPROTO_TCP): return "tcp"
        case Int32(IPPROTO_UDP): return "udp"
        default: return "other(\(proto))"
        }
    }
}
