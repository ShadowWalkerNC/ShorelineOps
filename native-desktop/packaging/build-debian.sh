#!/bin/sh
set -eu
native=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
test "$(dpkg --print-architecture)" = amd64
target=x86_64-unknown-linux-gnu
cargo build --manifest-path "$native/Cargo.toml" --target-dir "$native/target" --locked --release --target "$target" -p shorelineops-client --bin shorelineops-worklist
cargo build --manifest-path "$native/facility-host/Cargo.toml" --target-dir "$native/target" --locked --release --target "$target"
stage=$(mktemp -d)
trap 'rm -r -- "$stage"' EXIT
install -Dm755 "$native/target/$target/release/shorelineops-worklist" "$stage/usr/bin/shorelineops-worklist"
install -Dm755 "$native/target/$target/release/shorelineops-facility-host" "$stage/usr/bin/shorelineops-facility-host"
mkdir -p "$stage/DEBIAN" "$stage/usr/share/applications" "$native/target/platform-proof"
cat > "$stage/DEBIAN/control" <<'EOF'
Package: shorelineops-platform-proof
Version: 0.1.0
Architecture: amd64
Maintainer: ShorelineOps
Depends: libc6, libegl1, libgl1, libx11-6, libxkbcommon0, libwayland-client0, libdbus-1-3, cups-client
Description: ShorelineOps native desktop platform proof
 Tray worklist and loopback facility host for platform evaluation.
EOF
cat > "$stage/usr/share/applications/shorelineops-platform-proof.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=ShorelineOps Platform Proof
Exec=shorelineops-worklist
Categories=Office;
Terminal=false
EOF
package="$native/target/platform-proof/shorelineops-platform-proof_0.1.0_amd64.deb"
dpkg-deb --root-owner-group --build "$stage" "$package"
sha256sum "$package"
