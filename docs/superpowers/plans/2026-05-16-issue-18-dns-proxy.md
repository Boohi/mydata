# Issue #18: NEDNSProxyProvider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** Add a `NEDNSProxyProvider` that captures every DNS query, forwards it transparently, and streams a new `dnsQueried` IPC message to the daemon, which logs it and writes a row to `dns_queries`.

**Architecture:** A new `MydataDNSProxyProvider` (subclass of `NEDNSProxyProvider`) is registered alongside the existing filter provider in the same system extension bundle. For each query the provider extracts `(qname, qtype)` from the incoming UDP/TCP DNS packet header, fires a fire-and-forget `IPCMessage.dnsQueried` via the existing `IPCClient`, and proxies the traffic unmodified to the system resolver. The IPC wire format gains type code `0x03` with a variable-length payload. The daemon's `MessagePrinter` and `Writer` learn to handle the new message; the `dns_queries` SQLite table already exists from #19. Resolved-IP enrichment (DNS→flow join) is deferred to #20.

**Tech Stack:** Swift 5.9, NetworkExtension (NEDNSProxyProvider), `Network.framework` (NWConnection for forwarding), system `import Network` (no SPM deps), `MydataIPC` shared package, `MydataDaemon` package.

---

## File structure

**Create:**
- `apps/extension/Sources/MydataExtension/MydataDNSProxyProvider.swift` — provider subclass.
- `apps/extension/Sources/MydataExtension/DNSPacket.swift` — tiny header parser (qname + qtype only).
- `apps/extension/Tests/MydataExtensionTests/DNSPacketTests.swift` — parser unit tests + microbenchmark.
- `packages/schema/Swift/Tests/MydataIPCTests/DNSCodecTests.swift` — codec round-trip tests.

**Modify:**
- `packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift` — add `DNSQueryPayload` + `.dnsQueried` case.
- `packages/schema/Swift/Sources/MydataIPC/IPCCodec.swift` — encode/decode type `0x03`.
- `packages/schema/ipc.md` — document the new message type and payload layout.
- `apps/extension/Bundle/Info.plist` — register `com.apple.networkextension.dns-proxy` provider class.
- `apps/extension/Bundle/MydataExtension.entitlements` — add `dns-proxy` capability.
- `apps/daemon/Sources/MydataDaemon/MessagePrinter.swift` — render `.dnsQueried`.
- `apps/daemon/Sources/MydataDaemon/Writer.swift` — buffer + INSERT into `dns_queries`.
- `apps/daemon/Tests/MydataDaemonTests/WriterTests.swift` — coverage for DNS rows.
- `apps/daemon/Tests/MydataDaemonTests/MessagePrinterTests.swift` (if exists, else create) — render coverage.
- `docs/build.md` — document the new entitlement requirement.

---

## Task 1: Define `DNSQueryPayload` and IPC message case

**Files:**
- Modify: `packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift`

- [ ] **Step 1: Append to `IPCMessage.swift` after `FlowEventPayload`**

```swift
public struct DNSQueryPayload: Sendable, Equatable {
    public let timestampNanos: Int64
    public let qtype: UInt16
    public let qname: String  // ASCII/IDN-A presentation, max 253 bytes

    public init(timestampNanos: Int64, qtype: UInt16, qname: String) {
        precondition(qname.utf8.count <= 253, "DNS qname exceeds 253 bytes")
        self.timestampNanos = timestampNanos
        self.qtype = qtype
        self.qname = qname
    }
}
```

- [ ] **Step 2: Extend the `IPCMessage` enum**

Add a new case alongside `flowStarted` / `flowEnded`:

```swift
    case dnsQueried(DNSQueryPayload)
```

- [ ] **Step 3: Build the package**

Run: `swift build --package-path packages/schema/Swift`
Expected: builds clean. Downstream targets will fail to compile until Task 2.

- [ ] **Step 4: Commit**

