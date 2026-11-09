# Desktop and hosted release acceptance

Updated 2026-11-08. Desktop remains the primary product. This is a tested release candidate, with explicit remaining acceptance gates.

## Architecture and decisions

- Electron runs the production React app with a bundled Express server bound to loopback and a private per-user SQLite database. No separate Node installation, cloud account, marketing bundle or demo bundle is required.
- Retain this working architecture. Rust/Tauri efficiency claims would require comparative measurements and a separate migration proposal.
- `packages/shorelineops-plugin` owns maintained paperwork source. Its deterministic engine is generated into `server/vendor/ross-paperwork`, included in desktop and Docker builds, and exposed through authenticated paperwork routes. The original paperwork worktree remains intact.
- Appearance supports Light, Dark and System, persisted per workstation. A general third-party executable plugin loader is not implemented.
- Each SaaS customer must receive a separate Railway application service and PostgreSQL database. The central account service has its own separate database and holds no patient records.
- Approved facility/month pricing is Community self-hosted $0, Pro Cloud $199 and Enterprise $399. Stripe, paid checkout and entitlement activation are deferred by explicit user instruction. Estimates never charge money.

## Current evidence

| Area | Result | Evidence |
|---|---|---|
| Production/demo and marketing builds | PASS | `npm run build:demo`, `npm run build:marketing` |
| Application tests | PASS | application regression tests, system assertions, six desktop lifecycle tests, three SDK contract tests |
| Paperwork source tests | PASS | 104 tests across 23 suites |
| Windows package | PASS | Native NSIS candidate under `release/desktop/isolated-20261108` |
| Windows installed runtime | PASS | Actual silent install into a guarded disposable location, isolated runtime check, uninstall |
| Windows graphical app | PASS | Setup, login, restart, paperwork, Dark/System changes and persisted Dark; widths 390/430/768/1280; no page errors or overflow |
| Blank production database | PASS | One acceptance administrator and zero residents after setup and restart |
| Linux package | PASS | Native AppImage and Debian package under `release/desktop/linux-isolated-20261108` |
| Self-contained runtime | PASS | Both native payloads copied outside the development checkout; production module probes, private blank SQLite, app HTML/JS and shutdown |
| Account service | PASS, local | 16 actual PostgreSQL tests: signup, verification, sessions, reset, CSRF, atomic duplicates, transaction rollback, leased outbox fixture transport |
| Account container | PASS, local | Image built and started as non-root against isolated PostgreSQL; `/ready` returned `ready: true` |
| Gmail authorization | PASS, local | Dedicated OAuth project/client, send-only consent, encrypted Windows-user credential bundle outside the repository |
| Live email delivery | PASS, local | Two actual emails delivered to the approved mailbox; verification, recovery, replay rejection and session revocation checked |
| Dependency audit | PASS, production scopes | Root runtime, independently locked server, account service and plugin reported zero findings. Root development tooling still has low/moderate findings |

The screenshots and machine-readable graphical results are under `release/desktop/ui-final-20261108`. Local logs are ignored. Test accounts, menu/count fixtures and controlled email transport tests are synthetic and are never release seed data. No real resident records were used.

## Build and verify

On a native Windows or Linux x64 host, run `npm ci`, `npm run build:desktop`, then `node scripts/verify-packaged-desktop.cjs`. `SHORELINE_DESKTOP_BUILD_ID` selects a safe candidate subdirectory. Pass that directory to the runtime verifier when used. Windows graphical acceptance uses `scripts/verify-packaged-desktop-ui.cjs`; actual install acceptance uses `scripts/verify-windows-installer.ps1` and refuses an existing installation or shortcut.

Packaging installs the independent server production lock in temporary storage and excludes development/test dependencies. The runtime check copies the result outside the checkout so omitted dependencies cannot resolve from developer node_modules. Desktop data and generated signing/bootstrap secrets remain outside the installation directory. Installers are unsigned.

The manual desktop GitHub workflow builds native Windows/Linux artifacts. Source changes alone do not publish GitHub release assets. Existing public release links must not be represented as containing these local candidates.

For the account service, run `npm ci --workspaces=false`, build and test from `control-plane/`. Its gated tests require an explicit loopback PostgreSQL database named `shoreline_control_test_*`; otherwise they report skipped. Deployment uses `control-plane/Dockerfile` and `/control-plane/railway.json` with repository root build context. Startup migrates before listening and runs the leased outbox worker. No production account-service deployment is claimed.

## Remaining acceptance

- Linux graphical operation, actual package install/uninstall and operator acceptance.
- Upgrade from existing facility data, backup restoration and recovery acceptance on both platforms.
- Release signing, publication and download-link verification.
- Gmail production publishing configuration, hosting secret injection, hosted verification/recovery delivery and expiry/rotation operations.
- Hosted central account deployment, marketing signup links and recoverable per-customer Railway provisioning. The portal records requests and reports manual activation status. An owner-only CLI registers checked, pre-created isolated resources; automatic resource creation and paid licensing remain unimplemented.
- Real PCC/FHIR, distributor, nutrition and other provider acceptance; fixture and estimated paths must never be mistaken for verified live records.
- Physical printing, camera/device workflows, facility data validation and clinical operator acceptance.
- Legal/commercial review of draft agreements.

## Repository organization

`main` is the integration baseline. Develop future changes on short-lived `codex/feature-*` or `codex/fix-*` branches, merge after review and required checks, then tag accepted releases. Preserve other existing branches and worktrees until their contents are reviewed. Do not delete independent work to produce a single-branch appearance.

`src`/`server` own the facility app, `desktop` and packaging scripts own standalone distribution, `marketing` owns the public site, `control-plane` owns central SaaS accounts, `sdk` owns the REST client and `tools/muse` owns separate development tooling. Plugin source and vendored runtime are distinct build boundaries.
