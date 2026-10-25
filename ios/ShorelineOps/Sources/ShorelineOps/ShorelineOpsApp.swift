#if canImport(SwiftUI)
import SwiftUI

@main
struct ShorelineOpsApp: App {
    @State private var store = ShorelineStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: $store)
        }
    }
}
#endif
