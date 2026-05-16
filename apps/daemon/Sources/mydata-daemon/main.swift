import Foundation
import MydataDaemon
import MydataIPC

let socketPath: String = {
    if let override = ProcessInfo.processInfo.environment["MYDATA_SOCK"] {
        return override
    }
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let dir = support.appendingPathComponent("mydata")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("daemon.sock").path
}()

let listener = Listener(socketPath: socketPath) { message in
    let line = MessagePrinter.line(for: message)
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

do {
    try listener.start()
    fputs("mydata-daemon listening on \(socketPath)\n", stderr)
} catch {
    fputs("mydata-daemon failed to start: \(error)\n", stderr)
    exit(1)
}

dispatchMain()