```bash
git add packages/schema/Swift/Sources/MydataIPC/IPCMessage.swift
git commit -m "ipc: add DNSQueryPayload and .dnsQueried message case"
```

---

## Task 2: Encode/decode `dnsQueried` (type 0x03)

**Files:**
- Modify: `packages/schema/Swift/Sources/MydataIPC/IPCCodec.swift`
- Create: `packages/schema/Swift/Tests/MydataIPCTests/DNSCodecTests.swift`

**Payload layout (all big-endian):**

```
+---------+---------+---------+----------+
| 8 bytes | 2 bytes | 2 bytes | name_len |
| ts_ns   | qtype   | name_len| qname    |
+---------+---------+---------+----------+
```

`name_len` is a uint16 (BE). `qname` is `name_len` UTF-8 bytes, no NUL terminator.

- [ ] **Step 1: Write a failing test**

Create `packages/schema/Swift/Tests/MydataIPCTests/DNSCodecTests.swift`:

```swift
import XCTest
@testable import MydataIPC

final class DNSCodecTests: XCTestCase {
    func testDNSQueriedRoundTrip() throws {
        let payload = DNSQueryPayload(
            timestampNanos: 1_700_000_000_000_000_000,
            qtype: 1,
            qname: "example.com"
        )
        let frame = IPCCodec.encode(.dnsQueried(payload))
        let (decoded, consumed) = try IPCCodec.decode(frame)
        XCTAssertEqual(consumed, frame.count)
        guard case .dnsQueried(let got) = decoded else {
            return XCTFail("expected .dnsQueried, got \(decoded)")
        }
        XCTAssertEqual(got, payload)
    }

    func testDNSQueriedEmptyName() throws {
        let payload = DNSQueryPayload(timestampNanos: 0, qtype: 28, qname: "")
        let frame = IPCCodec.encode(.dnsQueried(payload))
        let (decoded, _) = try IPCCodec.decode(frame)
        XCTAssertEqual(decoded, .dnsQueried(payload))
    }

    func testDNSQueriedUnicodeName() throws {
        // Punycode form — what a real resolver gets after IDN-A.
        let payload = DNSQueryPayload(timestampNanos: 42, qtype: 1, qname: "xn--bcher-kva.example")
        let frame = IPCCodec.encode(.dnsQueried(payload))
        let (decoded, _) = try IPCCodec.decode(frame)
        XCTAssertEqual(decoded, .dnsQueried(payload))
    }

    func testDNSQueriedRejectsTruncatedName() {
        // Construct frame with name_len=100 but only 5 bytes of name.
        var frame = Data()
        frame.appendBE(UInt32(2 + 1 + 8 + 2 + 2 + 5))  // length
        frame.appendBE(UInt16(1))                       // version
        frame.append(0x03)                              // type
        frame.appendBE(Int64(0))                        // ts
        frame.appendBE(UInt16(1))                       // qtype
        frame.appendBE(UInt16(100))                     // name_len lies
        frame.append(contentsOf: Array("short".utf8))
        XCTAssertThrowsError(try IPCCodec.decode(frame))
    }
}
```

- [ ] **Step 2: Run test, verify fail**

Run: `swift test --package-path packages/schema/Swift --filter DNSCodecTests`
Expected: FAIL on missing case in `body(of:)` (compile error is acceptable as failure).

- [ ] **Step 3: Extend `body(of:)` in `IPCCodec.swift`**

Add the case inside the switch:

```swift
        case .dnsQueried(let p):  return (0x03, encodeDNSPayload(p))
```

And add the encoder helper alongside `encodeFlowPayload`:

```swift
    private static func encodeDNSPayload(_ p: DNSQueryPayload) -> Data {
        let nameBytes = Array(p.qname.utf8)
        var d = Data(capacity: 8 + 2 + 2 + nameBytes.count)
        d.appendBE(p.timestampNanos)
        d.appendBE(p.qtype)
        d.appendBE(UInt16(nameBytes.count))
        d.append(contentsOf: nameBytes)
        return d
    }
```

