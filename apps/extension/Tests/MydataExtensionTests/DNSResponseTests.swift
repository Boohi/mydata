import XCTest
@testable import MydataExtension

final class DNSResponseTests: XCTestCase {
    // RFC 5737/3849 documentation addresses only; no socket or resolver calls.
    private let question: [UInt8] = [7] + Array("example".utf8) + [3] + Array("com".utf8) + [0, 0, 1, 0, 1]

    private func response(_ answers: [UInt8], count: UInt8 = 1, flags: UInt8 = 0x80) -> Data {
        Data([0x12, 0x34, 0x81, flags, 0, 1, 0, count, 0, 0, 0, 0] + question + answers)
    }

    func testCompressedAResponse() throws {
        let packet = response([0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 192, 0, 2, 8])
        let parsed = try DNSPacket.parseResponse(packet)
        XCTAssertEqual(parsed.question.qname, "example.com")
        XCTAssertEqual(parsed.transactionID, 0x1234)
        XCTAssertEqual(parsed.resolvedIPs, ["192.0.2.8"])
    }

    func testCNAMEChainExcludesUnrelatedAnswer() throws {
        let alias: [UInt8] = [5] + Array("alias".utf8) + [0xc0, 12]
        let cname: [UInt8] = [0xc0, 12, 0, 5, 0, 1, 0, 0, 0, 60, 0, UInt8(alias.count)] + alias
        let address: [UInt8] = alias + [0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 192, 0, 2, 9]
        let unrelated: [UInt8] = [5] + Array("other".utf8) + [0, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 192, 0, 2, 99]
        XCTAssertEqual(try DNSPacket.parseResponse(response(cname + address + unrelated, count: 3)).resolvedIPs, ["192.0.2.9"])
    }

    func testAAAAResponse() throws {
        var packet = response([0xc0, 12, 0, 28, 0, 1, 0, 0, 0, 60, 0, 16,
                               0x20, 1, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        packet[packet.startIndex + 26] = 28 // question QTYPE
        XCTAssertEqual(try DNSPacket.parseResponse(packet).resolvedIPs, ["2001:db8::1"])
    }

    func testRejectsPointerCycleAndTruncatedRData() {
        XCTAssertThrowsError(try DNSPacket.parseResponse(response([0xc0, 29, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 192, 0, 2, 1])))
        XCTAssertThrowsError(try DNSPacket.parseResponse(response([0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 192])))
    }

    func testTruncatedAndErrorRepliesDoNotInventAddresses() throws {
        let answer: [UInt8] = [0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, 192, 0, 2, 1]
        var truncated = response(answer)
        truncated[2] |= 2
        XCTAssertEqual(try DNSPacket.parseResponse(truncated).resolvedIPs, [])
        XCTAssertEqual(try DNSPacket.parseResponse(response(answer, flags: 0x83)).resolvedIPs, [])
    }
}
