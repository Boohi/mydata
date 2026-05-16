import Foundation
import MydataIPC

/// Renders an IPC message as a single-line, audit-friendly string.
/// Pure function: easy to unit-test.
public enum MessagePrinter {
    public static func line(for message: IPCMessage) -> String {
        switch message {
        case .flowStarted(let p): return "flow-start " + flow(p)
        case .flowEnded(let p):   return "flow-end   " + flow(p)
        case .dnsQueried(let p):  return "dns        " + dns(p)
        case .ping:               return "ping"
        case .pong:               return "pong"
        case .unknown(let t):     return String(format: "unknown type=0x%02x", t)
        }
    }

    private static func dns(_ p: DNSQueryPayload) -> String {
        return "ts=\(p.timestampNanos) qtype=\(p.qtype) qname=\(p.qname)"
    }

    private static func flow(_ p: FlowEventPayload) -> String {
        let src = format(addr: p.sourceAddress, family: p.family, port: p.sourcePort)
        let dst = format(addr: p.destAddress,   family: p.family, port: p.destPort)
        let proto: String
        switch p.protocolNumber {
        case 6:  proto = "tcp"
        case 17: proto = "udp"
        default: proto = "p\(p.protocolNumber)"
        }
        return "id=\(p.flowId) ts=\(p.timestampNanos) \(proto) \(src) -> \(dst)"
    }

    private static func format(addr: IPCAddress, family: IPCAddressFamily, port: UInt16) -> String {
        switch family {
        case .ipv4:
            let last4 = addr.bytes.suffix(4)
            return last4.map(String.init).joined(separator: ".") + ":\(port)"
        case .ipv6:
            var presentation = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
            var raw = addr.bytes.withUnsafeBufferPointer { buf -> in6_addr in
                var a = in6_addr()
                _ = withUnsafeMutableBytes(of: &a) { dst in
                    dst.copyBytes(from: buf)
                }
                return a
            }
            _ = inet_ntop(AF_INET6, &raw, &presentation, socklen_t(INET6_ADDRSTRLEN))
            return "[\(String(cString: presentation))]:\(port)"
        }
    }
}
