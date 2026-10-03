# ShorelineOps Architecture Reassessment — 2026-09-30

Assessment only. No application edits, commits, pushes, deploys, dependency installs, or secret/PHI access were performed. Untracked `public/brand` and all existing work were preserved.

Scope: read `AGENTS.md`, `ARCHITECTURE.md`, `TODO.md`, `LICENSING.md`, `DEPLOYMENT.md`, `SECURITY.md`, `docs/OPERATIONAL_ARCHITECTURE.md`, `docs/OFFLINE_AND_ISOLATION.md`, `docs/VERCEL_DEPLOYMENT_AND_ENV.md`, `docs/DAILY_OPERATIONS_AUDIT.md`, `docs/DECISION_WORKFLOW_HANDOFF.md`, `docs/audits/PRODUCTION_READINESS_AUDIT_2026-09-21.md`, `CHANGELOG.md`, server middleware/routes/db/tests, deployment manifests, backup scripts, and `electron-main.js`. Did not read `.env`, `.env.local`, credentials, real databases, or PHI.

Mission assessed: clinical nutrition operations system (census, therapeutic diet orders, IDDSI textures, allergens, NPO, tray verification, production, purchasing, reporting) supporting hosted and facility-LAN deployments with one facility per database.

## Preserved safety gates (do not weaken in remediation)

- Deterministic NPO hard-block: `server/src/engine/safetyEvaluator.ts:145-150`, `server/src/engine/traySafety.ts:39`, `server/src/engine/production.ts:421-422`, `src/types/resident.ts:65-67`.
- Allergen hold: `server/src/engine/safetyEvaluator.ts:163-173`, `server/src/engine/traySafety.ts:40-57` (holds on incomplete data, superseded versions, and unverified allergy equivalence).
- Human approval: EHR RD triage `PENDING_TRIAGE` in `server/src/routes/ehr.ts:288-301,351-388` with strict `requireDietitianOrAdmin` (`server/src/routes/ehr.ts:180-207`); resident diet writes restricted to dietitian/manager strict equality in `server/src/routes/residents.ts:46-49,596-607`; flag-for-RD path for other roles in `server/src/routes/residents.ts:704-736`.
- Tray-card freshness: profile-version bump and `SUPERSEDED` handling in `server/src/routes/residents.ts:103-135` and `server/src/engine/traySafety.ts:42`.
- Offline honesty: API `NetworkOnly`, no disconnected-mutation success claims, per `docs/OFFLINE_AND_ISOLATION.md:14-18`.
- One facility per database: `server/src/middleware/tenantContext.ts:22-50`, `server/src/facility-scope.test.ts:9-35`, `docs/OFFLINE_AND_ISOLATION.md:22-28`, `.env.example:9-11`.

## Confirmed findings

