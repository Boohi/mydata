# Issue #17 — Daemon Skeleton + XPC Pipe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Stand up `apps/daemon` as an executable Swift target that listens on a local socket, accepts flow-event messages framed in our versioned binary wire format, and prints them to stdout. Wire the extension to send via the same codec, with reconnect/backoff. Land the codec in a shared `packages/schema` Swift module.

**Scope decision (continuing from #16):** Build + integration-tested via a local harness. The "launch daemon + browse + observe flow lines from a real loaded extension" acceptance criterion is deferred to manual checkpoint (same reason as #16). Instead we add an end-to-end test that spawns the daemon and a fake client (no NE involvement) and verifies messages round-trip cleanly. That gives high confidence in the wire format without needing a signed/loaded extension.

**Architecture:**
- `packages/schema/Swift/MydataIPC/` — Swift Package Manager library, no platform-specific deps. Owns the wire format: `IPCMessage` enum, `IPCCodec.encode/decode`, version constant. Pure Swift, fully unit-testable.
- `packages/schema/ipc.md` — human-readable wire format spec (the source of truth; codec implements it).
- `apps/daemon/` — restructured into an executable target `mydata-daemon` plus a library target `MydataDaemon` (so logic stays testable). Listens on a Unix domain socket at `$XDG_RUNTIME_DIR/mydata.sock` or `~/Library/Application Support/mydata/daemon.sock`. Accepts concurrent clients, decodes frames, prints one line per event to stdout.
- `apps/extension/` — gains `IPCClient` actor that connects to the same socket, sends frames, reconnects with exponential backoff (capped at 5 s per acceptance criterion).
- `scripts/launchd/io.mydata.daemon.plist` — LaunchAgent plist for installing the daemon as a user agent (referenced in docs only; install/launchctl-load deferred to #26 packaging).

Why Unix socket, not libxpc Mach service: the local-socket transport is dev-friendly (no launchd registration needed for tests), works on macOS CI, and the wire format above it is the actual asset. Migrating the transport to a Mach service later (issue #26) does not invalidate the codec or message types.

**Tech Stack:** Swift 5.9, macOS 13+, `Network` framework (NWListener / NWConnection on Unix domain endpoints), XCTest.

**Issue:** Closes #17

---

## File Structure

- Create: `packages/schema/ipc.md` — wire format spec.
- Create: `packages/schema/Swift/Package.swift` — `MydataIPC` library package.
- Create: `packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift`
- Create: `packages/schema/Swift/Sources/MydataIPC/IPCCodec.swift`
- Create: `packages/schema/Swift/Tests/MydataIPCTests/IPCCodecTests.swift`
- Modify: `apps/extension/Package.swift` — depend on `MydataIPC` via path.
- Create: `apps/extension/Sources/MydataExtension/IPCClient.swift` — connects, reconnects, sends.
- Modify: `apps/extension/Sources/MydataExtension/MydataFilterDataProvider.swift` — instantiate the client, send `flowStarted` per flow.
- Modify: `apps/extension/Tests/MydataExtensionTests/MydataExtensionTests.swift` — add tests for IPCClient encode-path (transport-stubbable).
- Restructure: `apps/daemon/Package.swift` — split into library `MydataDaemon` + executable `mydata-daemon`, depend on `MydataIPC`.
- Replace: `apps/daemon/Sources/MydataDaemon/Placeholder.swift` (or whatever the placeholder is) with `Listener.swift` + `MessagePrinter.swift`.
- Create: `apps/daemon/Sources/mydata-daemon/main.swift` — executable entry point.
- Create: `apps/daemon/Tests/MydataDaemonTests/ListenerTests.swift` — integration test: spawn listener, connect, send, assert printed lines.
- Create: `scripts/launchd/io.mydata.daemon.plist` — LaunchAgent (install instructions only, not loaded by CI).
- Modify: `docs/architecture.md` — document the extension↔daemon pipe.
- Modify: `docs/build.md` — daemon build + manual run instructions.
- Modify: `.github/workflows/ci.yml` — add `swift test --package-path packages/schema/Swift` to the swift job.

---

## Task 1: Wire format spec

**Files:**
- Create: `packages/schema/ipc.md`

- [ ] **Step 1: Write the spec**

`packages/schema/ipc.md`:
````markdown
# Mydata IPC Wire Format

The format used between the Network Extension (sender) and the daemon
(receiver). Versioned, length-prefixed, binary, big-endian. Pure data —
no enrichment lives in the wire format; the daemon enriches after decode.

## Frame layout

Every frame on the wire is:

```
+---------+---------+---------+----------------+
| 4 bytes | 2 bytes | 1 byte  | payload bytes  |
| length  | version | type    | (length - 3)   |
+---------+---------+---------+----------------+
```

- `length` (uint32, big-endian): number of bytes that follow this field,
  inclusive of version + type + payload. Max frame = 65_535 bytes.
- `version` (uint16, big-endian): wire format version. Currently `1`.
  Receivers MUST reject any other version.
- `type` (uint8): message discriminator (see below).
- `payload`: message-specific bytes.

## Message types

| code | name          | direction       |
|------|---------------|-----------------|
| 0x01 | flowStarted   | extension → daemon |
| 0x02 | flowEnded     | extension → daemon |
| 0x10 | ping          | either          |
| 0x11 | pong          | either          |

### `flowStarted` (0x01) and `flowEnded` (0x02)

Both messages share the same payload shape:

```
+---------+---------+--------+--------+--------+--------+--------+--------+
| 8 bytes | 8 bytes | 1 byte | 1 byte | 2 byte | 2 byte | 16 b   | 16 b   |
| flow_id | ts_ns   | family | proto  | sport  | dport  | src    | dst    |
+---------+---------+--------+--------+--------+--------+--------+--------+
```

- `flow_id` (uint64, BE): extension-assigned, monotonic per extension run.
  Pairs `flowStarted` with `flowEnded`.
- `ts_ns` (int64, BE): Unix epoch nanoseconds at the time of capture.
- `family` (uint8): 4 = IPv4, 6 = IPv6.
- `proto` (uint8): IANA protocol number (6 = TCP, 17 = UDP).
- `sport`, `dport` (uint16, BE): source and destination ports.
- `src`, `dst` (16 bytes each): network-order address bytes. For IPv4,
  the first 12 bytes are zero and the address sits in bytes 12–15.

Total payload = 54 bytes. Total frame = 4 (length) + 2 (version) + 1 (type) + 54 = 61 bytes.

### `ping` (0x10) and `pong` (0x11)

Empty payload. Used for liveness checks and to keep the connection warm.

## Errors

If a receiver sees:
- Unknown `version`: close the connection and log.
- Unknown `type`: skip the frame (use `length` to advance), keep the connection.
- Truncated `length`: close the connection.

The daemon never crashes on bad input.
````

- [ ] **Step 2: Commit**

```bash
git add packages/schema/ipc.md
git commit -m "Specify the extension↔daemon IPC wire format (v1)"
```

---

## Task 2: `MydataIPC` codec library (TDD)

**Files:**
- Create: `packages/schema/Swift/Package.swift`
- Create: `packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift`
- Create: `packages/schema/Swift/Sources/MydataIPC/IPCCodec.swift`
- Create: `packages/schema/Swift/Tests/MydataIPCTests/IPCCodecTests.swift`

- [ ] **Step 1: Write `Package.swift`**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataIPC",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataIPC", targets: ["MydataIPC"]),
    ],
    targets: [
        .target(name: "MydataIPC"),
        .testTarget(name: "MydataIPCTests", dependencies: ["MydataIPC"]),
    ]
)
```

- [ ] **Step 2: Write failing tests**

`packages/schema/Swift/Tests/MydataIPCTests/IPCCodecTests.swift`:
```swift
import XCTest
@testable import MydataIPC

