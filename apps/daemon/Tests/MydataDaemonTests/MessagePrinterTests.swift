import XCTest
import MydataIPC
@testable import MydataDaemon

final class MessagePrinterTests: XCTestCase {

    func testDNSQueriedLineStartsWithDns() {
        let payload = DNSQueryPayload(
            timestampNanos: 1_700_000_000_000_000_000,
            qtype: 1,
            qname: "example.com"
        )!
        let line = MessagePrinter.line(for: .dnsQueried(payload))
        XCTAssertTrue(line.hasPrefix("dns "), "Expected line to start with 'dns ', got: \(line)")
        XCTAssertTrue(line.contains("1700000000000000000"), "Expected timestamp in line: \(line)")
        XCTAssertTrue(line.contains("1"), "Expected qtype in line: \(line)")
        XCTAssertTrue(line.contains("example.com"), "Expected qname in line: \(line)")
    }

    func testDNSQueriedLineContainsAllFields() {
        let ts: Int64 = 42_000_000_000
        let payload = DNSQueryPayload(
            timestampNanos: ts,
            qtype: 28,
            qname: "mail.example.org"
        )!
        let line = MessagePrinter.line(for: .dnsQueried(payload))
        XCTAssertTrue(line.hasPrefix("dns "))
        XCTAssertTrue(line.contains("ts=\(ts)"))
        XCTAssertTrue(line.contains("qtype=28"))
        XCTAssertTrue(line.contains("qname=mail.example.org"))
    }
}
