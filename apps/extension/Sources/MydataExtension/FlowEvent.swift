import Foundation

public enum FlowPhase: String, Sendable {
    case start
    case end
}

/// Minimal, audit-friendly description of a network flow event.
/// Everything is enrichment-free; the daemon does the heavy lifting.
public struct FlowEvent: Sendable, Equatable {
    public let phase: FlowPhase
    public let sourceEndpoint: String
    public let remoteEndpoint: String
    public let protocolName: String
    public let timestamp: Date

    public init(
        phase: FlowPhase,
        sourceEndpoint: String,
        remoteEndpoint: String,
        protocolName: String,
        timestamp: Date
    ) {
        self.phase = phase
        self.sourceEndpoint = sourceEndpoint
        self.remoteEndpoint = remoteEndpoint
        self.protocolName = protocolName
        self.timestamp = timestamp
    }

    public var logLine: String {
        let ts = ISO8601DateFormatter().string(from: timestamp)
        return "ts=\(ts) phase=\(phase.rawValue) src=\(sourceEndpoint) dst=\(remoteEndpoint) proto=\(protocolName)"
    }
}
