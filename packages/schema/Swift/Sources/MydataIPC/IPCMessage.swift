import Foundation

public enum IPCWireVersion {
    public static let current: UInt16 = 1
}

public enum IPCAddressFamily: UInt8, Sendable, Equatable {
    case ipv4 = 4
    case ipv6 = 6
}

public struct IPCAddress: Sendable, Equatable {
    /// Always 16 bytes. IPv4 addresses are zero-padded in the first 12 bytes.
    public let bytes: [UInt8]

    public init(bytes: [UInt8]) {
        precondition(bytes.count == 16, "IPCAddress requires exactly 16 bytes")
        self.bytes = bytes
    }

    public static func ipv4(_ dotted: String) throws -> IPCAddress {
        let parts = dotted.split(separator: ".").map(String.init)
        guard parts.count == 4 else {
            throw IPCAddressError.invalidIPv4(dotted)
        }
        var octets = [UInt8]()
        for p in parts {
            guard let v = UInt8(p) else {
                throw IPCAddressError.invalidIPv4(dotted)
            }
            octets.append(v)
        }
        return IPCAddress(bytes: Array(repeating: 0, count: 12) + octets)
    }

    public static func ipv6(_ presentation: String) throws -> IPCAddress {
        var addr = in6_addr()
        let ok = presentation.withCString { inet_pton(AF_INET6, $0, &addr) }
        guard ok == 1 else {
            throw IPCAddressError.invalidIPv6(presentation)
        }
        let bytes = withUnsafeBytes(of: &addr) { Array($0) }
        return IPCAddress(bytes: bytes)
    }
}

public enum IPCAddressError: Error, Equatable {
    case invalidIPv4(String)
    case invalidIPv6(String)
}

public struct FlowEventPayload: Sendable, Equatable {
    public let flowId: UInt64
    public let timestampNanos: Int64
    public let family: IPCAddressFamily
    public let protocolNumber: UInt8
    public let sourcePort: UInt16
    public let destPort: UInt16
    public let sourceAddress: IPCAddress
    public let destAddress: IPCAddress

    public init(
        flowId: UInt64,
        timestampNanos: Int64,
        family: IPCAddressFamily,
        protocolNumber: UInt8,
        sourcePort: UInt16,
        destPort: UInt16,
        sourceAddress: IPCAddress,
        destAddress: IPCAddress
    ) {
        self.flowId = flowId
        self.timestampNanos = timestampNanos
        self.family = family
        self.protocolNumber = protocolNumber
        self.sourcePort = sourcePort
        self.destPort = destPort
        self.sourceAddress = sourceAddress
        self.destAddress = destAddress
    }
}

public struct DNSQueryPayload: Sendable, Equatable {
    public let timestampNanos: Int64
    public let qtype: UInt16
    public let qname: String  // ASCII/IDN-A presentation, max 253 bytes

    public init?(timestampNanos: Int64, qtype: UInt16, qname: String) {
        guard qname.utf8.count <= 253,
              qname.utf8.allSatisfy({ $0 >= 33 && $0 <= 126 && $0 != 92 && $0 != 34 }) else { return nil }
        self.timestampNanos = timestampNanos
        self.qtype = qtype
        self.qname = qname
    }
}

/// Additive response event. The original query wire payload is unchanged.
public struct DNSResolutionPayload: Sendable, Equatable {
    public let query: DNSQueryPayload
    public let rcode: UInt16
    public let resolvedIPs: [String]

    public init?(query: DNSQueryPayload, rcode: UInt16, resolvedIPs: [String]) {
        guard rcode <= 4095, resolvedIPs.count <= 64 else { return nil }
        for ip in resolvedIPs {
            var bytes = [UInt8](repeating: 0, count: 16)
            let family = ip.contains(":") ? AF_INET6 : AF_INET
            guard ip.utf8.count <= 45,
                  ip.withCString({ inet_pton(family, $0, &bytes) }) == 1 else { return nil }
        }
        self.query = query
        self.rcode = rcode
        self.resolvedIPs = resolvedIPs
    }
}

public enum IPCMessage: Sendable, Equatable {
    case flowStarted(FlowEventPayload)
    case flowEnded(FlowEventPayload)
    case dnsQueried(DNSQueryPayload)
    case dnsResolved(DNSResolutionPayload)
    case ping
    case pong
    /// Surfaced when the codec encounters an unknown type code so the receiver
    /// can decide whether to log + skip it.
    case unknown(type: UInt8)
}
