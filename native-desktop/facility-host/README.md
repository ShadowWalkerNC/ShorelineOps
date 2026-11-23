# ShorelineOps facility host foundation

This Rust executable initializes an empty SQLite database and exposes health
and facility setup status on IPv4 loopback. SQLx bundles SQLite into the build. A running
host needs neither Node.js nor a separate database service.

From the repository root, with Rust 1.95 or later and the platform C build tools:

```powershell
cargo build --locked --manifest-path native-desktop/facility-host/Cargo.toml
cargo test --locked --manifest-path native-desktop/facility-host/Cargo.toml
$standaloneData = Join-Path ([IO.Path]::GetTempPath()) ("shoreline-host-" + [guid]::NewGuid())
cargo run --locked --manifest-path native-desktop/facility-host/Cargo.toml -- --data-dir $standaloneData
```

On Linux, run:

```sh
cargo build --locked --manifest-path native-desktop/facility-host/Cargo.toml
cargo test --locked --manifest-path native-desktop/facility-host/Cargo.toml
standalone_data=$(mktemp -d)
cargo run --locked --manifest-path native-desktop/facility-host/Cargo.toml -- --data-dir "$standalone_data"
```

In another terminal, run `curl.exe http://127.0.0.1:17365/api/v1/health` on
Windows or `curl http://127.0.0.1:17365/api/v1/health` on Linux. A healthy host
responds with HTTP 200 and `{"status":"ok","api_version":1}`. SQLite
unavailability after startup returns HTTP 503 without database details. Use
`--port` to select another port or pass `0` to request a free port. The host
prints the selected address once the database is ready.

Use a locally stored directory dedicated to this host. Stop it with Ctrl+C
and reuse the same directory when restarting. The host initializes
`facility.sqlite3` atomically and checks its application ID and schema version
on restart. Unrecognized database types and schema versions fail startup.

## Initialize a facility

Run the installed `shorelineops-facility-host` executable as the local operator
who owns the data directory. Use the same directory for initialization and
normal startup. For example, on Windows from the installation directory:

```powershell
$facilityData = Join-Path $env:LOCALAPPDATA 'ShorelineOpsNative/facility'
.\shorelineops-facility-host.exe --data-dir $facilityData --initialize-facility 'Example Facility'
.\shorelineops-facility-host.exe --data-dir $facilityData
```

On Linux:

```sh
facility_data="${XDG_DATA_HOME:-$HOME/.local/share}/shorelineops-native/facility"
shorelineops-facility-host --data-dir "$facility_data" --initialize-facility 'Example Facility'
shorelineops-facility-host --data-dir "$facility_data"
```

Initialization records the facility name and UTC creation time. Subsequent
initialization attempts fail and preserve the original record. Opening a v1
native database upgrades it to v2 transactionally. Keep a stopped-host copy of
the data directory before trying a new build with existing data.

`GET /api/v1/setup` returns `{"facility_initialized":false}` on an empty host or
`{"facility_initialized":true}` after initialization. This endpoint reports the
presence of the facility record. Keep the data directory under OS access controls
and use synthetic data until identity, clinical workflows and recovery are ready.
Desktop-driven setup and managed backup and restore are upcoming release work.
