import Foundation

/// Errors thrown by ``Migrator``.
public enum MigratorError: Error, CustomStringConvertible {
    case resourcesUnavailable
    case badFilename(String)

    public var description: String {
        switch self {
        case .resourcesUnavailable:
            return "Migrator: bundle has no resource URL; check Package.swift resources"
        case let .badFilename(name):
            return "Migrator: migration filename '\(name)' does not start with a 4-digit version"
        }
    }
}

/// Applies versioned SQL migrations from the bundled `Migrations/` resource
/// directory to a ``Store`` in ascending version order.
///
/// Migrations are forward-only. The current schema version is tracked in the
/// `meta` table under key `schema_version`. Each migration file must update
/// `meta.schema_version` itself (the migrator does not write it implicitly).
public struct Migrator {
    public let store: Store
    public let bundle: Bundle

    public init(store: Store, bundle: Bundle? = nil) {
        self.store = store
        self.bundle = bundle ?? .module
    }

    /// Discover, sort, and apply migrations whose version exceeds the current
    /// `meta.schema_version`. Each migration runs inside a transaction and is
    /// rolled back on failure.
    public func migrate() throws {
        // Before the initial migration runs, the `meta` table does not exist.
        // Treat any read failure (e.g. "no such table") as version 0.
        let currentVersion: Int
        if let raw = try? store.metaGet("schema_version"), let parsed = Int(raw) {
            currentVersion = parsed
        } else {
            currentVersion = 0
        }

        guard let resourceURL = bundle.resourceURL else {
            throw MigratorError.resourcesUnavailable
        }
        let migrationsURL = resourceURL.appendingPathComponent("Migrations", isDirectory: true)
        let fm = FileManager.default
        let entries: [URL]
        do {
            entries = try fm.contentsOfDirectory(at: migrationsURL,
                                                 includingPropertiesForKeys: nil)
        } catch {
            // A missing or unreadable Migrations directory is a packaging bug,
            // not "no migrations to run" — surface it instead of silently
            // leaving the schema uncreated.
            throw MigratorError.resourcesUnavailable
        }
        let sqlFiles = entries.filter { $0.pathExtension.lowercased() == "sql" }

        var versioned: [(version: Int, url: URL)] = []
        for url in sqlFiles {
            let name = url.lastPathComponent
            guard name.count >= 4 else { throw MigratorError.badFilename(name) }
            let prefix = String(name.prefix(4))
            guard let v = Int(prefix) else { throw MigratorError.badFilename(name) }
            versioned.append((v, url))
        }
        versioned.sort { $0.version < $1.version }

        for entry in versioned where entry.version > currentVersion {
            let sql = try String(contentsOf: entry.url, encoding: .utf8)
            try store.runSQL("BEGIN;")
            do {
                try store.runSQL(sql)
                try store.runSQL("COMMIT;")
            } catch {
                try? store.runSQL("ROLLBACK;")
                throw error
            }
        }
    }
}