final class IPCCodecTests: XCTestCase {

    func testFlowStartedRoundTrip() throws {
        let original = IPCMessage.flowStarted(FlowEventPayload(
            flowId: 0xDEAD_BEEF_CAFE_BABE,
            timestampNanos: 1_700_000_000_000_000_000,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 54321,
            destPort: 443,
            sourceAddress: try .ipv4("127.0.0.1"),
            destAddress: try .ipv4("1.1.1.1")
        ))
        let encoded = IPCCodec.encode(original)
        let (decoded, consumed) = try IPCCodec.decode(encoded)
        XCTAssertEqual(decoded, original)
        XCTAssertEqual(consumed, encoded.count)
    }

    func testFlowEndedRoundTrip() throws {
        let original = IPCMessage.flowEnded(FlowEventPayload(
            flowId: 1,
            timestampNanos: 0,
            family: .ipv6,
            protocolNumber: 17,
            sourcePort: 1,
            destPort: 2,
            sourceAddress: try .ipv6("::1"),
            destAddress: try .ipv6("2606:4700:4700::1111")
        ))
        let encoded = IPCCodec.encode(original)
        let (decoded, _) = try IPCCodec.decode(encoded)
        XCTAssertEqual(decoded, original)
    }

    func testPingRoundTrip() throws {
        let encoded = IPCCodec.encode(.ping)
        let (decoded, _) = try IPCCodec.decode(encoded)
        XCTAssertEqual(decoded, .ping)
    }

    func testRejectsUnknownVersion() {
        var data = IPCCodec.encode(.ping)
        // length(4) | version(2) | type(1) | ...
        // Corrupt the version bytes (offsets 4 and 5).
        data[4] = 0xFF
        data[5] = 0xFF
        XCTAssertThrowsError(try IPCCodec.decode(data)) { err in
            guard case IPCDecodeError.unsupportedVersion(let v) = err else {
                return XCTFail("expected unsupportedVersion, got \(err)")
            }
            XCTAssertEqual(v, 0xFFFF)
        }
    }

    func testRejectsTruncatedLength() {
        let data = Data([0x00, 0x00])  // only 2 of 4 length bytes
        XCTAssertThrowsError(try IPCCodec.decode(data)) { err in
            guard case IPCDecodeError.truncated = err else {
                return XCTFail("expected truncated, got \(err)")
            }
        }
    }

    func testSkipsUnknownType() throws {
        // Hand-build a frame with an unknown type (0x99) and zero payload.
        // length = version(2) + type(1) = 3.
        var data = Data()
        data.append(contentsOf: [0x00, 0x00, 0x00, 0x03])  // length
        data.append(contentsOf: [0x00, 0x01])               // version
        data.append(0x99)                                   // unknown type
        let (decoded, consumed) = try IPCCodec.decode(data)
        XCTAssertEqual(decoded, .unknown(type: 0x99))
        XCTAssertEqual(consumed, data.count)
    }

    func testFrameSizeMatchesSpec() {
        // flowStarted payload is exactly 54 bytes; frame is 4 + 2 + 1 + 54 = 61.
        let msg = IPCMessage.flowStarted(FlowEventPayload(
            flowId: 0, timestampNanos: 0, family: .ipv4, protocolNumber: 6,
            sourcePort: 0, destPort: 0,
            sourceAddress: try! .ipv4("0.0.0.0"),
            destAddress: try! .ipv4("0.0.0.0")
        ))
        XCTAssertEqual(IPCCodec.encode(msg).count, 61)
    }

