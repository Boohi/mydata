// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataIPC",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataIPC", targets: ["MydataIPC"]),
    ],
    targets: [
        .target(name: "MydataIPC"),
        .testTarget(name: "MydataIPCTests", dependencies: ["MydataIPC"]),
    ]
)
