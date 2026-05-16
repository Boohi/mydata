import XCTest
@testable import MydataExtension

final class PlaceholderTests: XCTestCase {
    func testPlaceholderIdentity() {
        XCTAssertEqual(Placeholder.name, "mydata-extension")
    }
}