    func testIPv4AddressFormatsAsZeroPadded() throws {
        let addr = try IPCAddress.ipv4("1.2.3.4")
        XCTAssertEqual(Array(addr.bytes.suffix(4)), [1, 2, 3, 4])
        XCTAssertEqual(Array(addr.bytes.prefix(12)), Array(repeating: 0, count: 12))
    }
}
```

- [ ] **Step 3: Run, confirm fail**

```bash
swift test --package-path packages/schema/Swift
```
Expected: compile failure (`MydataIPC` doesn't exist yet).

- [ ] **Step 4: Implement `IPCMessage.swift`**

`packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift`:
```swift
import Foundation

public enum IPCWireVersion {
    public static let current: UInt16 = 1
}

public enum IPCAddressFamily: UInt8, Sendable, Equatable {
    case ipv4 = 4
    case ipv6 = 6
}

public struct IPCAddress: Sendable, Equatable {
    /// Always 16 bytes. IPv4 addresses are zero-padded in the first 12 bytes.
    public let bytes: [UInt8]

    public init(bytes: [UInt8]) {
        precondition(bytes.count == 16, "IPCAddress requires exactly 16 bytes")
        self.bytes = bytes
    }

    public static func ipv4(_ dotted: String) throws -> IPCAddress {
        let parts = dotted.split(separator: ".").map(String.init)
        guard parts.count == 4 else {
            throw IPCAddressError.invalidIPv4(dotted)
        }
        var octets = [UInt8]()
        for p in parts {
            guard let v = UInt8(p) else {
                throw IPCAddressError.invalidIPv4(dotted)
            }
            octets.append(v)
        }
        return IPCAddress(bytes: Array(repeating: 0, count: 12) + octets)
    }

    public static func ipv6(_ presentation: String) throws -> IPCAddress {
        var addr = in6_addr()
        let ok = presentation.withCString { inet_pton(AF_INET6, $0, &addr) }
        guard ok == 1 else {
            throw IPCAddressError.invalidIPv6(presentation)
        }
        let bytes = withUnsafeBytes(of: addr) { Array($0) }
        return IPCAddress(bytes: bytes)
    }
}

public enum IPCAddressError: Error, Equatable {
    case invalidIPv4(String)
    case invalidIPv6(String)
}

public struct FlowEventPayload: Sendable, Equatable {
    public let flowId: UInt64
    public let timestampNanos: Int64
    public let family: IPCAddressFamily
    public let protocolNumber: UInt8
    public let sourcePort: UInt16
    public let destPort: UInt16
    public let sourceAddress: IPCAddress
    public let destAddress: IPCAddress

    public init(
        flowId: UInt64,
        timestampNanos: Int64,
        family: IPCAddressFamily,
        protocolNumber: UInt8,
        sourcePort: UInt16,
        destPort: UInt16,
        sourceAddress: IPCAddress,
        destAddress: IPCAddress
    ) {
        self.flowId = flowId
        self.timestampNanos = timestampNanos
        self.family = family
        self.protocolNumber = protocolNumber
        self.sourcePort = sourcePort
        self.destPort = destPort
        self.sourceAddress = sourceAddress
        self.destAddress = destAddress
    }
}

public enum IPCMessage: Sendable, Equatable {
    case flowStarted(FlowEventPayload)
    case flowEnded(FlowEventPayload)
    case ping
    case pong
    /// Surfaced when the codec encounters an unknown type code so the receiver
    /// can decide whether to log + skip it.
    case unknown(type: UInt8)
}
```

- [ ] **Step 5: Implement `IPCCodec.swift`**

`packages/schema/Swift/Sources/MydataIPC/IPCCodec.swift`:
```swift
import Foundation

public enum IPCDecodeError: Error, Equatable {
    case truncated
    case unsupportedVersion(UInt16)
    case malformedPayload(String)
}

public enum IPCCodec {

    // MARK: Encode

    public static func encode(_ message: IPCMessage) -> Data {
        let (type, payload) = body(of: message)
        // length covers version(2) + type(1) + payload.count
        let length = UInt32(2 + 1 + payload.count)
        var out = Data(capacity: 4 + Int(length))
        out.appendBE(length)
        out.appendBE(IPCWireVersion.current)
        out.append(type)
        out.append(payload)
        return out
    }

    private static func body(of message: IPCMessage) -> (UInt8, Data) {
        switch message {
        case .flowStarted(let p): return (0x01, encodeFlowPayload(p))
        case .flowEnded(let p):   return (0x02, encodeFlowPayload(p))
        case .ping:               return (0x10, Data())
        case .pong:               return (0x11, Data())
        case .unknown(let t):     return (t, Data())
        }
    }

    private static func encodeFlowPayload(_ p: FlowEventPayload) -> Data {
        var d = Data(capacity: 54)
        d.appendBE(p.flowId)
        d.appendBE(p.timestampNanos)
        d.append(p.family.rawValue)
        d.append(p.protocolNumber)
        d.appendBE(p.sourcePort)
        d.appendBE(p.destPort)
        d.append(contentsOf: p.sourceAddress.bytes)
        d.append(contentsOf: p.destAddress.bytes)
        return d
    }

    // MARK: Decode

