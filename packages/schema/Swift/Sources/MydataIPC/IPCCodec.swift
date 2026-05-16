import Foundation

public enum IPCDecodeError: Error, Equatable {
    case truncated
    case unsupportedVersion(UInt16)
    case malformedPayload(String)
}

public enum IPCCodec {

    // MARK: Encode

    public static func encode(_ message: IPCMessage) -> Data {
        let (type, payload) = body(of: message)
        // length covers version(2) + type(1) + payload.count
        let length = UInt32(2 + 1 + payload.count)
        var out = Data(capacity: 4 + Int(length))
        out.appendBE(length)
        out.appendBE(IPCWireVersion.current)
        out.append(type)
        out.append(payload)
        return out
    }

    private static func body(of message: IPCMessage) -> (UInt8, Data) {
        switch message {
        case .flowStarted(let p): return (0x01, encodeFlowPayload(p))
        case .flowEnded(let p):   return (0x02, encodeFlowPayload(p))
        case .dnsQueried(let p):  return (0x03, encodeDNSPayload(p))
        case .ping:               return (0x10, Data())
        case .pong:               return (0x11, Data())
        case .unknown(let t):     return (t, Data())
        }
    }

    private static func encodeDNSPayload(_ p: DNSQueryPayload) -> Data {
        let nameBytes = Array(p.qname.utf8)
        var d = Data(capacity: 8 + 2 + 2 + nameBytes.count)
        d.appendBE(p.timestampNanos)
        d.appendBE(p.qtype)
        d.appendBE(UInt16(nameBytes.count))
        d.append(contentsOf: nameBytes)
        return d
    }

    private static func encodeFlowPayload(_ p: FlowEventPayload) -> Data {
        var d = Data(capacity: 54)
        d.appendBE(p.flowId)
        d.appendBE(p.timestampNanos)
        d.append(p.family.rawValue)
        d.append(p.protocolNumber)
        d.appendBE(p.sourcePort)
        d.appendBE(p.destPort)
        d.append(contentsOf: p.sourceAddress.bytes)
        d.append(contentsOf: p.destAddress.bytes)
        return d
    }

    // MARK: Decode

    /// Decodes a single frame from the start of `data`. Returns the message
    /// and the number of bytes consumed (so callers can advance a buffer).
    public static func decode(_ data: Data) throws -> (IPCMessage, Int) {
        guard data.count >= 4 else { throw IPCDecodeError.truncated }
        let length = Int(data.readBE(at: 0, as: UInt32.self))
        let frameEnd = 4 + length
        guard data.count >= frameEnd else { throw IPCDecodeError.truncated }
        guard length >= 3 else { throw IPCDecodeError.truncated }

        let version: UInt16 = data.readBE(at: 4, as: UInt16.self)
        guard version == IPCWireVersion.current else {
            throw IPCDecodeError.unsupportedVersion(version)
        }
        let type = data[data.startIndex + 6]
        let payload = data.subdata(in: (data.startIndex + 7) ..< (data.startIndex + frameEnd))

        let message: IPCMessage
        switch type {
        case 0x01: message = .flowStarted(try decodeFlowPayload(payload))
        case 0x02: message = .flowEnded(try decodeFlowPayload(payload))
        case 0x03: message = .dnsQueried(try decodeDNSPayload(payload))
        case 0x10: message = .ping
        case 0x11: message = .pong
        default:   message = .unknown(type: type)
        }
        return (message, frameEnd)
    }

    private static func decodeDNSPayload(_ d: Data) throws -> DNSQueryPayload {
        guard d.count >= 12 else {
            throw IPCDecodeError.malformedPayload("dns payload header truncated (\(d.count) < 12)")
        }
        let base = d.startIndex
        let ts: Int64     = d.readBE(at: 0,  as: Int64.self)
        let qtype: UInt16 = d.readBE(at: 8,  as: UInt16.self)
        let nameLen = Int(d.readBE(at: 10, as: UInt16.self))
        guard d.count == 12 + nameLen else {
            throw IPCDecodeError.malformedPayload(
                "dns payload size mismatch: header says name_len=\(nameLen), trailer=\(d.count - 12)"
            )
        }
        let nameBytes = Array(d[(base + 12) ..< (base + 12 + nameLen)])
        guard let qname = String(bytes: nameBytes, encoding: .utf8) else {
            throw IPCDecodeError.malformedPayload("dns qname is not valid UTF-8")
        }
        guard let payload = DNSQueryPayload(timestampNanos: ts, qtype: qtype, qname: qname) else {
            throw IPCDecodeError.malformedPayload("dns qname exceeds 253 bytes")
        }
        return payload
    }

    private static func decodeFlowPayload(_ d: Data) throws -> FlowEventPayload {
        guard d.count == 54 else {
            throw IPCDecodeError.malformedPayload("flow payload must be 54 bytes, got \(d.count)")
        }
        let base = d.startIndex
        let flowId: UInt64        = d.readBE(at: 0,  as: UInt64.self)
        let tsNanos: Int64        = d.readBE(at: 8,  as: Int64.self)
        let familyRaw             = d[base + 16]
        guard let family = IPCAddressFamily(rawValue: familyRaw) else {
            throw IPCDecodeError.malformedPayload("bad family \(familyRaw)")
        }
        let proto                 = d[base + 17]
        let sport: UInt16         = d.readBE(at: 18, as: UInt16.self)
        let dport: UInt16         = d.readBE(at: 20, as: UInt16.self)
        let src = Array(d[(base + 22) ..< (base + 38)])
        let dst = Array(d[(base + 38) ..< (base + 54)])
        return FlowEventPayload(
            flowId: flowId,
            timestampNanos: tsNanos,
            family: family,
            protocolNumber: proto,
            sourcePort: sport,
            destPort: dport,
            sourceAddress: IPCAddress(bytes: src),
            destAddress: IPCAddress(bytes: dst)
        )
    }
}

// MARK: Big-endian helpers

extension Data {
    mutating func appendBE<T: FixedWidthInteger>(_ value: T) {
        var be = value.bigEndian
        Swift.withUnsafeBytes(of: &be) { self.append(contentsOf: $0) }
    }

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
