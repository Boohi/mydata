/// Deadline state only: no per-request scheduled callbacks or retained closures.
/// One session timer sweeps this table, which contains only live exchanges.
public struct DNSExchangeDeadlines<Key: Hashable> {
    private var deadlines: [Key: UInt64] = [:]
    private let capacity: Int
    public var count: Int { deadlines.count }

    public init(capacity: Int) { self.capacity = max(0, capacity) }
    public mutating func insert(_ key: Key, deadline: UInt64) -> Bool {
        guard deadlines[key] == nil, deadlines.count < capacity else { return false }
        deadlines[key] = deadline
        return true
    }
    public mutating func remove(_ key: Key) { deadlines.removeValue(forKey: key) }
    public mutating func expire(at now: UInt64) -> [Key] {
        let expired = deadlines.compactMap { $0.value <= now ? $0.key : nil }
        for key in expired { deadlines.removeValue(forKey: key) }
        return expired
    }
}