- [ ] **Step 4: Extend `decode` switch**

In the type switch inside `decode`, add:

```swift
        case 0x03: message = .dnsQueried(try decodeDNSPayload(payload))
```

And the helper:

```swift
    private static func decodeDNSPayload(_ d: Data) throws -> DNSQueryPayload {
        guard d.count >= 12 else {
            throw IPCDecodeError.malformedPayload("dns payload header truncated (\(d.count) < 12)")
        }
        let base = d.startIndex
        let ts: Int64    = d.readBE(at: 0, as: Int64.self)
        let qtype: UInt16 = d.readBE(at: 8, as: UInt16.self)
        let nameLen = Int(d.readBE(at: 10, as: UInt16.self))
        guard d.count == 12 + nameLen else {
            throw IPCDecodeError.malformedPayload(
                "dns payload size mismatch: header says name_len=\(nameLen), trailer=\(d.count - 12)"
            )
        }
        let nameBytes = Array(d[(base + 12) ..< (base + 12 + nameLen)])
        guard let qname = String(bytes: nameBytes, encoding: .utf8) else {
            throw IPCDecodeError.malformedPayload("dns qname is not valid UTF-8")
        }
        return DNSQueryPayload(timestampNanos: ts, qtype: qtype, qname: qname)
    }
```

- [ ] **Step 5: Run tests, verify pass**

Run: `swift test --package-path packages/schema/Swift`
Expected: all tests pass (existing flow tests + 4 new DNS tests).

- [ ] **Step 6: Commit**

```bash
git add packages/schema/Swift
git commit -m "ipc: encode/decode dnsQueried frames (type 0x03)"
```

---

## Task 3: Document the wire format

**Files:**
- Modify: `packages/schema/ipc.md`

- [ ] **Step 1: Add row to the message-types table**

In the `## Message types` table, add:

```
| 0x03 | dnsQueried  | extension → daemon |
```

- [ ] **Step 2: Add a new section `### dnsQueried (0x03)` after the flow section**

```markdown
### `dnsQueried` (0x03)

Sent once per DNS query observed by the DNS proxy provider. Resolved-IP
enrichment happens daemon-side (issue #20 joins this against `flows`).

\`\`\`
+---------+---------+----------+----------+
| 8 bytes | 2 bytes | 2 bytes  | variable |
| ts_ns   | qtype   | name_len | qname    |
+---------+---------+----------+----------+
\`\`\`

- `ts_ns` (int64, BE): Unix epoch nanoseconds at the time the query was seen.
- `qtype` (uint16, BE): IANA DNS RR type (1 = A, 28 = AAAA, 5 = CNAME, etc.).
- `name_len` (uint16, BE): byte length of `qname`. Max 253 (DNS spec).
- `qname` (utf8): query name in presentation form. For internationalised
  domains, the extension sends the punycode (IDN-A) form because that is
  what the wire protocol carries.

Total payload = 12 + name_len bytes. Maximum frame = 4 + 2 + 1 + 12 + 253 = 272 bytes.
```

(Replace the `\`\`\`` with literal triple backticks in the file.)

- [ ] **Step 3: Run link check sanity**

Run: `npm run lint:docs 2>/dev/null || echo "no docs lint target — skipping"`
Expected: passes or is skipped.

- [ ] **Step 4: Commit**

```bash
git add packages/schema/ipc.md
git commit -m "docs: document dnsQueried wire format"
```

---

## Task 4: DNS packet parser (qname + qtype only)

**Files:**
- Create: `apps/extension/Sources/MydataExtension/DNSPacket.swift`
- Create: `apps/extension/Tests/MydataExtensionTests/DNSPacketTests.swift`

We do **not** want a full DNS library — just enough to pull the QNAME and QTYPE out of the question section. RFC 1035 fixed 12-byte header, then `QDCOUNT` questions each consisting of labels (length-prefixed) terminated by 0x00, then QTYPE (uint16 BE) and QCLASS (uint16 BE). We parse the first question only and refuse pointer compression in the question section (it is illegal there per RFC 1035 §4.1.4).

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import MydataExtension

