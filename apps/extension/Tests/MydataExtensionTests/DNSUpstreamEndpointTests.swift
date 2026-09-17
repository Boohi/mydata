import XCTest
import Network
import NetworkExtension
@testable import MydataExtension

final class DNSUpstreamEndpointTests: XCTestCase {
    func testAcceptsOriginalNumericEndpointWithoutPortRewrite() {
        XCTAssertNotNil(DNSUpstreamEndpoint.parse(NWHostEndpoint(hostname: "192.0.2.53", port: "5353")))
        XCTAssertNotNil(DNSUpstreamEndpoint.parse(NWHostEndpoint(hostname: "2001:db8::53", port: "53")))
    }
    func testRejectsResolverNameAndInvalidPortWithoutFallback() {
        XCTAssertNil(DNSUpstreamEndpoint.parse(NWHostEndpoint(hostname: "resolver.example", port: "53")))
        XCTAssertNil(DNSUpstreamEndpoint.parse(NWHostEndpoint(hostname: "192.0.2.53", port: "invalid")))
        XCTAssertNil(DNSUpstreamEndpoint.parse(NWHostEndpoint(hostname: "192.0.2.53", port: "0")))
    }
}