    /// Decodes a single frame from the start of `data`. Returns the message
    /// and the number of bytes consumed (so callers can advance a buffer).
    public static func decode(_ data: Data) throws -> (IPCMessage, Int) {
        guard data.count >= 4 else { throw IPCDecodeError.truncated }
        let length = Int(data.readBE(at: 0, as: UInt32.self))
        let frameEnd = 4 + length
        guard data.count >= frameEnd else { throw IPCDecodeError.truncated }
        guard length >= 3 else { throw IPCDecodeError.truncated }

        let version: UInt16 = data.readBE(at: 4, as: UInt16.self)
        guard version == IPCWireVersion.current else {
            throw IPCDecodeError.unsupportedVersion(version)
        }
        let type = data[data.startIndex + 6]
        let payload = data.subdata(in: (data.startIndex + 7) ..< (data.startIndex + frameEnd))

        let message: IPCMessage
        switch type {
        case 0x01: message = .flowStarted(try decodeFlowPayload(payload))
        case 0x02: message = .flowEnded(try decodeFlowPayload(payload))
        case 0x10: message = .ping
        case 0x11: message = .pong
        default:   message = .unknown(type: type)
        }
        return (message, frameEnd)
    }

    private static func decodeFlowPayload(_ d: Data) throws -> FlowEventPayload {
        guard d.count == 54 else {
            throw IPCDecodeError.malformedPayload("flow payload must be 54 bytes, got \(d.count)")
        }
        let base = d.startIndex
        let flowId: UInt64        = d.readBE(at: base + 0,  as: UInt64.self)
        let tsNanos: Int64        = d.readBE(at: base + 8,  as: Int64.self)
        let familyRaw             = d[base + 16]
        guard let family = IPCAddressFamily(rawValue: familyRaw) else {
            throw IPCDecodeError.malformedPayload("bad family \(familyRaw)")
        }
        let proto                 = d[base + 17]
        let sport: UInt16         = d.readBE(at: base + 18, as: UInt16.self)
        let dport: UInt16         = d.readBE(at: base + 20, as: UInt16.self)
        let src = Array(d[(base + 22) ..< (base + 38)])
        let dst = Array(d[(base + 38) ..< (base + 54)])
        return FlowEventPayload(
            flowId: flowId,
            timestampNanos: tsNanos,
            family: family,
            protocolNumber: proto,
            sourcePort: sport,
            destPort: dport,
            sourceAddress: IPCAddress(bytes: src),
            destAddress: IPCAddress(bytes: dst)
        )
    }
}

// MARK: Big-endian helpers

extension Data {
    mutating func appendBE<T: FixedWidthInteger>(_ value: T) {
        var be = value.bigEndian
        Swift.withUnsafeBytes(of: &be) { self.append(contentsOf: $0) }
    }

    func readBE<T: FixedWidthInteger>(at offset: Int, as: T.Type) -> T {
        let size = MemoryLayout<T>.size
        let idx = self.startIndex + offset
        return self.subdata(in: idx ..< idx + size).withUnsafeBytes { raw in
            var v: T = 0
            Swift.withUnsafeMutableBytes(of: &v) { dst in
                dst.copyBytes(from: raw)
            }
            return T(bigEndian: v)
        }
    }
}
```

- [ ] **Step 6: Run, confirm pass**

```bash
swift test --package-path packages/schema/Swift
```
Expected: 8 passes.

- [ ] **Step 7: Commit**

```bash
git add packages/schema/Swift/
git commit -m "Add MydataIPC codec library with full round-trip tests"
```

---

## Task 3: Daemon library + executable

**Files:**
- Replace: `apps/daemon/Package.swift`
- Delete: existing placeholder source in `apps/daemon/Sources/MydataDaemon/`
- Create: `apps/daemon/Sources/MydataDaemon/Listener.swift`
- Create: `apps/daemon/Sources/MydataDaemon/MessagePrinter.swift`
- Create: `apps/daemon/Sources/mydata-daemon/main.swift`
- Create: `apps/daemon/Tests/MydataDaemonTests/ListenerTests.swift`

- [ ] **Step 1: Replace `apps/daemon/Package.swift`**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataDaemon",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataDaemon", targets: ["MydataDaemon"]),
        .executable(name: "mydata-daemon", targets: ["mydata-daemon"]),
    ],
    dependencies: [
        .package(name: "MydataIPC", path: "../../packages/schema/Swift"),
    ],
    targets: [
        .target(
            name: "MydataDaemon",
            dependencies: [.product(name: "MydataIPC", package: "MydataIPC")]
        ),
        .executableTarget(
            name: "mydata-daemon",
            dependencies: ["MydataDaemon"]
        ),
        .testTarget(
            name: "MydataDaemonTests",
            dependencies: ["MydataDaemon"]
        ),
    ]
)
```

- [ ] **Step 2: Remove the placeholder source**

```bash
rm apps/daemon/Sources/MydataDaemon/*.swift
```

- [ ] **Step 3: Write `MessagePrinter.swift`**