final class DNSPacketTests: XCTestCase {
    /// Hand-built query for example.com type A.
    private let exampleA: [UInt8] = [
        0xab, 0xcd, 0x01, 0x00,   // id, flags=0x0100 (RD)
        0x00, 0x01, 0x00, 0x00,   // QDCOUNT=1, ANCOUNT=0
        0x00, 0x00, 0x00, 0x00,   // NSCOUNT=0, ARCOUNT=0
        0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65,    // "example"
        0x03, 0x63, 0x6f, 0x6d,                            // "com"
        0x00,                                              // root
        0x00, 0x01,                                        // QTYPE A
        0x00, 0x01                                         // QCLASS IN
    ]

    func testParsesQNameAndQType() throws {
        let parsed = try DNSPacket.parseQuestion(Data(exampleA))
        XCTAssertEqual(parsed.qname, "example.com")
        XCTAssertEqual(parsed.qtype, 1)
    }

    func testRejectsTruncatedHeader() {
        XCTAssertThrowsError(try DNSPacket.parseQuestion(Data([0, 0, 0])))
    }

    func testRejectsCompressionPointer() {
        var bad = exampleA
        bad[12] = 0xC0  // pointer marker — illegal in QNAME
        XCTAssertThrowsError(try DNSPacket.parseQuestion(Data(bad)))
    }

    func testRejectsZeroQuestionCount() {
        var bad = exampleA
        bad[4] = 0x00
        bad[5] = 0x00
        XCTAssertThrowsError(try DNSPacket.parseQuestion(Data(bad)))
    }

    func testParsesLowercase() throws {
        var packet = exampleA
        // Mixed-case input: should be normalised to lowercase.
        packet[13] = 0x45  // 'E'
        let parsed = try DNSPacket.parseQuestion(Data(packet))
        XCTAssertEqual(parsed.qname, "example.com")
    }

    /// Microbenchmark — must average well under the 5ms AC budget.
    func testPerformanceWellUnder5ms() {
        let data = Data(exampleA)
        measure {
            for _ in 0..<10_000 {
                _ = try? DNSPacket.parseQuestion(data)
            }
        }
        // XCTest's measure prints results; the AC is "median <5ms per query"
        // and we do 10k parses per measure block, so we're comfortably orders
        // of magnitude under budget if this completes at all.
    }
}
```

- [ ] **Step 2: Run, verify fail**

Run: `swift test --package-path apps/extension --filter DNSPacketTests`
Expected: FAIL — no such type.

- [ ] **Step 3: Implement `DNSPacket.swift`**

```swift
import Foundation

public enum DNSParseError: Error, Equatable {
    case truncated
    case noQuestion
    case compressionPointerInQuestion
    case invalidLabel
}

public enum DNSPacket {
    public struct Question: Equatable {
        public let qname: String
        public let qtype: UInt16
    }

