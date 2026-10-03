# ShorelineOps remediation plan — 2026-09-30

## Scope and authorization

The user requested assessment first, then implementation through Muse CLI with delegated ownership. No commits, pushes, deployment changes, production database operations, dependency installation, or clinical-policy relaxation are included. Preserve the pre-existing untracked `public/brand/` directory.

## Mission and deployment contract

The application coordinates reviewed clinical orders, resident profiles, menus and recipes, procurement, production, safe meal delivery, and auditable outcomes. Browser/PWA, CLI, and desktop clients must use the same authoritative API. Support one facility per database. Local operation means clients can reach a facility LAN server without public internet; disconnected clients cannot authorize trays or report unsaved work as completed.

Keep TypeScript/Node as the core. Consider Rust only for a measured CPU bottleneck or bounded hardware agent after these correctness and security gates are satisfied.

## Reviewed findings

- Critical: process-local idempotency replay precedes authentication and lacks principal/body scope. A synthetic probe replayed a cached 200 without reaching downstream authentication.
- High: resident list/detail/history and several clinical reporting routes have authentication without role authorization. Kitchen mutation and tray-generation routes also lack explicit role gates.
- High: rank-based role checks do not model unrelated jobs. Preserve the existing strict clinical-write and EHR approval allowlists; do not grant an admin wildcard over clinical policy.
- High: reporting uses resident columns/status values inconsistent with migrations.
- High: both Compose configurations supply credential defaults; production Compose publishes the database and supplies the wrong clinical facility variable.
- High risk: default PostgreSQL TLS does not verify certificates. Local non-TLS PostgreSQL needs an explicit mode, not permissive remote TLS.
- High acceptance gap: default tests exercise SQLite, not PostgreSQL concurrency. Backups have no demonstrated encrypted restore acceptance; PowerShell backup does not explicitly inspect native exit status.
- Medium: deployment probes use liveness despite existing readiness; global IP rate limits can constrain a shared facility; kitchen WebSocket handshake is a placeholder; Electron starts a development backend in production.

## Bounded implementation ownership

1. **Muse security workstream:** API permissions and middleware ordering; scoped, body-bound replay after current authorization; exclude auth/setup/webhook credential flows; route-denial and replay regression tests. Keep schema, clinical engine and purchasing invariants intact. Root agent reviews semantics and test results.
2. **Muse reporting workstream, sequential after security:** canonical resident schema/status fixes and synthetic route tests for meaningful outputs. Preserve report response contracts where possible. No compliance certification claims.
3. **Muse deployment workstream:** Compose secrets/network/facility variables, readiness, explicit verified/disabled TLS modes, backup failure handling and exclusion of backup artifacts. No actual deployment or real backup/database access. Isolated source/configuration tests only.
4. **Independent reviewers:** read-only audit of the changed security and deployment work; no competing edits or builds.

## Plan audit and boundaries

Do not create shared-database tenancy, disconnected clinical sync, a Rust rewrite, or a new device trust system during this remediation. Device packaging, real printer/scanner behavior, clinically reviewed canonical ingredient/allergen data, and production recovery require separate acceptance evidence. Avoid broad API redesigns and do not silently expand role authority to keep a test green.

## Acceptance

- Missing/invalid authentication and denied capabilities cannot replay a cached success or mutate data.
- A different principal, changed body, or changed permission cannot reuse another operation's idempotency response. Same authorized principal and body can replay; concurrent duplicates conflict.
- Distributor accounts cannot read resident, hydration, tray, or clinical-report data. Read-only accounts cannot perform kitchen mutations.
- Existing NPO/allergen, stale-tray, EHR rollback, and purchasing approval regressions continue to pass.
- Reporting returns representative synthetic records against canonical migrations.
- Compose requires external secrets, keeps PostgreSQL private, uses canonical facility scope, and checks readiness. Local non-TLS configuration remains explicit; remote TLS verifies certificates by default.
- Backup failure cannot publish a successful artifact or rotate existing backups.
- Run `npm run typecheck`, `npm run build:demo`, `npm run build:marketing`, and `npm test` after edits, serializing shared output builds. Report PostgreSQL, real restore, devices, production, accessibility and load-test acceptance separately as NOT RUN unless actually verified.

## Handoff

Assessment is source/local evidence, not a complete penetration test or production certification. Record each implemented item and remaining gate in this document or the final handoff. Preserve prior completed safety work and unrelated files.

Completed 2026-10-02: bounded security, canonical reporting, SQLite parameter binding and deployment/backup failure-handling workstreams. Typecheck, demo/application build, marketing build and full isolated tests passed (228 system checks + 99 tests, no failures/skips). Independent review findings were resolved. Remaining real PostgreSQL, encrypted recovery, hardware, desktop and load acceptance are documented in [the implementation handoff](REMEDIATION_HANDOFF_2026-10-01.md). No commit, push or deployment performed.
