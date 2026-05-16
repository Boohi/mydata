import Foundation
import SQLite3
import MydataIPC

/// Batched async writer that persists ``IPCMessage`` flow events to the
/// daemon's SQLite store.
///
/// The writer accumulates messages and flushes them on whichever of these
/// happens first:
///   * `pending.count >= batchSize`
///   * the periodic `flushInterval` tick (started by ``start()``)
///   * an explicit ``flush()`` call
///
/// Only `flowStarted` and `flowEnded` are persisted in this slice. Other
/// message kinds (`ping`, `pong`, `unknown`) are intentionally ignored.
public actor Writer {
    private let store: Store
    private let batchSize: Int
    private let flushInterval: Duration

    private var pending: [IPCMessage] = []
    private var flushTask: Task<Void, Never>?

    public init(
        store: Store,
        batchSize: Int = 10,
        flushInterval: Duration = .milliseconds(250)
    ) {
        self.store = store
        self.batchSize = batchSize
        self.flushInterval = flushInterval
    }

    /// Begin the periodic background flush loop. Idempotent.
    public func start() {
        if flushTask != nil { return }
        let interval = flushInterval
        flushTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: interval)
                if Task.isCancelled { break }
                await self?.flush()
            }
        }
    }

    /// Cancel the background flush loop. Pending events remain queued.
    public func stop() {
        flushTask?.cancel()
        flushTask = nil
    }

    /// Enqueue a message. `flowStarted` / `flowEnded` are batched; all other
    /// message kinds are silently dropped.
    public func append(_ msg: IPCMessage) {
        switch msg {
        case .flowStarted, .flowEnded:
            pending.append(msg)
            if pending.count >= batchSize {
                flushNow()
            }
        case .ping, .pong, .unknown:
            return
        }
    }

    /// Flush all currently pending events.
    public func flush() {
        flushNow()
    }

    private func flushNow() {
        if pending.isEmpty { return }
        let batch = pending
        pending.removeAll(keepingCapacity: true)
        do {
            try writeBatch(batch)
        } catch {
            FileHandle.standardError.write(
                Data("writer batch failed: \(error)\n".utf8)
            )
            // Re-insert at front so we don't lose events; future flush retries.
            pending.insert(contentsOf: batch, at: 0)
        }
    }

    private func writeBatch(_ batch: [IPCMessage]) throws {
        try store.runSQL("BEGIN IMMEDIATE;")
        do {
            let ins = try store.prepare(
                "INSERT INTO flows(flow_id, started_ns, ended_ns, family, protocol, " +
                "src_addr, src_port, dst_addr, dst_port) " +
                "VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9);"
            )
            let upd = try store.prepare(
                "UPDATE flows SET ended_ns = ?2 " +
                "WHERE flow_id = ?1 AND ended_ns IS NULL;"
            )
            defer {
                sqlite3_finalize(ins)
                sqlite3_finalize(upd)
            }

            for msg in batch {
                switch msg {
                case let .flowStarted(p):
                    try bindFlow(ins, payload: p, endedNs: nil)
                    let rc = sqlite3_step(ins)
                    guard rc == SQLITE_DONE else {
                        throw StoreError.step(rc, "flowStarted insert")
                    }
                    sqlite3_reset(ins)

                case let .flowEnded(p):
                    sqlite3_bind_int64(upd, 1, Int64(bitPattern: p.flowId))
                    sqlite3_bind_int64(upd, 2, p.timestampNanos)
                    let rc = sqlite3_step(upd)
                    guard rc == SQLITE_DONE else {
                        throw StoreError.step(rc, "flowEnded update")
                    }
                    sqlite3_reset(upd)
                    if store.changes() == 0 {
                        // Orphan end event: persist as a closed-on-arrival row.
                        try bindFlow(ins, payload: p, endedNs: p.timestampNanos)
                        let rc2 = sqlite3_step(ins)
                        guard rc2 == SQLITE_DONE else {
                            throw StoreError.step(rc2, "flowEnded fallback insert")
                        }
                        sqlite3_reset(ins)
                    }

                default:
                    continue
                }
            }

            try store.runSQL("COMMIT;")
        } catch {
            try? store.runSQL("ROLLBACK;")
            throw error
        }
    }

    private func bindFlow(
        _ stmt: OpaquePointer,
        payload p: FlowEventPayload,
        endedNs: Int64?
    ) throws {
        sqlite3_bind_int64(stmt, 1, Int64(bitPattern: p.flowId))
        sqlite3_bind_int64(stmt, 2, p.timestampNanos)
        if let ended = endedNs {
            sqlite3_bind_int64(stmt, 3, ended)
        } else {
            sqlite3_bind_null(stmt, 3)
        }
        sqlite3_bind_int(stmt, 4, Int32(p.family.rawValue))
        sqlite3_bind_int(stmt, 5, Int32(p.protocolNumber))
        p.sourceAddress.bytes.withUnsafeBufferPointer { buf in
            _ = sqlite3_bind_blob(stmt, 6, buf.baseAddress, Int32(buf.count), SQLITE_TRANSIENT)
        }
        sqlite3_bind_int(stmt, 7, Int32(p.sourcePort))
        p.destAddress.bytes.withUnsafeBufferPointer { buf in
            _ = sqlite3_bind_blob(stmt, 8, buf.baseAddress, Int32(buf.count), SQLITE_TRANSIENT)
        }
        sqlite3_bind_int(stmt, 9, Int32(p.destPort))
    }
}