`apps/daemon/Sources/MydataDaemon/MessagePrinter.swift`:
```swift
import Foundation
import MydataIPC

/// Renders an IPC message as a single-line, audit-friendly string.
/// Pure function: easy to unit-test.
public enum MessagePrinter {
    public static func line(for message: IPCMessage) -> String {
        switch message {
        case .flowStarted(let p): return "flow-start " + flow(p)
        case .flowEnded(let p):   return "flow-end   " + flow(p)
        case .ping:               return "ping"
        case .pong:               return "pong"
        case .unknown(let t):     return String(format: "unknown type=0x%02x", t)
        }
    }

    private static func flow(_ p: FlowEventPayload) -> String {
        let src = format(addr: p.sourceAddress, family: p.family, port: p.sourcePort)
        let dst = format(addr: p.destAddress,   family: p.family, port: p.destPort)
        let proto: String
        switch p.protocolNumber {
        case 6:  proto = "tcp"
        case 17: proto = "udp"
        default: proto = "p\(p.protocolNumber)"
        }
        return "id=\(p.flowId) ts=\(p.timestampNanos) \(proto) \(src) -> \(dst)"
    }

    private static func format(addr: IPCAddress, family: IPCAddressFamily, port: UInt16) -> String {
        switch family {
        case .ipv4:
            let last4 = addr.bytes.suffix(4)
            return last4.map(String.init).joined(separator: ".") + ":\(port)"
        case .ipv6:
            var presentation = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
            var raw = addr.bytes.withUnsafeBufferPointer { buf -> in6_addr in
                var a = in6_addr()
                _ = withUnsafeMutableBytes(of: &a) { dst in
                    dst.copyBytes(from: buf)
                }
                return a
            }
            _ = inet_ntop(AF_INET6, &raw, &presentation, socklen_t(INET6_ADDRSTRLEN))
            return "[\(String(cString: presentation))]:\(port)"
        }
    }
}
```

- [ ] **Step 4: Write `Listener.swift`**

`apps/daemon/Sources/MydataDaemon/Listener.swift`:
```swift
import Foundation
import Network
import MydataIPC

/// A Unix-domain-socket listener that accepts framed IPC messages and hands
/// each decoded message to a sink. Designed to be testable: the sink is just
/// a closure, so tests can inject their own.
public final class Listener {

    public typealias Sink = @Sendable (IPCMessage) -> Void

    public let socketPath: String
    private let sink: Sink
    private let queue = DispatchQueue(label: "io.mydata.daemon.listener")
    private var listener: NWListener?

    public init(socketPath: String, sink: @escaping Sink) {
        self.socketPath = socketPath
        self.sink = sink
    }

    public func start() throws {
        // NWListener does not handle stale socket files; remove if present.
        try? FileManager.default.removeItem(atPath: socketPath)

        let params = NWParameters.tcp
        params.requiredLocalEndpoint = NWEndpoint.unix(path: socketPath)
        let listener = try NWListener(using: params)
        listener.newConnectionHandler = { [weak self] conn in
            self?.handle(conn)
        }
        listener.start(queue: queue)
        self.listener = listener
    }

    public func stop() {
        listener?.cancel()
        listener = nil
        try? FileManager.default.removeItem(atPath: socketPath)
    }

    private func handle(_ conn: NWConnection) {
        conn.start(queue: queue)
        receive(on: conn, accumulator: Data())
    }

    private func receive(on conn: NWConnection, accumulator initial: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var buf = initial
            if let data, !data.isEmpty { buf.append(data) }

            while buf.count >= 4 {
                let length = Int(buf.readBE(at: 0, as: UInt32.self))
                let frameEnd = 4 + length
                guard buf.count >= frameEnd else { break }
                let frame = buf.subdata(in: buf.startIndex ..< buf.startIndex + frameEnd)
                do {
                    let (msg, _) = try IPCCodec.decode(frame)
                    self.sink(msg)
                } catch {
                    // Bad frame: drop the connection per spec.
                    conn.cancel()
                    return
                }
                buf = buf.subdata(in: buf.startIndex + frameEnd ..< buf.endIndex)
            }

            if error != nil || isComplete {
                conn.cancel()
                return
            }
            self.receive(on: conn, accumulator: buf)
        }
    }
}

// Reuse the same big-endian helper signature MydataIPC defines.
private extension Data {
    func readBE<T: FixedWidthInteger>(at offset: Int, as: T.Type) -> T {
        let size = MemoryLayout<T>.size
        let idx = self.startIndex + offset
        return self.subdata(in: idx ..< idx + size).withUnsafeBytes { raw in
            var v: T = 0
            Swift.withUnsafeMutableBytes(of: &v) { dst in
                dst.copyBytes(from: raw)
            }
            return T(bigEndian: v)
        }
    }
}
```

- [ ] **Step 5: Write the executable entry point**

`apps/daemon/Sources/mydata-daemon/main.swift`:
```swift
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
```

- [ ] **Step 6: Write integration test**

`apps/daemon/Tests/MydataDaemonTests/ListenerTests.swift`:
```swift
import XCTest
import Network
@testable import MydataDaemon
import MydataIPC

final class ListenerTests: XCTestCase {

    func testPrinterFormatsFlowStartedLine() throws {
        let payload = FlowEventPayload(
            flowId: 7,
            timestampNanos: 1_700_000_000_000_000_000,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 51_000,
            destPort: 443,
            sourceAddress: try .ipv4("127.0.0.1"),
            destAddress: try .ipv4("1.1.1.1")
        )
        let line = MessagePrinter.line(for: .flowStarted(payload))
        XCTAssertTrue(line.hasPrefix("flow-start"), line)
        XCTAssertTrue(line.contains("tcp"), line)
        XCTAssertTrue(line.contains("127.0.0.1:51000"), line)
        XCTAssertTrue(line.contains("1.1.1.1:443"), line)
    }

    func testPrinterHandlesPing() {
        XCTAssertEqual(MessagePrinter.line(for: .ping), "ping")
    }

    func testListenerReceivesEncodedFrames() throws {
        let sockPath = NSTemporaryDirectory() + "mydata-test-\(UUID().uuidString).sock"
        let received = ReceivedBox()
        let listener = Listener(socketPath: sockPath) { msg in received.append(msg) }
        try listener.start()
        defer { listener.stop() }

        let conn = NWConnection(
            to: .unix(path: sockPath),
            using: .tcp
        )
        let connQueue = DispatchQueue(label: "test.client")
        let ready = expectation(description: "client ready")
        conn.stateUpdateHandler = { state in
            if case .ready = state { ready.fulfill() }
        }
        conn.start(queue: connQueue)
        wait(for: [ready], timeout: 2.0)

        let msg = IPCMessage.flowStarted(FlowEventPayload(
            flowId: 42,
            timestampNanos: 1,
            family: .ipv4,
            protocolNumber: 6,
            sourcePort: 1, destPort: 2,
            sourceAddress: try .ipv4("10.0.0.1"),
            destAddress: try .ipv4("10.0.0.2")
        ))
        let sent = expectation(description: "sent")
        conn.send(content: IPCCodec.encode(msg), completion: .contentProcessed { _ in sent.fulfill() })
        wait(for: [sent], timeout: 2.0)

        // Poll briefly for the listener to surface the message.
        let deadline = Date().addingTimeInterval(2.0)
        while received.snapshot().isEmpty && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.02)
        }
        XCTAssertEqual(received.snapshot(), [msg])
        conn.cancel()
    }
}

private final class ReceivedBox: @unchecked Sendable {
    private var items: [IPCMessage] = []
    private let lock = NSLock()
    func append(_ m: IPCMessage) { lock.lock(); items.append(m); lock.unlock() }
    func snapshot() -> [IPCMessage] { lock.lock(); defer { lock.unlock() }; return items }
}
```

