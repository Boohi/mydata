// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MydataExtension",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "MydataExtension", targets: ["MydataExtension"]),
    ],
    targets: [
        .target(
            name: "MydataExtension",
            linkerSettings: [
                .linkedFramework("NetworkExtension", .when(platforms: [.macOS])),
            ]
        ),
        .testTarget(name: "MydataExtensionTests", dependencies: ["MydataExtension"]),
    ]
)