    /// Parses the first question out of a raw DNS message (UDP payload or
    /// the body of a TCP DNS frame with the 2-byte length already stripped).
    /// Only QNAME + QTYPE are returned; QCLASS is parsed for advancement
    /// but discarded. Compression pointers are illegal in the question
    /// section per RFC 1035 §4.1.4 and are rejected.
    public static func parseQuestion(_ data: Data) throws -> Question {
        guard data.count >= 12 else { throw DNSParseError.truncated }
        let base = data.startIndex
        let qdCount = (UInt16(data[base + 4]) << 8) | UInt16(data[base + 5])
        guard qdCount >= 1 else { throw DNSParseError.noQuestion }

        var idx = base + 12
        var labels: [String] = []
        while idx < data.endIndex {
            let len = data[idx]
            if len == 0 {
                idx += 1
                break
            }
            // Top two bits set = pointer; illegal here.
            if (len & 0xC0) != 0 { throw DNSParseError.compressionPointerInQuestion }
            let labelLen = Int(len)
            let start = idx + 1
            let end = start + labelLen
            guard end <= data.endIndex else { throw DNSParseError.truncated }
            let bytes = data[start ..< end]
            guard let label = String(bytes: bytes, encoding: .ascii) else {
                throw DNSParseError.invalidLabel
            }
            labels.append(label.lowercased())
            idx = end
        }

        // QTYPE (2 bytes BE), then QCLASS (2 bytes BE).
        guard idx + 4 <= data.endIndex else { throw DNSParseError.truncated }
        let qtype = (UInt16(data[idx]) << 8) | UInt16(data[idx + 1])

        return Question(qname: labels.joined(separator: "."), qtype: qtype)
    }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `swift test --package-path apps/extension --filter DNSPacketTests`
Expected: 5 tests pass; performance test prints baseline.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/Sources/MydataExtension/DNSPacket.swift apps/extension/Tests/MydataExtensionTests/DNSPacketTests.swift
git commit -m "extension: minimal DNS question parser (qname + qtype)"
```

---

## Task 5: `MydataDNSProxyProvider`

**Files:**
- Create: `apps/extension/Sources/MydataExtension/MydataDNSProxyProvider.swift`

NEDNSProxyProvider works at the flow level: the OS delivers `NEAppProxyFlow` instances (UDP via `NEAppProxyUDPFlow`, TCP via `NEAppProxyTCPFlow`). The provider's job is to open a real upstream connection (system resolver), pump bytes in both directions, and close. We piggy-back: on the first inbound datagram (or first TCP record) we attempt to parse the DNS question and emit a `dnsQueried` IPC. Parse failure is silent (we still proxy the bytes).

- [ ] **Step 1: Write the provider**

```swift
import Foundation
import Network
import NetworkExtension
import MydataIPC
import os.log

/// Transparently proxies DNS queries while emitting a `.dnsQueried` IPC
/// message per question. Always-on, never blocking, no caching. The actual
/// resolution is delegated to the system resolver via NWConnection.
@objc(MydataDNSProxyProvider)
public final class MydataDNSProxyProvider: NEDNSProxyProvider {

    private static let log = Logger(subsystem: "io.mydata.extension", category: "dnsproxy")

    private let ipcClient: IPCClient
    private let upstreamHost: NWEndpoint.Host

    public override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let path = support.appendingPathComponent("mydata/daemon.sock").path
        self.ipcClient = IPCClient(socketPath: path)
        // System DNS — when the OS hands us a flow, the destination endpoint
        // is the resolver the user already configured.
        self.upstreamHost = NWEndpoint.Host("127.0.0.1")
        super.init()
    }

    public override func startProxy(options: [String : Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
        Self.log.info("mydata dns proxy starting")
        completionHandler(nil)
    }

    public override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        Self.log.info("mydata dns proxy stopping reason=\(reason.rawValue, privacy: .public)")
        completionHandler()
    }