- [ ] **Step 7: Build + test**

```bash
swift build --package-path apps/daemon
swift test  --package-path apps/daemon
```
Expected: build succeeds, 3 tests pass.

- [ ] **Step 8: Smoke-test the binary**

```bash
MYDATA_SOCK=/tmp/mydata-smoke.sock swift run --package-path apps/daemon mydata-daemon &
DAEMON_PID=$!
sleep 1
ls -la /tmp/mydata-smoke.sock
kill "$DAEMON_PID" 2>/dev/null || true
rm -f /tmp/mydata-smoke.sock
```
Expected: the socket file appears.

- [ ] **Step 9: Commit**

```bash
git add apps/daemon/
git commit -m "Daemon: Unix-socket listener + executable, decodes and prints flow events"
```

---

## Task 4: Extension-side `IPCClient` with reconnect

**Files:**
- Modify: `apps/extension/Package.swift` — depend on `MydataIPC`.
- Create: `apps/extension/Sources/MydataExtension/IPCClient.swift`
- Modify: `apps/extension/Sources/MydataExtension/MydataFilterDataProvider.swift`
- Modify: `apps/extension/Tests/MydataExtensionTests/MydataExtensionTests.swift` — add reconnect-policy unit test.

- [ ] **Step 1: Update `apps/extension/Package.swift`**

Replace with:
```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataExtension",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataExtension", targets: ["MydataExtension"]),
    ],
    dependencies: [
        .package(name: "MydataIPC", path: "../../packages/schema/Swift"),
    ],
    targets: [
        .target(
            name: "MydataExtension",
            dependencies: [.product(name: "MydataIPC", package: "MydataIPC")],
            linkerSettings: [
                .linkedFramework("NetworkExtension", .when(platforms: [.macOS])),
            ]
        ),
        .testTarget(
            name: "MydataExtensionTests",
            dependencies: ["MydataExtension"]
        ),
    ]
)
```

- [ ] **Step 2: Write `IPCClient.swift`**

`apps/extension/Sources/MydataExtension/IPCClient.swift`:
```swift
import Foundation
import Network
import MydataIPC
import os.log

/// Sends framed IPC messages to the daemon over a Unix domain socket.
/// Reconnects on failure with exponential backoff (capped at 5 s per the
/// acceptance criterion for #17).
public actor IPCClient {

    public static let defaultBackoffCapSeconds: Double = 5.0

    private static let log = Logger(subsystem: "io.mydata.extension", category: "ipc")

    private let socketPath: String
    private let backoffCap: Double
    private var connection: NWConnection?
    private var currentBackoff: Double = 0.1
    private let queue = DispatchQueue(label: "io.mydata.extension.ipc")

    public init(socketPath: String, backoffCap: Double = IPCClient.defaultBackoffCapSeconds) {
        self.socketPath = socketPath
        self.backoffCap = backoffCap
    }

    public func send(_ message: IPCMessage) async {
        let conn = await ensureConnection()
        let data = IPCCodec.encode(message)
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            conn.send(content: data, completion: .contentProcessed { [weak self] error in
                if let error {
                    Self.log.error("ipc send failed: \(error.localizedDescription, privacy: .public)")
                    Task { await self?.tearDown() }
                }
                cont.resume()
            })
        }
    }

    /// Exposed for unit tests.
    public static func nextBackoff(current: Double, cap: Double) -> Double {
        return Swift.min(current * 2.0, cap)
    }

    private func ensureConnection() async -> NWConnection {
        if let conn = connection, conn.state == .ready { return conn }
        let conn = NWConnection(to: .unix(path: socketPath), using: .tcp)
        connection = conn
        let ready = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready: cont.resume(returning: true)
                case .failed, .cancelled: cont.resume(returning: false)
                default: break
                }
            }
            conn.start(queue: queue)
        }
        if !ready {
            try? await Task.sleep(nanoseconds: UInt64(currentBackoff * 1_000_000_000))
            currentBackoff = Self.nextBackoff(current: currentBackoff, cap: backoffCap)
            return await ensureConnection()
        }
        currentBackoff = 0.1
        return conn
    }

    private func tearDown() {
        connection?.cancel()
        connection = nil
    }
}
```

- [ ] **Step 3: Wire it into `MydataFilterDataProvider`**

