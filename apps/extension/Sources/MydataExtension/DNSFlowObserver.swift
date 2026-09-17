import Foundation
import MydataIPC

/// Per-original-flow correlation. Limits affect observation, never transport.
public struct DNSFlowObserver {
    private struct Pending {
        let question: DNSPacket.Question
        let payload: DNSQueryPayload
    }
    private var pending: [UInt16: Pending] = [:]
    private var disabled = false
    private let maximumPending: Int
    public var pendingCount: Int { pending.count }

    public init(maximumPending: Int = 128) { self.maximumPending = max(0, maximumPending) }

    public mutating func query(_ packet: Data, timestampNanos: Int64) -> DNSQueryPayload? {
        guard !disabled,
              let question = try? DNSPacket.parseQuestion(packet),
              let id = try? DNSPacket.transactionID(packet),
              let payload = DNSQueryPayload(timestampNanos: timestampNanos, qtype: question.qtype, qname: question.qname) else { return nil }
        guard pending[id] == nil, pending.count < maximumPending else {
            // Reused in-flight IDs cannot be correlated safely. Continue byte relay only.
            disabled = true
            pending.removeAll()
            return nil
        }
        pending[id] = Pending(question: question, payload: payload)
        return payload
    }

    public mutating func response(_ packet: Data) -> DNSResolutionPayload? {
        guard !disabled,
              let response = try? DNSPacket.parseResponse(packet),
              let request = pending[response.transactionID], request.question == response.question else { return nil }
        pending.removeValue(forKey: response.transactionID)
        return DNSResolutionPayload(query: request.payload, rcode: response.rcode, resolvedIPs: response.resolvedIPs)
    }
}
