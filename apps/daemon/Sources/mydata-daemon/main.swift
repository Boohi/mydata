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
    let writerStore = try Store(path: dbPath)
    let migrator = Migrator(store: writerStore)
    try migrator.migrate()
    writer = Writer(store: writerStore)
    // Sweeper opens its own connection so the timer queue never contends with
    // the writer actor on a shared sqlite3 handle (see Store: not thread-safe).
    sweeper = try Sweeper(dbPath: dbPath)
} catch {
    fputs("mydata-daemon failed to open store at \(dbPath): \(error)\n", stderr)
    exit(1)
}

// Start the writer's background flush loop *before* the listener opens, so no
// appended events sit around in the actor's pending buffer waiting for start().
let startup = DispatchSemaphore(value: 0)
Task {
    await writer.start()
    startup.signal()
}
startup.wait()
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
