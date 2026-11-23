# ShorelineOps project cache

## Standalone Rust product direction (2026-11-16)

- The free self-hosted product is a Rust desktop client and facility-owned service with a versioned API and bundled SQLite. Start with Windows and Ubuntu x64. The facility must be able to operate offline and on its own LAN. Railway SaaS and optional CulinaryOS integrations are separate delivery tracks.
- The paper workflow is finalized menu and diet-order revisions → printed meal tickets → paper return entry → dietitian verification → kitchen counts by exact portion and texture. `native-desktop/core` contains the print template and packet checks. Missing costs leave the per-meal average unavailable.
- The Windows proof installer now bundles the worklist and the loopback-only facility host. Native tests cover reconciliation, print markup and SQLite initialization/restart. See [the standalone guide](docs/SHORELINEOPS_STANDALONE.md) for current behavior, operator workflows and pilot acceptance.
- The host can initialize a named facility once via its local operator CLI and report initialization status on loopback. Schema v2 upgrades blank v1 hosts transactionally. The next release gate is desktop-managed startup and onboarding, audited staff access and clinical records, followed by the desktop-to-host paper workflow. LAN exposure requires authenticated transport, role enforcement and multi-workstation tests. Complete restore, physical printing and accessibility acceptance before use with real facility records.

## Ownership and next acceptance gates (2026-11-15)

- Codex owns integration and acceptance. Gemini's read-only review `SHORELINEOPS-9556` is recorded in `.ai/HANDOFF.md`. Direct Git and installer evidence correct its clean-tree and Linux install claims.
- `main` tops out at `f728703` locally and `4e57c1b` on GitHub. The existing Windows and Linux Electron installers are the release baseline. Windows graphical and install checks and Ubuntu under WSL Debian install and uninstall pass. Complete Linux graphical, upgrade and restore acceptance before release. Then obtain signing credentials and publish the accepted artifacts with verified download links.
- The existing Rust work is in untracked `native-desktop/` and `docs/NATIVE_REBUILD_PLAN.md`; keep the separate audit edit and worktrees intact. On Windows, `cargo test --locked --offline --manifest-path native-desktop/Cargo.toml --workspace` compiled both prototypes and ran zero tests. `cargo fmt --manifest-path native-desktop/Cargo.toml --all -- --check` passed. This proves a Windows build only.
- Native work starts with the existing shared worklist on Windows and Linux, and an Android package on hardware. Record keyboard and screen-reader behavior, large text, touch, activity restart, printing and scanner feasibility. Then implement empty-facility onboarding and scoped access, followed by resident diet order, menu assignment and tray verification with regression fixtures and facility acceptance. Treat the current Android NativeActivity renderer as provisional until TalkBack is demonstrated.
- Railway still reports the same staged account service and PostgreSQL patch with 43 changes. Build configuration, public origin, secrets, health and hosted account acceptance remain open. Customer activation stays owner-controlled and Stripe remains deferred.

## Active release work

Desktop-first release assessment and packaging are in progress on `main`. Current evidence and acceptance gates live in `docs/DESKTOP_SAAS_RELEASE.md`. Historical production-ready labels and test counts require current verification.

## Locked decisions

- The desktop candidate retains the existing Electron, Express and per-user SQLite architecture. Build-only server dependencies are separated from runtime dependencies.
- SaaS uses a separate Railway application service and PostgreSQL database per customer, selected by the user on 2026-11-07.
- Approved monthly prices per facility are Community $0, Pro Cloud $199 and Enterprise $399.
- `sdk` owns the application REST client. `tools/muse` owns separate Muse tooling. `packages/shorelineops-plugin` is the maintained paperwork plugin source, copied from the existing paperwork worktree without altering that worktree. Its deterministic engine is vendored into `server/vendor/ross-paperwork` through `npm run paperwork:vendor`.
- Appearance supports Light, Dark and System, persisted per workstation. A general third-party plugin loader is outside the implemented paperwork integration.
- Stripe is explicitly deferred by the user. Approved prices remain $0/$199/$399 per facility. Paid checkout and entitlement activation must not be reported as working.
- `control-plane/` is an independently locked account service with its own central PostgreSQL database, opaque cookie sessions, verification/recovery, encrypted leased email outbox and account audit. It accepts no facility staff JWTs and stores no patient records. Customer infrastructure creation is manual; verified requests require owner activation. The local operator command checks pre-created isolated resources before registering them.

## Current evidence, 2026-11-08

- PASS: production/demo build, marketing build, SDK contract tests, application regression tests, six desktop tests and 104 plugin tests. Root system assertions also pass.
- PASS: fresh native Windows NSIS installer and Linux AppImage/Debian builds. Both packaged backends tested from disposable copies outside the checkout with blank databases and native module probes.
- PASS: Windows graphical setup, login, restart, paperwork and Light/Dark/System behavior at four widths, with one test administrator and zero residents. Actual Windows installation and installed-runtime check passed.
- PASS: 16 actual PostgreSQL account-service tests, including concurrency, rollback, session revocation and leased outbox fixture transport. Standalone account-service Docker image built.
- OPEN: hosted signup/provisioning, Linux graphical/install/upgrade acceptance, provider/hardware acceptance and release signing/public asset publication. Do not label the whole product production-ready.

Latest checks: full application test log ends with all test files passing, including six desktop tests; account service 16/16 PostgreSQL tests. Provider fallbacks removed from purchasing, facility defaults neutralized, unsupported nutrition unavailable with explicit provenance and clinical review. SDK 0.3.0 matches implemented routes. Latest packages use an isolated Electron shell. Final Windows graphical acceptance PASS. Gmail OAuth and both real verification/recovery deliveries passed locally; hosted deployment and Gmail production publishing remain open.

Final Windows packaged GUI: PASS setup/login/restart/paperwork/appearance and purchasing outage, 390/430/768/1280 widths, zero page errors, one test user and zero residents. Evidence: release/desktop/ui-final-20261108/result.json. Windows installed-runtime acceptance rerun PASS. Linux Debian installation/uninstallation PASS in isolated WSL Ubuntu.

Railway preparation: pending patch 61797e58-7266-4e6e-b832-9178bdd717e6 stages shoreline-accounts (128b39c1-dcce-4e4c-aff0-848365f0f272) and separate Postgres (59cbb037-648b-4c26-b250-062901e61a21). Nonsecret database/origin references and production mode are staged. Account build configuration staging returned Service instance not found and is NOT applied. Not deployed; source, domain and encrypted secret injection remain to finish before approval. Existing production services unchanged. Never accept the entire patch without review and explicit deployment confirmation required by Railway tool.