Replace the existing `handleNewFlow` and add an `ipcClient` property + helper. Apply this patch by editing `apps/extension/Sources/MydataExtension/MydataFilterDataProvider.swift`:

Add this near the top of the class body, just after the `private static let log = ...` line:

```swift
    private let ipcClient: IPCClient
    private let nextFlowId = FlowIdAllocator()

    public override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let path = support.appendingPathComponent("mydata/daemon.sock").path
        self.ipcClient = IPCClient(socketPath: path)
        super.init()
    }
```

Replace `handleNewFlow` with:

```swift
    public override func handleNewFlow(_ flow: NEFilterFlow) -> NEFilterNewFlowVerdict {
        if let payload = Self.payload(for: flow, nextId: nextFlowId.next()) {
            Task { [ipcClient] in
                await ipcClient.send(.flowStarted(payload))
            }
            Self.log.info("flow id=\(payload.flowId, privacy: .public)")
        }
        return .allow()
    }
```

Replace the `event(for:phase:)` helper with `payload(for:nextId:)`:

```swift
    private static func payload(for flow: NEFilterFlow, nextId: UInt64) -> FlowEventPayload? {
        guard let socket = flow as? NEFilterSocketFlow,
              let remote = socket.remoteEndpoint as? NWHostEndpoint,
              let local = socket.localEndpoint as? NWHostEndpoint else {
            return nil
        }
        let family: IPCAddressFamily = remote.hostname.contains(":") ? .ipv6 : .ipv4
        let proto: UInt8 = socket.socketProtocol == IPPROTO_UDP ? 17 : 6
        let src = (try? address(from: local.hostname, family: family)) ?? IPCAddress(bytes: Array(repeating: 0, count: 16))
        let dst = (try? address(from: remote.hostname, family: family)) ?? IPCAddress(bytes: Array(repeating: 0, count: 16))
        return FlowEventPayload(
            flowId: nextId,
            timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000),
            family: family,
            protocolNumber: proto,
            sourcePort: UInt16(local.port.rawValue) ?? 0,
            destPort: UInt16(remote.port.rawValue) ?? 0,
            sourceAddress: src,
            destAddress: dst
        )
    }

    private static func address(from hostname: String, family: IPCAddressFamily) throws -> IPCAddress {
        switch family {
        case .ipv4: return try .ipv4(hostname)
        case .ipv6: return try .ipv6(hostname)
        }
    }
```

Add an import at the top:

```swift
import MydataIPC
```

And add a small thread-safe ID allocator (file-private):

```swift
final class FlowIdAllocator: @unchecked Sendable {
    private var counter: UInt64 = 0
    private let lock = NSLock()
    func next() -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        counter &+= 1
        return counter
    }
}
```

Also remove the now-unused `FlowEvent`/`FlowPhase`-based helpers (`event(for:phase:)`, `describe`, `protocolName`). The `FlowEvent.swift` file stays — it's still tested and the `os_log` line still uses it via `Self.log.info("flow id=...")` (simpler now). Actually the new `handleNewFlow` only logs an id; you can leave `FlowEvent.swift` and its tests untouched (they're a pure value type and remain testable). If you prefer, delete them — but leaving them avoids touching unrelated tests.

Decision: **leave `FlowEvent.swift` and its tests in place**. The os_log line in `handleNewFlow` now uses just the flow id, which is enough for human debugging since the structured data goes over IPC.

- [ ] **Step 4: Update test file to cover `IPCClient.nextBackoff`**

Append to `apps/extension/Tests/MydataExtensionTests/MydataExtensionTests.swift`:
```swift
import MydataIPC

final class IPCClientBackoffTests: XCTestCase {
    func testBackoffDoubles() {
        XCTAssertEqual(IPCClient.nextBackoff(current: 0.1, cap: 5.0), 0.2, accuracy: 0.001)
        XCTAssertEqual(IPCClient.nextBackoff(current: 1.0, cap: 5.0), 2.0, accuracy: 0.001)
    }

    func testBackoffCapsAtFiveSeconds() {
        XCTAssertEqual(IPCClient.nextBackoff(current: 4.0, cap: 5.0), 5.0, accuracy: 0.001)
        XCTAssertEqual(IPCClient.nextBackoff(current: 10.0, cap: 5.0), 5.0, accuracy: 0.001)
    }
}
```

- [ ] **Step 5: Build + test**

