# ShorelineOps Android TV Shell

Thin native launcher for facility wall displays. It appears on the TV home
screen and hosts the `/tv` web UI (`/tv/menu`, `/tv/status`) from the
ShorelineOps Express API in a fullscreen WebView pointed at a
facility-configured server URL.

Server contract: `server/src/routes/tv.ts` — pairing endpoints
`POST /api/tv/pair/request`, `GET /api/tv/pair/status`,
`POST /api/tv/pair/approve`, and aggregate feed `GET /api/tv/ops-today`
(counts only, no PHI).

## Prerequisites

- A facility Android TV with Developer Options + USB/network debugging enabled
- No install needed for CLI builds: this repo carries a portable toolchain
  under `.tools/` (Temurin JDK 17, Android SDK 34, Gradle 8.9). Android
  Studio (Hedgehog+) is an optional alternative for IDE builds.

## Build

The Gradle wrapper is committed. From `android-tv/`:

```sh
.\gradlew.bat :app:assembleDebug
```

The APK lands at `app/build/outputs/apk/debug/app-debug.apk`.
(Verified 2026-10-28: BUILD SUCCESSFUL, `leanback-launchable-activity`
confirmed via `aapt2 dump badging`, debug-signed via `apksigner verify`.)

## Install onto a facility TV

```sh
adb connect <TV-IP>:5555        # or use USB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The app appears on the TV home screen via the `LEANBACK_LAUNCHER`
intent filter on `MainActivity`.

> Dev note (this machine): the pilot onn. box is paired through CleanMyTV's
> app-specific ADB key (`%APPDATA%\CleanMyTV\adbkey`), not the system
> `~/.android/adbkey`, so plain `adb devices` can show nothing while the box
> is paired. Reconnect and install through CleanMyTV's own modules
> (`src/main/{tv,reconnect,apps}.ts`) — never ask for a re-pair until a
> reconnect through that path actually fails.

## Set the server URL

1. Launch **ShorelineOps TV** — first run opens the setup screen.
2. Enter the facility server base URL, e.g.
   `https://server.facility.local:3001` (must include the scheme).
3. Select **Save and Connect** (D-pad navigable; the URL field has
   default focus). The URL is stored in `SharedPreferences`
   (`shoreline_tv` → `server_url`).
4. The shell loads `<server-url>/tv/menu`. Back navigates WebView
   history. To re-point the TV, clear the app's data to return to setup.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App not on home screen | Reinstall; launcher entry requires the `LEANBACK_LAUNCHER` filter (see `AndroidManifest.xml`). |
| Blank page / load error | Wrong server URL or TV off the facility network; clear app data and re-enter the URL. |
| HTTP (non-TLS) LAN server blocked | Manifest sets `usesCleartextTraffic="true"` for LAN use; prefer HTTPS in production. |
| Screen sleeps during display | Shell sets `FLAG_KEEP_SCREEN_ON` + `keepScreenOn`; check TV sleep timers. |
| Pairing code rejected | Codes expire after 10 min (`server/src/routes/tv.ts`); request a fresh code. |

## Unverified

- On-device D-pad focus order and WebView rendering (needs the facility pilot).
- Leanback launcher banner artwork (optional; only matters for a Play listing).
