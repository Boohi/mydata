// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataDaemon",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataDaemon", targets: ["MydataDaemon"]),
        .executable(name: "mydata-daemon", targets: ["mydata-daemon"]),
    ],
    dependencies: [
        .package(name: "MydataIPC", path: "../../packages/schema/Swift"),
    ],
    targets: [
        .target(
            name: "MydataDaemon",
            dependencies: [.product(name: "MydataIPC", package: "MydataIPC")]
        ),
        .executableTarget(
            name: "mydata-daemon",
            dependencies: ["MydataDaemon"]
        ),
        .testTarget(
            name: "MydataDaemonTests",
            dependencies: ["MydataDaemon"]
        ),
    ]
)
