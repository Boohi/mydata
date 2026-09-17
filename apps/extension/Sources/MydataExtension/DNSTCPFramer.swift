import Foundation

/// Bounded observation of DNS-over-TCP frames; never supplies forwarding bytes.
/// Oversize/empty observations are skipped without losing frame boundaries.
public struct DNSTCPFramer {
    private let maximumMessageBytes: Int
    private var prefix: [UInt8] = []
    private var body = Data()
    private var remaining = 0
    private var observing = false
    public var bufferedByteCount: Int { prefix.count + body.count }

    public init(maximumMessageBytes: Int = 65535) {
        self.maximumMessageBytes = min(65535, max(0, maximumMessageBytes))
    }

    public mutating func append(_ chunk: Data) -> [Data] {
        var messages: [Data] = []
        var cursor = chunk.startIndex
        while cursor < chunk.endIndex {
            if remaining == 0 {
                prefix.append(chunk[cursor])
                cursor += 1
                if prefix.count < 2 { continue }
                remaining = Int(prefix[0]) << 8 | Int(prefix[1])
                prefix.removeAll(keepingCapacity: true)
                observing = remaining > 0 && remaining <= maximumMessageBytes
                if remaining == 0 { continue }
            }
            let count = min(remaining, chunk.endIndex - cursor)
            if observing { body.append(chunk[cursor..<(cursor + count)]) }
            remaining -= count
            cursor += count
            if remaining == 0 && observing {
                messages.append(body)
                body = Data()
            }
        }
        return messages
    }
}
