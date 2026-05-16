import Foundation
import MydataDaemon
import MydataIPC

let supportDir: URL = {
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let dir = support.appendingPathComponent("mydata")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
}()

let socketPath: String = ProcessInfo.processInfo.environment["MYDATA_SOCK"]
    ?? supportDir.appendingPathComponent("daemon.sock").path

let dbPath: String = ProcessInfo.processInfo.environment["MYDATA_DB"]
    ?? supportDir.appendingPathComponent("events.db").path

let writer: Writer
let sweeper: Sweeper
do {
    let store = try Store(path: dbPath)
    let migrator = Migrator(store: store)
    try migrator.migrate()
    writer = Writer(store: store)
    sweeper = Sweeper(store: store)
} catch {
    fputs("mydata-daemon failed to open store at \(dbPath): \(error)\n", stderr)
    exit(1)
}

Task { await writer.start() }
sweeper.start()

let listener = Listener(socketPath: socketPath) { message in
    let line = MessagePrinter.line(for: message)
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
    Task { await writer.append(message) }
}

do {
    try listener.start()
    fputs("mydata-daemon listening on \(socketPath) (db=\(dbPath))\n", stderr)
} catch {
    fputs("mydata-daemon failed to start: \(error)\n", stderr)
    exit(1)
}

dispatchMain()
