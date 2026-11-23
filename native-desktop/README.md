# ShorelineOps native desktop platform proof

The first release targets Windows and Ubuntu on x64. The worklist installer is
for platform verification and operates without a facility database.

The pilot begins after desktop accessibility and printing pass on both
platforms. Both installers will support creating an empty facility or joining
one over the LAN. The first workflow covers diet orders, menu assignment,
nutrition review, tray checks, print and authorized manual entry, and recovery.
Public publication follows assisted-living and hospital pilot acceptance.

| Platform | Build from the repository root | Output under `native-desktop/target/platform-proof/` |
| --- | --- | --- |
| Windows | `./native-desktop/packaging/build-windows.ps1 -MakeNsis <path-to-makensis.exe>` | `ShorelineOps-Platform-Proof-windows-x64.exe` |
| Ubuntu | `sh native-desktop/packaging/build-debian.sh` | `shorelineops-platform-proof_0.1.0_amd64.deb` |

On a clean install, use Tab and Space to select each meal and activate the test
print button. Verify Narrator on Windows and the Orca screen reader on Ubuntu
announce focus and selection, and repeat at 200% desktop scaling. Select a test
queue in the Windows print dialog or set a CUPS test queue as the default on
Linux. Confirm the sample page arrives and repeat with an unavailable queue.
Verify uninstall removes the proof and its launcher. Record the OS version,
screen reader, package checksum, and print result for each platform.

Development evidence: the NSIS installer installed and removed cleanly on
Windows 11. The packaged worklist launched and the Windows UI Automation tree
exposed the meal controls and print button on a separate launch. The Debian
package installed and removed on Ubuntu 26.04 under WSL, and the extracted
executable opened a WSLg window. These checks leave clean desktop screen-reader, text scaling, and
print queue acceptance open. The Windows automation probe did not observe a
print dialog. The GitHub workflow uses Ubuntu 24.04 as the Debian build target.

## Standalone development

The [standalone release guide](../docs/SHORELINEOPS_STANDALONE.md) describes the facility-owned deployment and the paper-to-kitchen workflow.

- [Facility host](facility-host/README.md): local Rust HTTP service with bundled SQLite, local facility initialization, and versioned readiness and setup status endpoints.
- Core library: revision checks, reviewed ticket reconciliation and cost per verified meal. The library has no desktop or cloud dependencies.
- The platform-proof packages include the worklist and loopback host. Launch the host separately with the documented data directory. The package smoke test launches the installed host, checks blank status, initializes a synthetic facility and verifies its status after restart. Automatic desktop setup, authenticated facility access and the authorized workflow remain release gates.

From the repository root, run:

```text
cargo test --locked --manifest-path native-desktop/Cargo.toml --workspace
cargo test --locked --manifest-path native-desktop/facility-host/Cargo.toml
```

## Shared native worklist platform proof

The `shorelineops-client` workspace member is the Rust-authored eframe client for Windows, Linux, and Android. It opens to an empty tray worklist with meal selection and no facility data or tray authorization. Build with Rust 1.95 or later.

```text
cargo run --locked --manifest-path native-desktop/Cargo.toml -p shorelineops-client --bin shorelineops-worklist
```

On Linux, run in an X11 or Wayland session with OpenGL and the appropriate X11 or Wayland libraries installed. The Android library exposes a NativeActivity entry point and includes cargo-apk metadata. With Android SDK platform 35, the NDK, the Rust `aarch64-linux-android` target, and cargo-apk installed, build a development APK from `native-desktop` with `cargo apk build -p shorelineops-client`.

Windows and Linux acceptance follows the checks above. Android and scanner
acceptance are later milestones. eframe 0.37 rejects AccessKit with Android
NativeActivity. The Android accessibility gate requires a separate GameActivity
packaging and TalkBack proof or a different toolkit. The worklist has no
facility API, persistence, or clinical engine.

## Original Win32 training preview

This Rust prototype uses standard Windows controls and runs independently of the existing Electron and Node.js desktop application. It opens a tray-safety training screen with three synthetic examples. Each example displays a predefined hold reason. The prototype has no clinical data access, tray verification, or service actions.

From the repository root, build with the Rust MSVC toolchain and Windows C++ build tools installed.

```powershell
cargo build --locked --release --manifest-path native-desktop/Cargo.toml -p shorelineops-native
& ./native-desktop/target/release/shorelineops-native.exe
```

To check the interface, use Tab and Space to open each scenario. Confirm that each result shows **HOLD TRAY** and the corresponding reason. Close the window to end the process.

The first operational workflow will need a Rust implementation of the existing tray verification contract, including signed tickets, current resident and recipe data, and fail-closed behavior. Verify parity against `server/src/tray-safety.test.ts` before connecting the native interface to that implementation.
