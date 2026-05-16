import Foundation
import SQLite3

/// Retention sweeper. Deletes flows and DNS queries older than the configured
/// `retention_days` meta value. Runs on a periodic timer when `start()` is
/// invoked, or one-shot via `sweepOnce(nowNs:)` for tests / on-demand cleanup.
public final class Sweeper {
    private let store: Store
    private let interval: TimeInterval
    private let queue = DispatchQueue(label: "io.mydata.daemon.sweeper")
    private var timer: DispatchSourceTimer?

    public init(store: Store, interval: TimeInterval = 600) {
        self.store = store
        self.interval = interval
    }

    /// Starts the periodic sweep timer. Idempotent.
    public func start() {
        queue.sync {
            guard timer == nil else { return }
            let t = DispatchSource.makeTimerSource(queue: queue)
            t.schedule(deadline: .now() + interval, repeating: interval)
            t.setEventHandler { [weak self] in
                guard let self else { return }
                let nowNs = Int64(Date().timeIntervalSince1970 * 1_000_000_000)
                try? self.sweepOnce(nowNs: nowNs)
            }
            t.resume()
            timer = t
        }
    }

    /// Stops the periodic sweep timer. Idempotent.
    public func stop() {
        queue.sync {
            timer?.cancel()
            timer = nil
        }
    }

    /// Runs a single sweep pass using `nowNs` as the reference time.
    public func sweepOnce(nowNs: Int64) throws {
        let days = Int(try store.metaGet("retention_days") ?? "30") ?? 30
        let cutoffNs = nowNs - Int64(days) * 86_400 * 1_000_000_000

        try store.runSQL("BEGIN IMMEDIATE;")
        do {
            try deleteOlderThan(cutoffNs, sql: "DELETE FROM flows WHERE started_ns < ?1;")
            try deleteOlderThan(cutoffNs, sql: "DELETE FROM dns_queries WHERE ts_ns < ?1;")
            try store.runSQL("COMMIT;")
        } catch {
            try? store.runSQL("ROLLBACK;")
            throw error
        }
    }

    private func deleteOlderThan(_ cutoffNs: Int64, sql: String) throws {
        let stmt = try store.prepare(sql)
        defer { sqlite3_finalize(stmt) }
        let brc = sqlite3_bind_int64(stmt, 1, cutoffNs)
        if brc != SQLITE_OK {
            throw StoreError.bind(brc, "sweeper bind cutoff")
        }
        let rc = sqlite3_step(stmt)
        guard rc == SQLITE_DONE else {
            throw StoreError.step(rc, "sweeper delete")
        }
    }
}
