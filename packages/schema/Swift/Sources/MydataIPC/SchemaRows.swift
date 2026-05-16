import Foundation

/// One row in the `flows` table.
///
/// Mirrors the schema in `packages/schema/migrations/0001_initial.sql`.
/// Address blobs are exactly 16 bytes (IPv4 zero-padded in the first 12).
public struct FlowRow: Sendable, Equatable {
    public var id: Int64?
    public var flowId: Int64
    public var startedNs: Int64
    public var endedNs: Int64?
    public var family: Int
    public var protocolNumber: Int
    public var srcAddr: [UInt8]
    public var srcPort: Int
    public var dstAddr: [UInt8]
    public var dstPort: Int
    public var bundleId: String?
    public var country: String?
    public var asn: Int?

    public init(
        id: Int64? = nil,
        flowId: Int64,
        startedNs: Int64,
        endedNs: Int64? = nil,
        family: Int,
        protocolNumber: Int,
        srcAddr: [UInt8],
        srcPort: Int,
        dstAddr: [UInt8],
        dstPort: Int,
        bundleId: String? = nil,
        country: String? = nil,
        asn: Int? = nil
    ) {
        precondition(srcAddr.count == 16, "FlowRow.srcAddr must be exactly 16 bytes")
        precondition(dstAddr.count == 16, "FlowRow.dstAddr must be exactly 16 bytes")
        self.id = id
        self.flowId = flowId
        self.startedNs = startedNs
        self.endedNs = endedNs
        self.family = family
        self.protocolNumber = protocolNumber
        self.srcAddr = srcAddr
        self.srcPort = srcPort
        self.dstAddr = dstAddr
        self.dstPort = dstPort
        self.bundleId = bundleId
        self.country = country
        self.asn = asn
    }
}

/// One row in the `dns_queries` table.
///
/// Mirrors the schema in `packages/schema/migrations/0001_initial.sql`.
public struct DNSQueryRow: Sendable, Equatable {
    public var id: Int64?
    public var tsNs: Int64
    public var queryName: String
    public var qtype: Int
    public var rcode: Int?
    public var bundleId: String?

    public init(
        id: Int64? = nil,
        tsNs: Int64,
        queryName: String,
        qtype: Int,
        rcode: Int? = nil,
        bundleId: String? = nil
    ) {
        self.id = id
        self.tsNs = tsNs
        self.queryName = queryName
        self.qtype = qtype
        self.rcode = rcode
        self.bundleId = bundleId
    }
}
