// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataExtension",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataExtension", targets: ["MydataExtension"]),
    ],
    dependencies: [
        .package(name: "MydataIPC", path: "../../packages/schema/Swift"),
    ],
    targets: [
        .target(
            name: "MydataExtension",
            dependencies: [.product(name: "MydataIPC", package: "MydataIPC")],
            linkerSettings: [
                .linkedFramework("NetworkExtension", .when(platforms: [.macOS])),
            ]
        ),
        .testTarget(
            name: "MydataExtensionTests",
            dependencies: ["MydataExtension"]
        ),
    ]
)
