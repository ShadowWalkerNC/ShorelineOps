# Windows distribution candidate acceptance - 2026-10-05

Artifact: `dist-installer/ShorelineOps-v5.0.0-Windows-Setup.zip` (local build output, not published or signed).
SHA-256: `D4F6033ED925F6B9E8FD7A5C96BF42D443E1FB5DCE16F4A5BE96EA50097FBDE2`. Size: 8199291 bytes.

The first package omitted `bin/shoreline.js` despite advertising the CLI. The builder now copies the bin directory. The rebuilt candidate passed CLI help.

The archive was extracted to a newly created directory outside the repository. A fresh `npm ci --omit=dev` installed its own pinned runtime dependencies and reported zero vulnerabilities. The extracted compiled launcher passed readiness, `/app/login`, referenced browser JavaScript/CSS with the correct Origin, a blank per-user SQLite database and process shutdown. It did not use repository node_modules or real records. No shortcuts, production databases or keys were modified.

A filename scan found no .env, database or private-key files in the distribution directory. This is a filename check, not proof that arbitrary source text cannot contain secrets. Source builds pin production configuration and keep SDK lab credentials outside the app.

Required builds and source tests passed: 228 system checks, 181 regression tests and all five desktop checks. Complete Setup shortcut installation, signed Electron binaries, real legacy-data upgrade, Linux/macOS installations, updater and hardware permissions remain NOT RUN. Distribution filenames retain the existing v5.0.0 naming; this candidate is not a certified release.