| # | Finding | Verdict | Severity | Exact sources |
|---|---|---|---|---|
| 1 | Idempotency runs before auth and replay key is unscoped | Confirmed | High | `server/src/index.ts:135-136` mounts `idempotencyMiddleware()` on `/api` before per-route `requireAuth` (`server/src/index.ts:152-168`); key is `method:path:key` with no user/facility scope and replay returns cached body without auth (`server/src/middleware/idempotency.ts:90-98`); tests only cover single-user replay (`server/src/idempotency.test.ts:31-101`) |
| 2 | Resident PHI readable by any authenticated role | Confirmed | High | `GET /api/residents`, `GET /api/residents/:id`, `GET /api/residents/:id/history` have no `requireRole` (`server/src/routes/residents.ts:186,260,278`); router only has `requireAuth` (`server/src/index.ts:152`); `API_ROLES` includes `distributor`, `readonly`, `activities`, `server`, `staff` (`server/src/middleware/requireAuth.ts:5-16`) |
| 3 | Reporting clinical/financial reads have no role gate; substitution create is open | Confirmed | High | No role gate on `summary`, `cost-log` GET, `cpd-breakdown`, `substitutions` GET/POST, `allergy-risk`, `diet-mismatches`, `production-variance`, `compliance-summary`, `haccp-temperature-log`, `budget-periods`/`budget-entries` GET (`server/src/routes/reporting.ts:53,174,229,279,301,336,358,381,411,519,636,670`); only cost-log write/rollup and substitution delete require manager (`server/src/routes/reporting.ts:197,264,320`) |
| 4 | Rank ladder makes `frontdesk` outrank `dietitian`; broad `requireRole('staff')` admits non-clinical writers | Confirmed | High | Rank order `dietitian:6 < frontdesk:7` in `server/src/middleware/requireAuth.ts:55-66` and `src/types/roles.ts:28-39`; `requireRole` is rank-based (`server/src/middleware/requireAuth.ts:110-116`); residents/EHR comments explicitly avoid it for clinical writes (`server/src/routes/residents.ts:40-49`, `server/src/routes/ehr.ts:174-178`); many clinical/operational writes still use `requireRole('staff')` (for example `server/src/routes/residents.ts:523,579`, `server/src/routes/hardware.ts:340`, `server/src/routes/kitchen.ts:673`, `server/src/routes/reporting.ts:644,683,702,727`) |
| 5 | Reporting queries use a non-canonical resident schema and wrong status case | Confirmed | High | Canonical table is `name`, `diet_type`, `status DEFAULT 'Active'` (`server/src/db/migrate.ts:24-44`); canonical census predicate is `status='Active'` (`server/src/db/census.ts:22-23`); reporting uses `status='active'` and `first_name`/`last_name`/`diet_order`/`supplements` (`server/src/routes/reporting.ts:84,91-96,103-105,240-241,284-285,339,361-366,428,431-434`); expected result is PostgreSQL errors or zero counts |
| 6 | Orchestrators probe liveness, not readiness; static-only prod can look healthy | Confirmed | High | `/health` ignores DB while `/ready` checks it (`server/src/index.ts:179-216`); `/api` is gated on `databaseReady` except health/ready (`server/src/index.ts:140-146`); Docker, compose, production compose, Railway, and Render probe `/health` or `/api/health` (`Dockerfile:45-46`, `docker-compose.yml:21-25`, `docker-compose.production.yml:42-45`, `railway.json:9`, `render.yaml:17`); `docs/VERCEL_DEPLOYMENT_AND_ENV.md:15,53` says API health is `/ready`, contradicting manifests |
| 7 | Electron production desktop spawns dev backend | Confirmed | High | `startBackend()` always spawns `npm run dev` in `server/`, `PORT=4000`, `NODE_ENV` defaulting to `development` (`electron-main.js:9-25`); both dev and prod call it (`electron-main.js:99-102`); prod UI loads `file://dist` while backend remains dev (`electron-main.js:70-74`); dev UI URL is stale `http://localhost:3000` (`electron-main.js:72`) versus API default `3001` (`server/src/index.ts:36`) |
| 8 | No PostgreSQL test coverage; SQLite translation hides PG failures | Confirmed | High | Test runner forces `DATABASE_URL=''`, temp `SQLITE_PATH`, `NODE_ENV=test` (`scripts/run-tests.mjs:11-17`); focused suites also force SQLite (`server/src/auth-security.test.ts:14`, `server/src/ehr-decision.test.ts:11`, `server/src/purchasing-integrity.test.ts:10`, `server/src/seed-security.test.ts:18`, `server/src/tray-safety.test.ts:10`); SQLite translator rewrites PG SQL (`server/src/db/pool.ts:61-100`); handoff says PG locking paths were not exercised live (`docs/DECISION_WORKFLOW_HANDOFF.md:27`); `TODO.md:7` leaves PG concurrency unchecked |
| 9 | DB TLS verification off by default/docs; proxy has no TLS | Confirmed | High | Pool defaults to `rejectUnauthorized:false` unless `DATABASE_SSL_REJECT_UNAUTHORIZED=true` (`server/src/db/pool.ts:15-25`); compose sets `false` (`docker-compose.yml:17`); Railway docs say `false` (`DEPLOYMENT.md:97`); production compose uses `sslmode=disable` (`docker-compose.production.yml:33`); `nginx.conf:1-18` listens only on port 80; deployment nginx snippet has no cert (`DEPLOYMENT.md:158-180`); HSTS without TLS is ineffective (`server/src/index.ts:75-79`); `.env.example:13` and `docs/VERCEL_DEPLOYMENT_AND_ENV.md:32` correctly recommend verification, but manifests/docs contradict them |
| 10 | Backup export is partial; restore is lossy, non-transactional, unproven | Confirmed | High | Export covers 6 tables only (`server/src/routes/admin.ts:927-969`); restore upserts residents only with a subset of columns and no transaction (`server/src/routes/admin.ts:973-1041`); examples of omitted data include diet/profile history, audit log, menus, production, purchasing, HACCP, tray runs; scripts are PG-dump only, unencrypted, unscheduled (`scripts/backup.sh:20-24`, `scripts/backup.ps1:22`); release gate requires an isolated restore drill (`docs/VERCEL_DEPLOYMENT_AND_ENV.md:53`) with no recorded evidence; prior audit leaves backup/restore open (`docs/audits/PRODUCTION_READINESS_AUDIT_2026-09-21.md:87`) |
| 11 | Kitchen WebSocket is a non-protocol placeholder with no auth | Confirmed | Medium | Upgrade handler writes a hardcoded RFC-example `Sec-WebSocket-Accept`, no key derivation, auth, framing, or lifecycle handling (`server/src/index.ts:345-357`); no `ws` dependency (`server/package.json:17-41`); changelog still advertises high-frequency WS (`CHANGELOG.md:157-158`) |
| 12 | Rate limiting is coarse, single-instance, and LAN-unfriendly | Confirmed | Medium | Global `/api` limit 100/15m plus auth limit 10/15m (`server/src/index.ts:108-122`); `/api/auth` traverses both limiters; in-memory store does not share across instances; no targeted limits on import, verify-scan, backup/restore, or webhook paths; `trust proxy` only in prod (`server/src/index.ts:41`); 100/15m per IP can throttle a busy facility NAT/tablet fleet during meal rush |
| 13 | Frontend permission map and backend rank checks disagree | Confirmed | Medium | Frontend has a permission matrix (`src/types/roles.ts:121-205`) but backend largely uses rank thresholds; for example frontend `frontdesk` lacks dietitian clinical approvals yet backend rank admits frontdesk wherever dietitian rank is required, except where strict equality was added |

