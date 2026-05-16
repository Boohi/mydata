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
        frame.appendBE(UInt32(20))  // length: version(2) + type(1) + ts(8) + qtype(2) + name_len(2) + name(5)
        frame.appendBE(UInt16(1))                       // version
        frame.append(0x03)                              // type
        frame.appendBE(Int64(0))                        // ts
        frame.appendBE(UInt16(1))                       // qtype
        frame.appendBE(UInt16(100))                     // name_len lies
        frame.append(contentsOf: Array("short".utf8))
        XCTAssertThrowsError(try IPCCodec.decode(frame))
    }
}
