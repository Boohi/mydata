// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataDaemon",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataDaemon", targets: ["MydataDaemon"]),
    ],
    targets: [
        .target(name: "MydataDaemon"),
        .testTarget(name: "MydataDaemonTests", dependencies: ["MydataDaemon"]),
    ]
)
