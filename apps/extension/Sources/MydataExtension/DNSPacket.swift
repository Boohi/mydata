import Foundation

public enum DNSParseError: Error, Equatable {
    case truncated
    case noQuestion
    case compressionPointerInQuestion
    case invalidLabel
}

public enum DNSPacket {
    public struct Question: Equatable {
        public let qname: String
        public let qtype: UInt16
    }

    /// Parses the first question out of a raw DNS message (UDP payload or
    /// the body of a TCP DNS frame with the 2-byte length already stripped).
    /// Only QNAME + QTYPE are returned; QCLASS is parsed for advancement
    /// but discarded. Compression pointers are illegal in the question
    /// section per RFC 1035 §4.1.4 and are rejected.
    public static func parseQuestion(_ data: Data) throws -> Question {
        guard data.count >= 12 else { throw DNSParseError.truncated }
        let base = data.startIndex
        let qdCount = (UInt16(data[base + 4]) << 8) | UInt16(data[base + 5])
        guard qdCount >= 1 else { throw DNSParseError.noQuestion }

        var idx = base + 12
        var labels: [String] = []
        while idx < data.endIndex {
            let len = data[idx]
            if len == 0 {
                idx += 1
                break
            }
            // Top two bits set = pointer; illegal here.
            if (len & 0xC0) != 0 { throw DNSParseError.compressionPointerInQuestion }
            let labelLen = Int(len)
            let start = idx + 1
            let end = start + labelLen
            guard end <= data.endIndex else { throw DNSParseError.truncated }
            let bytes = data[start ..< end]
            guard let label = String(bytes: bytes, encoding: .ascii) else {
                throw DNSParseError.invalidLabel
            }
            labels.append(label.lowercased())
            idx = end
        }

        // QTYPE (2 bytes BE), then QCLASS (2 bytes BE).
        guard idx + 4 <= data.endIndex else { throw DNSParseError.truncated }
        let qtype = (UInt16(data[idx]) << 8) | UInt16(data[idx + 1])

        return Question(qname: labels.joined(separator: "."), qtype: qtype)
    }
}
