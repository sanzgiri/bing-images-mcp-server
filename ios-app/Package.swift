// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BingImageApp",
    platforms: [.iOS(.v17)],
    products: [.library(name: "BingImageApp", targets: ["BingImageApp"])],
    targets: [.target(name: "BingImageApp")]
)
