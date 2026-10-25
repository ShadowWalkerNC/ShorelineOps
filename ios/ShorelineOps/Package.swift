// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "ShorelineOps",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // An xtool project should contain exactly one library product,
        // representing the main app.
        .library(
            name: "ShorelineOps",
            targets: ["ShorelineOps"]
        ),
    ],
    targets: [
        .target(
            name: "ShorelineOps"
        ),
        .testTarget(
            name: "ShorelineOpsTests",
            dependencies: ["ShorelineOps"],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "--allow-shlib-undefined"], .when(platforms: [.linux]))
            ]
        ),
    ]
)
