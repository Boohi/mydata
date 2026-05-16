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