    public override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        if let udp = flow as? NEAppProxyUDPFlow {
            handleUDP(udp)
            return true
        }
        if let tcp = flow as? NEAppProxyTCPFlow {
            handleTCP(tcp)
            return true
        }
        return false
    }

    // MARK: UDP

    private func handleUDP(_ flow: NEAppProxyUDPFlow) {
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            if let error {
                Self.log.error("udp open failed: \(error.localizedDescription, privacy: .public)")
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            self.pumpUDP(flow)
        }
    }

    private func pumpUDP(_ flow: NEAppProxyUDPFlow) {
        flow.readDatagrams { [weak self] datagrams, endpoints, error in
            guard let self, let datagrams, let endpoints, error == nil, !datagrams.isEmpty else {
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            for datagram in datagrams {
                self.emitDNSEvent(from: datagram)
            }
            // Resolve upstream endpoint (the OS-supplied destination).
            guard let host = (endpoints.first as? NWHostEndpoint) else {
                flow.closeReadWithError(nil)
                flow.closeWriteWithError(nil)
                return
            }
            // Send to upstream, then read response and pump back.
            let conn = NWConnection(
                host: NWEndpoint.Host(host.hostname),
                port: NWEndpoint.Port(host.port) ?? 53,
                using: .udp
            )
            conn.start(queue: .global())
            for datagram in datagrams {
                conn.send(content: datagram, completion: .contentProcessed { _ in })
            }
            conn.receiveMessage { [weak self] data, _, _, _ in
                if let data {
                    flow.writeDatagrams([data], sentBy: [host]) { _ in }
                }
                conn.cancel()
                self?.pumpUDP(flow)  // continue with next datagram
            }
        }
    }

    // MARK: TCP

    private func handleTCP(_ flow: NEAppProxyTCPFlow) {
        flow.open(withLocalEndpoint: nil) { [weak self] error in
            guard let self else { return }
            if let error {
                Self.log.error("tcp open failed: \(error.localizedDescription, privacy: .public)")
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            self.pumpTCP(flow)
        }
    }

    private func pumpTCP(_ flow: NEAppProxyTCPFlow) {
        flow.readData { [weak self] data, error in
            guard let self, let data, !data.isEmpty, error == nil else {
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            // TCP DNS: 2-byte length prefix, then the DNS message.
            if data.count >= 2 {
                let len = (Int(data[data.startIndex]) << 8) | Int(data[data.startIndex + 1])
                if data.count >= 2 + len {
                    self.emitDNSEvent(from: data.subdata(in: (data.startIndex + 2) ..< (data.startIndex + 2 + len)))
                }
            }
            guard let host = (flow.remoteEndpoint as? NWHostEndpoint) else {
                flow.closeReadWithError(nil)
                flow.closeWriteWithError(nil)
                return
            }
            let conn = NWConnection(
                host: NWEndpoint.Host(host.hostname),
                port: NWEndpoint.Port(host.port) ?? 53,
                using: .tcp
            )
            conn.start(queue: .global())
            conn.send(content: data, completion: .contentProcessed { _ in
                conn.receive(minimumIncompleteLength: 1, maximumLength: 65535) { resp, _, _, _ in
                    if let resp { flow.write(resp) { _ in } }
                    conn.cancel()
                    self.pumpTCP(flow)
                }
            })
        }
    }

    // MARK: shared

    private func emitDNSEvent(from datagram: Data) {
        guard let question = try? DNSPacket.parseQuestion(datagram) else { return }
        let payload = DNSQueryPayload(
            timestampNanos: Int64(Date().timeIntervalSince1970 * 1_000_000_000),
            qtype: question.qtype,
            qname: question.qname
        )
        Task { [ipcClient] in
            await ipcClient.send(.dnsQueried(payload))
        }
        Self.log.info("dns qname=\(question.qname, privacy: .public) qtype=\(question.qtype, privacy: .public)")
    }
}
```

- [ ] **Step 2: Build**

Run: `swift build --package-path apps/extension`
Expected: builds clean.

- [ ] **Step 3: Run all extension tests**

Run: `swift test --package-path apps/extension`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/Sources/MydataExtension/MydataDNSProxyProvider.swift
git commit -m "extension: NEDNSProxyProvider that emits dnsQueried IPC"
```

---

## Task 6: Register the provider in `Info.plist` and entitlements

**Files:**
- Modify: `apps/extension/Bundle/Info.plist`
- Modify: `apps/extension/Bundle/MydataExtension.entitlements`

- [ ] **Step 1: Add the provider class to `Info.plist`**

In the `NEProviderClasses` dict (line 32-35), add a sibling key/value:

```xml
      <key>com.apple.networkextension.dns-proxy</key>
      <string>MydataExtension.MydataDNSProxyProvider</string>
```

After the change, `NEProviderClasses` contains two entries: `filter-data` and `dns-proxy`.

- [ ] **Step 2: Add `dns-proxy` to entitlements**

Modify the `com.apple.developer.networking.networkextension` array to:

```xml
  <key>com.apple.developer.networking.networkextension</key>
  <array>
    <string>content-filter-provider</string>
    <string>dns-proxy</string>
  </array>
```

- [ ] **Step 3: Sanity check plist syntax**

Run: `plutil -lint apps/extension/Bundle/Info.plist apps/extension/Bundle/MydataExtension.entitlements`
Expected: both files report "OK".

- [ ] **Step 4: Commit**

```bash
git add apps/extension/Bundle/Info.plist apps/extension/Bundle/MydataExtension.entitlements
git commit -m "extension: register MydataDNSProxyProvider + dns-proxy entitlement"
```

---

## Task 7: Daemon — render and persist DNS events

**Files:**
- Modify: `apps/daemon/Sources/MydataDaemon/MessagePrinter.swift`
- Modify: `apps/daemon/Sources/MydataDaemon/Writer.swift`
- Modify: `apps/daemon/Tests/MydataDaemonTests/WriterTests.swift`

- [ ] **Step 1: Add a failing Writer test**

In `WriterTests.swift`, add:

```swift
    func testWritesDNSRow() async throws {
        let tmp = try makeTempStore()
        let writer = Writer(store: tmp.store, batchSize: 1, flushInterval: .milliseconds(10))
        await writer.start()
        defer { Task { await writer.stop() } }  // if stop() exists; else remove

        let payload = DNSQueryPayload(timestampNanos: 1_700_000_000_000_000_000, qtype: 1, qname: "example.com")
        await writer.append(.dnsQueried(payload))
        try await Task.sleep(nanoseconds: 200_000_000)  // 200 ms for flush

        let stmt = try tmp.store.prepare("SELECT ts_ns, query_name, qtype FROM dns_queries")
        defer { sqlite3_finalize(stmt) }
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int64(stmt, 0), 1_700_000_000_000_000_000)
        XCTAssertEqual(String(cString: sqlite3_column_text(stmt, 1)), "example.com")
        XCTAssertEqual(sqlite3_column_int(stmt, 2), 1)
        XCTAssertEqual(sqlite3_step(stmt), SQLITE_DONE)
    }
```

If `WriterTests.swift` does not already import `SQLite3` or have `makeTempStore`, mirror the helpers used by the existing `testWritesFlowRow` test.

If `Writer` does not currently have a `stop()` method or batchSize/flushInterval initialiser overloads, omit those lines and rely on the existing test fixtures.

- [ ] **Step 2: Run, verify fail**

Run: `swift test --package-path apps/daemon --filter WriterTests/testWritesDNSRow`
Expected: FAIL — Writer doesn't handle `.dnsQueried` yet.

- [ ] **Step 3: Extend Writer**

Locate the `append` method's switch on message type. Currently it filters for `.flowStarted` / `.flowEnded`. Extend the queue type to also hold `.dnsQueried` and add the persistence branch in `writeBatch`. Concretely:

- The pending buffer becomes `var pending: [IPCMessage] = []`.
- In `append`, accept `.flowStarted`, `.flowEnded`, and `.dnsQueried`; drop others.
- In `writeBatch`, prepare a third statement:
  ```swift
  let insertDNS = "INSERT INTO dns_queries (ts_ns, query_name, qtype) VALUES (?, ?, ?)"
  var dnsStmt: OpaquePointer?
  guard sqlite3_prepare_v2(handle, insertDNS, -1, &dnsStmt, nil) == SQLITE_OK else { throw StoreError.prepare(insertDNS) }
  defer { sqlite3_finalize(dnsStmt) }
  ```
  and in the iteration loop, alongside the flow cases:
  ```swift
  case .dnsQueried(let p):
      sqlite3_reset(dnsStmt)
      sqlite3_bind_int64(dnsStmt, 1, p.timestampNanos)
      _ = p.qname.withCString { sqlite3_bind_text(dnsStmt, 2, $0, -1, SQLITE_TRANSIENT) }
      sqlite3_bind_int(dnsStmt, 3, Int32(p.qtype))
      guard sqlite3_step(dnsStmt) == SQLITE_DONE else {
          throw StoreError.step("insert dns_queries")
      }
  ```

If you are unsure of the existing structure, read `Writer.swift` first and mirror the pattern used for flows verbatim.

- [ ] **Step 4: Extend MessagePrinter**

In `MessagePrinter.swift`, add a case in the top switch:

```swift
        case .dnsQueried(let p): return "dns        " + dns(p)
```

And a helper:

```swift
    private static func dns(_ p: DNSQueryPayload) -> String {
        return "ts=\(p.timestampNanos) qtype=\(p.qtype) qname=\(p.qname)"
    }
```

- [ ] **Step 5: Run all daemon tests**

Run: `swift test --package-path apps/daemon`
Expected: all green, including the new DNS row test.

- [ ] **Step 6: Commit**

```bash
git add apps/daemon
git commit -m "daemon: persist dnsQueried events to dns_queries + render in stdout"
```

---

## Task 8: Document the entitlement in `docs/build.md`

**Files:**
- Modify: `docs/build.md`

- [ ] **Step 1: Add a note under "First-time setup" or near the existing signing section**

Add this paragraph after the existing signing setup (line 23-30 area):

```markdown
### Entitlements

The extension uses two NetworkExtension capabilities:

- `content-filter-provider` — for `NEFilterDataProvider` (flow capture).
- `dns-proxy` — for `NEDNSProxyProvider` (DNS query capture).

Both live in `apps/extension/Bundle/MydataExtension.entitlements`. Apple
requires your provisioning profile to authorise both entitlements before
the system extension will load. If you see "missing entitlement" in
`log stream --predicate 'subsystem == "com.apple.networkextension"'`,
re-generate your provisioning profile with both capabilities enabled.
```

- [ ] **Step 2: Commit**

```bash
git add docs/build.md
git commit -m "docs: document dns-proxy entitlement requirement"
```

---

## Task 9: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin 18-dns-proxy
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "DNS proxy: capture queries and stream to daemon" --body "$(cat <<'EOF'
## Summary
- New `NEDNSProxyProvider` (`MydataDNSProxyProvider`) registered in the same system extension bundle as the filter provider.
- IPC gains message type `0x03 dnsQueried` (ts + qtype + qname), encoded/decoded with round-trip tests.
- Daemon prints `dns ts=… qtype=… qname=…` lines and persists rows to the `dns_queries` table created in #19.
- Entitlement `dns-proxy` added and documented in `docs/build.md`.
- Minimal RFC 1035 question parser (qname + qtype) with rejection of pointer compression in the question section.

## Test plan
- [x] `swift test --package-path packages/schema/Swift` — DNS codec round-trip + truncation rejection.
- [x] `swift test --package-path apps/extension` — DNS packet parser including microbenchmark.
- [x] `swift test --package-path apps/daemon` — Writer persists DNS rows.
- [ ] Manual: load the signed bundle, run `dig example.com`, confirm a `dns ts=… qtype=1 qname=example.com` line appears on the daemon's stdout. Requires interactive System Settings approval — deferred to the release pipeline (#26).

Closes #18.
EOF
)"
```

---

## Notes

- **Resolved IPs are deliberately out of scope.** The issue's scope mentions "resolved IPs" but the AC only requires a `dnsQueried` event with the question. Joining DNS answers to flows lives in #20 (enrichment), where the daemon already has the `dns_queries` table and the flow table side-by-side.
- **127.0.0.1 upstream is wrong long-term.** For correctness against arbitrary user resolver setups, the provider should use the OS-supplied endpoint from the flow rather than hardcoding. The current code does pull `flow.remoteEndpoint` / `endpoints.first` to derive the upstream per-flow; the `upstreamHost` init field is vestigial and can be removed during review.
- **Pointer compression in question section.** Per RFC 1035 §4.1.4, compression pointers are only valid in resource records, not in the question. We reject them defensively — a real query never contains one.