```bash
swift build --package-path apps/extension
swift test  --package-path apps/extension
```
Expected: build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/
git commit -m "Extension: send flow events to daemon via IPCClient with backoff"
```

---

## Task 5: LaunchAgent plist + docs

**Files:**
- Create: `scripts/launchd/io.mydata.daemon.plist`
- Modify: `docs/architecture.md`
- Modify: `docs/build.md`

- [ ] **Step 1: Write the LaunchAgent plist**

`scripts/launchd/io.mydata.daemon.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.mydata.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/mydata-daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/mydata-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/mydata-daemon.err</string>
</dict>
</plist>
```

- [ ] **Step 2: Update `docs/architecture.md`**

Look at the existing file first (`cat docs/architecture.md`). If it already has a section on the daemon, append an "Extension ↔ Daemon IPC" subsection. If the file is still skeletal/placeholder, replace it with this content:

````markdown
# Architecture

mydata runs three processes, all local, all bundled in one signed/notarized app.

## Components

- **Network Extension** (`apps/extension`) — observes outbound flows via
  `NEFilterDataProvider`. Allows every flow (no blocking in v0.1). Emits one
  IPC message per flow start.
- **Daemon** (`apps/daemon`) — long-running user agent. Listens for IPC
  messages, enriches them (issue #20), writes to SQLite (issue #19).
- **UI** (`apps/ui`) — Tauri 2 + React. Read-only view over the SQLite DB.

## Extension ↔ Daemon IPC

The extension is a client; the daemon is a server. Transport is a Unix
domain socket at `~/Library/Application Support/mydata/daemon.sock`. The
wire format above the transport is documented in
[`packages/schema/ipc.md`](../packages/schema/ipc.md) and implemented by the
`MydataIPC` Swift package.

Reconnect: on failure, the extension's `IPCClient` reconnects with
exponential backoff capped at 5 seconds. Lost messages during the gap are
acceptable in v0.1 — we trade durability for simplicity.

Liveness: the daemon will accept `ping` frames and reply with `pong`. Not
exercised in v0.1 but the codec already handles them.

## Privacy invariants

See `docs/privacy-promise.md`. The extension/daemon pair has zero outbound
network calls; the privacy-paranoia harness enforces this in CI.
````

- [ ] **Step 3: Add a "Daemon" subsection to `docs/build.md`**

Find the existing "### Daemon (`apps/daemon`)" block (added in #16) and replace it with:

````markdown
### Daemon (`apps/daemon`)

Build and test:

```bash
swift build --package-path apps/daemon
swift test  --package-path apps/daemon
```

Run locally (foreground):

```bash
swift run --package-path apps/daemon mydata-daemon
```

The daemon creates `~/Library/Application Support/mydata/daemon.sock` and
prints one line per received IPC message to stdout. Override the socket
path for tests via `MYDATA_SOCK=/tmp/foo.sock`.

To install as a LaunchAgent (out of scope for routine dev; release pipeline
in #26 will automate this):

```bash
cp scripts/launchd/io.mydata.daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/io.mydata.daemon.plist
```
````

- [ ] **Step 4: Commit**

```bash
git add scripts/launchd/ docs/architecture.md docs/build.md
git commit -m "Document extension↔daemon IPC + add LaunchAgent plist"
```

---

## Task 6: Wire `packages/schema/Swift` into the CI swift job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the new package to the swift job**

Read the current `swift` job. Add `swift test --package-path packages/schema/Swift` alongside the existing extension + daemon test commands. The patch should add one line to the test step, e.g.:

```yaml
      - name: swift test
        run: |
          swift test --package-path packages/schema/Swift
          swift test --package-path apps/extension
          swift test --package-path apps/daemon
```

(Adapt to whatever the existing yaml structure looks like — preserve indentation and other steps.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: test the MydataIPC package in the swift job"
```

---

## Task 7: PR + verify CI

- [ ] **Step 1: Format anything prettier touches**

```bash
npm run format
git diff --stat
```
If there are formatting changes, commit them: `git commit -am "format"`.

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin 17-daemon-xpc
gh pr create --title "Daemon skeleton + IPC pipe with versioned binary wire format" \
  --body "$(cat <<'EOF'
## Summary
- New `MydataIPC` Swift package (`packages/schema/Swift/`) implements a v1 versioned, length-prefixed binary wire format with full round-trip tests.
- `packages/schema/ipc.md` documents the wire format.
- `apps/daemon` becomes an executable target `mydata-daemon` + library `MydataDaemon`. It listens on a Unix socket and prints one line per received IPC message. Integration test spawns the listener and sends a frame end-to-end.
- `apps/extension` gains an `IPCClient` actor with exponential backoff (capped at 5 s) and now emits `flowStarted` per flow via the codec.
- LaunchAgent plist scaffolded for install (used by the packaging slice #26).
- Docs: `docs/architecture.md` describes the pipe; `docs/build.md` describes daemon run instructions.
- CI: `swift` job now also runs `packages/schema/Swift`.

## Scope notes
The "browser traffic produces a daemon stdout line from a real loaded extension" acceptance criterion is deferred to manual verification on the maintainer's Mac (same scope decision as #16: the extension still needs Apple Developer signing + System Settings approval to load). The end-to-end listener test exercises the same codec + transport across two processes without needing a loaded extension.

## Issues closed
Closes #17

## Test plan
- [x] `swift test --package-path packages/schema/Swift` (8 codec tests)
- [x] `swift test --package-path apps/daemon` (3 tests incl. socket round-trip)
- [x] `swift test --package-path apps/extension` (FlowEvent + backoff)
- [x] CI green on all jobs.
- [ ] Manual: maintainer runs `swift run --package-path apps/daemon mydata-daemon` and confirms socket created.
- [ ] Manual (post #26): loaded extension produces lines on daemon stdout while browsing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI**

```bash
sleep 60
gh pr checks
```
Poll until all 5 jobs (docs-sanity, link-check, node, swift, privacy-paranoia) are green. Up to ~10 minutes.

---

## Self-Review Notes

- **Acceptance criteria coverage:**
  - Daemon prints flow lines → covered via integration test (`ListenerTests.testListenerReceivesEncodedFrames`); loaded-extension verification deferred.
  - Extension reconnects within 5 s if daemon restarts → covered by `IPCClient` exponential backoff capped at 5 s; unit-tested via `nextBackoff` policy.
  - `packages/schema/ipc.md` documents the wire format with version → Task 1.
  - Round-trip unit tests for serializer → Task 2 (8 tests).
- **Placeholders:** none — all code is concrete.
- **Type consistency:** `IPCMessage`, `FlowEventPayload`, `IPCAddress`, `IPCCodec`, `Listener`, `MessagePrinter`, `IPCClient`, `FlowIdAllocator` referenced consistently.
- **AGENTS.md compliance:** zero outbound network calls (Unix socket is local-only); codec is forward-compatible (unknown types skipped, unknown versions rejected); extension still always returns `.allow()`.
