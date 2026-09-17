import XCTest
@testable import MydataIPC

final class DNSResolutionCodecTests: XCTestCase {
    func testNewResolutionTypePreservesLegacyQueryEncoding() throws {
        let query = DNSQueryPayload(timestampNanos: 42, qtype: 1, qname: "example.com")!
        let legacy = IPCCodec.encode(.dnsQueried(query))
        XCTAssertEqual(legacy[6], 0x03)
        XCTAssertEqual(legacy.count, 7 + 12 + 11)
        let result = DNSResolutionPayload(query: query, rcode: 0, resolvedIPs: ["192.0.2.8", "2001:db8::1"])!
        let frame = IPCCodec.encode(.dnsResolved(result))
        XCTAssertEqual(frame[6], 0x04)
        XCTAssertEqual(try IPCCodec.decode(frame).0, .dnsResolved(result))
    }

    func testRejectsNonAddressAndOverLimitMetadata() {
        let query = DNSQueryPayload(timestampNanos: 42, qtype: 1, qname: "example.com")!
        XCTAssertNil(DNSResolutionPayload(query: query, rcode: 0, resolvedIPs: ["resolver.example"]))
        XCTAssertNil(DNSResolutionPayload(query: query, rcode: 0, resolvedIPs: Array(repeating: "192.0.2.8", count: 65)))
        XCTAssertNil(DNSQueryPayload(timestampNanos: 1, qtype: 1, qname: "bad\nname"))
        XCTAssertNil(DNSQueryPayload(timestampNanos: 1, qtype: 1, qname: "bad\0name"))
    }

    func testRejectsTruncatedAddressAndTrailingBytes() throws {
        let query = DNSQueryPayload(timestampNanos: 42, qtype: 1, qname: "example.com")!
        let result = DNSResolutionPayload(query: query, rcode: 0, resolvedIPs: ["192.0.2.8"])!
        var frame = IPCCodec.encode(.dnsResolved(result))
        frame.removeLast()
        let size = UInt32(frame.count - 4)
        frame.replaceSubrange(0..<4, with: [UInt8(size >> 24), UInt8((size >> 16) & 255), UInt8((size >> 8) & 255), UInt8(size & 255)])
        XCTAssertThrowsError(try IPCCodec.decode(frame))
        var trailer = IPCCodec.encode(.dnsResolved(result))
        trailer.append(0)
        let length = UInt32(trailer.count - 4)
        trailer.replaceSubrange(0..<4, with: [UInt8(length >> 24), UInt8((length >> 16) & 255), UInt8((length >> 8) & 255), UInt8(length & 255)])
        XCTAssertThrowsError(try IPCCodec.decode(trailer))
    }
}
