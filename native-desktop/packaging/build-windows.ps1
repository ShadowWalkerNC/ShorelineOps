param([string]$MakeNsis = 'makensis')
$ErrorActionPreference = 'Stop'
$native = Split-Path -Parent $PSScriptRoot
$target = 'x86_64-pc-windows-msvc'
$output = Join-Path $native 'target/platform-proof'
New-Item -ItemType Directory -Force $output | Out-Null
cargo build --manifest-path (Join-Path $native 'Cargo.toml') --target-dir (Join-Path $native 'target') --locked --release --target $target -p shorelineops-client --bin shorelineops-worklist
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo build --manifest-path (Join-Path $native 'facility-host/Cargo.toml') --target-dir (Join-Path $native 'target') --locked --release --target $target
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$facilityHost = Join-Path $native "target/$target/release/shorelineops-facility-host.exe"
$binary = Join-Path $native "target/$target/release/shorelineops-worklist.exe"
$installer = Join-Path $output 'ShorelineOps-Platform-Proof-windows-x64.exe'
& $MakeNsis "/DWORKLIST=$binary" "/DFACILITYHOST=$facilityHost" "/DINSTALLER=$installer" (Join-Path $PSScriptRoot 'windows.nsi')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Get-FileHash -Algorithm SHA256 -LiteralPath $installer
