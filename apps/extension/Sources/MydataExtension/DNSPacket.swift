import Foundation

public enum DNSParseError: Error, Equatable {
    case truncated
    case noQuestion
    case compressionPointerInQuestion // retained for source compatibility
    case invalidLabel
    case invalidMessage
    case observationLimit
}

/// Best-effort metadata only. A parse failure must never alter relayed bytes.
public enum DNSPacket {
    public struct Question: Equatable {
        public let qname: String
        public let qtype: UInt16
        public let qclass: UInt16
    }

    public struct Response {
        public let transactionID: UInt16
        public let question: Question
        public let rcode: UInt16
        public let resolvedIPs: [String]
    }

    public static func transactionID(_ data: Data) throws -> UInt16 {
        try Reader(data).word(0)
    }

    public static func parseQuestion(_ data: Data) throws -> Question {
        let reader = Reader(data)
        guard data.count >= 12, data.count <= 65535 else { throw DNSParseError.truncated }
        let flags = try reader.word(2)
        guard flags & 0xf800 == 0 else { throw DNSParseError.invalidMessage }
        return try reader.question().0
    }

    public static func parseResponse(_ data: Data) throws -> Response {
        let reader = Reader(data)
        guard data.count >= 12, data.count <= 65535 else { throw DNSParseError.truncated }
        let flags = try reader.word(2)
        guard flags & 0xf800 == 0x8000 else { throw DNSParseError.invalidMessage }
        let (question, start) = try reader.question()
        let id = try reader.word(0)
        let rcode = flags & 0x000f
        // Truncated replies are still relayed, but are not a complete resolution.
        if flags & 0x0200 != 0 {
            return Response(transactionID: id, question: question, rcode: rcode, resolvedIPs: [])
        }
        let answerCount = Int(try reader.word(6))
        let total = answerCount + Int(try reader.word(8)) + Int(try reader.word(10))
        guard total <= 512 else { throw DNSParseError.observationLimit }
        var cursor = start
        var aliases: [String: String] = [:]
        var addresses: [(String, UInt16, String)] = []
        var responseCode = rcode
        for index in 0..<total {
            let (owner, next) = try reader.name(cursor)
            cursor = next
            let type = try reader.word(cursor)
            let klass = try reader.word(cursor + 2)
            let length = Int(try reader.word(cursor + 8))
            cursor += 10
            guard length <= data.count - cursor else { throw DNSParseError.truncated }
            if type == 41 { // EDNS extended response code lives in the TTL high byte.
                responseCode |= UInt16(reader.bytes[cursor - 6]) << 4
            }
            if index < answerCount && klass == 1 {
                if type == 5 {
                    let (target, end) = try reader.name(cursor)
                    guard end == cursor + length else { throw DNSParseError.invalidMessage }
                    if let previous = aliases[owner], previous != target {
                        throw DNSParseError.invalidMessage
                    }
                    aliases[owner] = target
                } else if type == 1 || type == 28 {
                    guard length == (type == 1 ? 4 : 16) else { throw DNSParseError.invalidMessage }
                    let raw = Array(reader.bytes[cursor..<(cursor + length)])
                    let presentation: String
                    if type == 1 {
                        presentation = raw.map(String.init).joined(separator: ".")
                    } else {
                        var text = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
                        let result = raw.withUnsafeBytes { inet_ntop(AF_INET6, $0.baseAddress, &text, socklen_t(text.count)) }
                        guard result != nil else { throw DNSParseError.invalidMessage }
                        presentation = String(cString: text)
                    }
                    addresses.append((owner, type, presentation))
                }
            }
            cursor += length
        }
        guard cursor == data.count else { throw DNSParseError.invalidMessage }
        var canonical = question.qname
        var visited: Set<String> = []
        while let target = aliases[canonical] {
            guard visited.insert(canonical).inserted, visited.count <= 32 else {
                throw DNSParseError.observationLimit
            }
            canonical = target
        }
        var resolved: [String] = []
        if responseCode == 0 {
            for (owner, type, address) in addresses where owner == canonical && (question.qtype == type || question.qtype == 255) {
                if !resolved.contains(address) { resolved.append(address) }
                guard resolved.count <= 64 else { throw DNSParseError.observationLimit }
            }
        }
        return Response(transactionID: id, question: question, rcode: responseCode, resolvedIPs: resolved)
    }

    private struct Reader {
        let bytes: [UInt8]
        init(_ data: Data) { bytes = Array(data) }

        func word(_ offset: Int) throws -> UInt16 {
            guard offset >= 0, offset + 2 <= bytes.count else { throw DNSParseError.truncated }
            return UInt16(bytes[offset]) << 8 | UInt16(bytes[offset + 1])
        }

        func question() throws -> (Question, Int) {
            guard try word(4) == 1 else { throw DNSParseError.noQuestion }
            let (name, end) = try name(12)
            let type = try word(end)
            let klass = try word(end + 2)
            guard klass == 1 else { throw DNSParseError.invalidMessage }
            return (Question(qname: name, qtype: type, qclass: klass), end + 4)
        }

        /// RFC 1035 compressed names, bounded independently of hostile pointers.
        func name(_ offset: Int) throws -> (String, Int) {
            var cursor = offset
            var consumed: Int?
            var visited: Set<Int> = []
            var labels: [String] = []
            var expandedBytes = 1 // terminal root label
            while true {
                guard cursor < bytes.count else { throw DNSParseError.truncated }
                guard visited.insert(cursor).inserted, visited.count <= 128 else { throw DNSParseError.observationLimit }
                let size = Int(bytes[cursor])
                if size == 0 { return (labels.joined(separator: "."), consumed ?? cursor + 1) }
                if size & 0xc0 == 0xc0 {
                    let pointer = Int(try word(cursor) & 0x3fff)
                    guard pointer >= 12, pointer < cursor else { throw DNSParseError.invalidLabel }
                    if consumed == nil { consumed = cursor + 2 }
                    cursor = pointer
                    continue
                }
                guard size <= 63 else { throw DNSParseError.invalidLabel }
                guard cursor + 1 + size <= bytes.count else { throw DNSParseError.truncated }
                let label = bytes[(cursor + 1)..<(cursor + 1 + size)]
                // Suppress unsafe log/SQLite metadata; the original packet still passes through.
                guard label.allSatisfy({ $0 >= 33 && $0 <= 126 && $0 != 46 && $0 != 92 && $0 != 34 }) else {
                    throw DNSParseError.invalidLabel
                }
                expandedBytes += size + 1
                guard expandedBytes <= 255 else { throw DNSParseError.invalidLabel }
                labels.append(String(bytes: label, encoding: .ascii)!.lowercased())
                cursor += size + 1
            }
        }
    }
}
