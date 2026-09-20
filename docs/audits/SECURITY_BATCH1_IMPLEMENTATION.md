# Security batch 1 — demo isolation and MFA boundaries

Approved by founder on 2026-09-20. Scope: SEC-01 and SEC-02 from the audit; no production deployment or data deletion.

## Behavior changed

- Normal startup applies migrations without sample accounts or residents. Demo seeding requires an explicit server-side `SHORELINE_DEMO_SEED=true` and is forbidden when `NODE_ENV=production`, even with the flag. The exported seed function and seed CLI enforce the same boundary.
- Protected setup rejects sample requests before writing facility or owner records unless demo seeding is explicitly allowed. Clean setup uses an explicit owner UUID so it works on SQLite as well as PostgreSQL's schema. Existing records are not removed or rewritten by this change.
- Sample account credentials are no longer printed in seed logs. Explicit demo datasets still contain public sample credentials and must only use an isolated disposable environment.
- Completed access tokens carry `purpose=access`, audience `shoreline-api`, a recognized role, expiry and boolean MFA state. Pending MFA tokens use audience `shoreline-mfa` and only their exact verification/enrollment purpose. A completed login with optional MFA remains supported.
- All access-token consumers, including enrollment's bearer alternative and the EHR strict-role check, use the same validator. Pending tokens cannot be substituted into these paths.
- SQLite authentication tests exposed missing refresh-token IDs and nonportable Date bindings. Refresh inserts now use explicit UUIDs and UTC ISO timestamps; expiry comparison uses a matching timestamp parameter. Normal login, MFA, refresh, sequential replay rejection and expiry are covered.

## Changed code and tests

`server/src/db/seed.ts`, `server/src/index.ts`, `server/src/routes/setup.ts`, `server/src/middleware/requireAuth.ts`, `server/src/routes/auth.ts`, `server/src/routes/ehr.ts`, `server/src/auth-security.test.ts`, `server/src/seed-security.test.ts`, root/server package test scripts. No schema migration, third-party service, clinical rules, frontend or hosting configuration changed.

The tests use disposable SQLite files in OS temporary directories and synthetic accounts. No dotenv or real database connection is used by the new security fixtures. Current `npm test` includes the new regression suites after the existing system harness; compile the server before running it.

## Demo and clean initialization

For real installations, leave `SHORELINE_DEMO_SEED` unset and use the protected `/setup` flow with `initMode=clean` and a configured `SETUP_BOOTSTRAP_SECRET`. Do not use known example credentials for a real owner. The frontend `VITE_DEMO_MODE` and server `SHORELINE_DEMO_SEED` are separate controls; a client flag/request cannot authorize server fixture writes.

To exercise fixtures, use a new disposable database, set a non-production `NODE_ENV` and `SHORELINE_DEMO_SEED=true`, run migrations, and explicitly run `npm run db:seed` or start the local demo server. Do not point this opt-in at a real facility database. Production startup skips/refuses demo seeding but can still proceed with clean migrations; direct production seed calls fail.

## Compatibility, data and rollback

No existing sample users are automatically deleted, deactivated or rotated. Operators of existing installations must separately inventory seeded identities, rotate credentials, revoke sessions where appropriate, and review logs under an approved remediation procedure. This patch does not claim existing deployments are clean.

Legacy access/pending tokens lack the new audience/purpose and are rejected. Users may need to restart MFA/login; valid existing refresh sessions may obtain the new access format. SQLite refresh records written with legacy incompatible timestamps can require a fresh login. No signing secret rotation is performed.

Deploy only after separate release authorization and supported-database verification. If this change causes a rollout failure, isolate the affected deployment and restore service through an approved forward fix or paper downtime procedure; do not restore acceptance of pending MFA tokens or automatic sample credentials as a convenience. Clinical blockers still prohibit production use.

Remaining out of scope: atomic refresh rotation and durable prior-MFA satisfaction, account revocation, startup/migration readiness, setup transactionality, clinical ingestion/healer/scanner/save truth, shared tenancy, billing, package remediation and public claims. In particular this batch does not make ShorelineOps production-ready.

## Verification

Final command outcomes are recorded below after the complete check run. Initial focused authentication run caught the pre-existing SQLite refresh issue; after the persistence correction, all ten authentication suite results passed. This is nine subtests plus their parent, not ten independent workflows. The original audit logs remain historical evidence and are not overwritten.
