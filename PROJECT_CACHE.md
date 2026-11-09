# ShorelineOps project cache

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
- OPEN: live Gmail authorization/delivery, hosted signup/provisioning, Linux graphical/install/upgrade acceptance, provider/hardware acceptance and release signing/public asset publication. Do not label the whole product production-ready.

Latest checks: full application test log ends with all test files passing, including six desktop tests; account service 16/16 PostgreSQL tests. Provider fallbacks removed from purchasing, facility defaults neutralized, unsupported nutrition unavailable with explicit provenance and clinical review. SDK 0.3.0 matches implemented routes. Latest packages use an isolated Electron shell. Final Windows graphical acceptance is running. Gmail OAuth and both real verification/recovery deliveries passed locally; hosted deployment and Gmail production publishing remain open.

Final Windows packaged GUI: PASS setup/login/restart/paperwork/appearance and purchasing outage, 390/430/768/1280 widths, zero page errors, one test user and zero residents. Evidence: release/desktop/ui-final-20261108/result.json. Windows installed-runtime acceptance rerun pending.
