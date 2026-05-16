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