## Risks (not independently proven in this read-only pass)

- Multi-facility use on one database remains unsafe: tenant middleware rejects foreign credentials/switching, but most operational tables lack `facility_id`/RLS; prior audit grades tenant isolation D+ (`docs/audits/PRODUCTION_READINESS_AUDIT_2026-09-21.md:17`) and later docs narrow support to one facility per DB.
- Production PHI exposure through overly broad read access cannot be quantified without access logs; finding 2/3 make it structurally possible.
- Idempotency cross-principal replay requires key collision/reuse; exploitability depends on client key generation, but the server does not prevent it.
- Reporting breakage severity depends on backend: PostgreSQL likely errors on missing columns; SQLite may return empty/wrong counts depending on translation and legacy data.
- LAN availability during meal rush depends on device count behind NAT and retry behavior; the present global limit is the structural risk.

## Prioritized bounded remediation tasks

1. Scope idempotency after auth.
   - Move idempotency inside authenticated routes or make it auth-aware; include authenticated user/facility (or token subject) in the cache key; never replay a cached response to a different principal.
   - Acceptance: unauthenticated request cannot replay an authenticated response; same key from two users does not cross-replay; existing single-user replay test still passes; add negative tests for cross-user and unauthenticated replay.

2. Gate resident reads by clinical need.
   - Require an explicit allow-list for `GET /api/residents`, `GET /api/residents/:id`, and history; deny `distributor` and `readonly` PHI reads by default; keep audit logging.
   - Acceptance: distributor/readonly receive 403 on resident reads; dietitian/manager/admin retain access; every allowed read still writes `VIEW_RESIDENT`/`VIEW_DIET_HISTORY`; tests cover allowed/denied roles.

3. Gate reporting reads and substitution writes.
   - Add role gates to all reporting GET endpoints and require at least staff/manager for substitution create/update as clinically appropriate; keep manager-only financial writes.
   - Acceptance: anonymous/distributor/readonly cannot read reporting PHI/financial endpoints; authorized clinical/finance roles can; substitution POST without the required role returns 403.

