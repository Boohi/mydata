import XCTest
@testable import MydataDaemon

final class PlaceholderTests: XCTestCase {
    func testPlaceholderIdentity() {
        XCTAssertEqual(Placeholder.name, "mydata-daemon")
    }
}
