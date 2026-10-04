# Desktop runtime readiness

`npm run build` must create the unified `dist/app` bundle and `server/dist/index.js` before `npm run electron`. The desktop shell runs the compiled server using Electron's Node mode and opens the real `/app/login` on the same loopback origin. It never runs Vite, npm development scripts, or a file:// marketing entry point.

Provision a persistent, unique `JWT_SECRET` of at least 32 characters through the launching account's protected environment before launch. The shell does not create, print, or silently rotate a signing key. Account setup remains the authorized setup workflow; demo users are not seeded. SQLite lives in Electron's writable per-user `userData` directory. Protect that directory with OS account permissions, full disk encryption, and verified encrypted backups; SQLite itself is not encrypted by this change.

The desktop backend binds only `127.0.0.1:4000`. An occupied port, missing production artifacts, failed database readiness, or backend exit closes startup rather than showing a connected-looking application. Renderer Node access is disabled, isolation and sandbox are enabled, external navigation/popups and permission requests are denied. Hardware camera/scanner permission needs an explicitly reviewed permission design before enabling it.

Verification: `npm --prefix server run build` then `node --test desktop/backend.test.cjs`. Tests use a temporary SQLite database, no production records, and the actual compiled backend. Electron packaged Windows/macOS/Linux binaries, native SQLite ABI compatibility under Electron, code signing, updater, and installer distribution are separate acceptance gates; these tests use the local Node runtime and do not certify those gates. The existing installer is a Node/web distribution rather than a packaged Electron application.

Verified 2026-10-04: all three tests passed with the installed Electron executable in ELECTRON_RUN_AS_NODE mode as well as the Node runtime. This proves current-machine Electron native SQLite compatibility and backend lifecycle; it does not prove a signed packaged installer or other operating systems.