4. Replace rank checks on clinical paths with explicit role sets.
   - Extend the existing strict-equality pattern to every clinical write/read gate; stop relying on `frontdesk > dietitian` rank; align backend gates with the frontend permission map or document deliberate differences.
   - Acceptance: frontdesk cannot perform dietitian-only actions; no clinical route uses bare `requireRole('staff')` as its sole authority check; tests assert frontdesk denial and dietitian/manager allowance.

5. Fix reporting resident SQL to the canonical schema.
   - Replace `first_name`/`last_name`/`diet_order`/`supplements` with `name`/`diet_type`/existing columns; replace `status='active'` with canonical `status='Active'` or `activeResidentWhere()`; fix joins and ordering.
   - Acceptance: reporting endpoints return correct counts on PostgreSQL-shaped data; allergy/special-diet counts match canonical census; regression tests fail on the old column names/case.

6. Make readiness authoritative in every manifest.
   - Point Docker, compose, production compose, Railway, and Render health checks at `/ready` (or `/api/ready` where routed); keep `/health` as liveness only; document static-only behavior.
   - Acceptance: orchestrator health fails when DB is unavailable; `/health` can stay 200 while `/ready` is 503; manifests and `docs/VERCEL_DEPLOYMENT_AND_ENV.md` agree.

7. Fix Electron production backend invocation.
   - Launch the compiled server (`server/dist/index.js`) in production with production env/port; reserve `npm run dev` for development; correct dev/prod URLs and shutdown handling.
   - Acceptance: packaged production app starts without dev dependencies; backend listens on the intended production port with `NODE_ENV=production`; dev flow still works.

8. Add real PostgreSQL coverage before clinical release.
   - Add disposable-PG integration coverage for migrations, resident/reporting SQL, concurrent EHR approval/edit, scan/clinical-update races, and backup/restore; keep SQLite tests for offline LAN behavior.
   - Acceptance: suite exercises PG-backed paths in CI or a documented disposable environment; PG-only SQL errors are caught; concurrency scenarios in `docs/DECISION_WORKFLOW_HANDOFF.md:27` and `TODO.md:7` are checked.

9. Fail closed on DB TLS and document proxy TLS.
   - Default PostgreSQL to verified TLS; require explicit, documented opt-out for local LAN only; remove `sslmode=disable` and `rejectUnauthorized:false` from production manifests/docs; provide a TLS-terminating proxy example with cert management.
   - Acceptance: untrusted DB cert fails closed; trusted chain succeeds; production manifests contain no disable-verification defaults; docs distinguish LAN plaintext from hosted TLS.

10. Bound backup/restore to a provable set.
    - Declare the exact included tables/columns; make restore transactional and idempotent; preserve clinical provenance/version history or explicitly refuse partial restores; encrypt exports or document handling; record an isolated restore drill with RPO/RTO.
    - Acceptance: export/restore inventory is documented; interrupted restore does not leave partial clinical data; disposable-DB drill evidence exists; lossy resident-column restore is fixed or removed.

11. Remove or properly implement kitchen WebSocket.
    - Either delete `/api/ws/kitchen` and its changelog/marketing claims, or implement RFC handshake, auth, framing, lifecycle, and tests with a maintained library.
    - Acceptance: no hardcoded accept key or silent socket destroy remains; if retained, unauthorized clients cannot connect and protocol tests pass; if removed, docs no longer advertise it.

12. Right-size rate limits for facility LAN plus sensitive endpoints.
    - Keep a global safety net but add per-endpoint/user-aware limits for auth, import, verify-scan, backup/restore, and webhooks; document NAT behavior; use a shared store when horizontally scaled.
    - Acceptance: normal meal-rush tablet fleet does not hit 429 under the documented load assumption; auth/import/sensitive endpoints still throttle abuse; limits and assumptions are documented.

## Suggested remediation order

1, 2, 3, 4, 5, 9, 6, 10, 8, 7, 12, 11.

Assessment artifact: this file only.
