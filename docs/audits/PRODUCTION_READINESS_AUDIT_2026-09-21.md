# ShorelineOps Production Readiness Audit — 2026-09-21

## Decision

ShorelineOps is ready for a controlled, single-facility Ross Manor beta after the Railway deployment and live smoke test in this audit are complete. It is not yet ready for unrestricted multi-facility clinical SaaS sales.

The active production architecture is React/Astro -> Express API -> PostgreSQL on Railway. Supabase is not an additional application data layer. It may be used only as a managed PostgreSQL provider in a future environment. The browser does not connect directly to Supabase, and production fallback writes to localStorage/IndexedDB have been disabled.

## Readiness grades

| Area | Grade | Evidence and limits |
|---|---:|---|
| Build and dependency integrity | A- | TypeScript, server build, demo build, marketing build, 228 system tests, and 17 auth/setup tests pass. `npm audit` reports 0 vulnerabilities. The main SPA bundle is still about 1.55 MB minified and needs code splitting. |
| Database and migrations | B | PostgreSQL connects and all 45 expected tables exist after migrations 001–027. Setup data is in PostgreSQL. Column/constraint drift checks, migration locking, transactional migrations, and a proved restore exercise remain open. |
| Authentication and authorization | B+ | Production JWT secret fails closed, access/MFA token classes are separated, Ross Manor has a facility administrator, and a distinct ShorelineOps platform-admin claim/control plane exists. Full endpoint-level RBAC regression coverage is incomplete. |
| Clinical safety | B | NPO/allergen/IDDSI deterministic checks exist. Automated repair no longer invents Regular/Regular orders. Admissions containing diet orders require a manager or dietitian and preserve provenance. Live clinical validation and device workflow testing remain required. |
| Tenant isolation | D+ | User and facility administration are facility-scoped, and only Ross Manor may be activated. Most operational tables still lack `facility_id` and database row-level security. A second live tenant must not be enabled until data tables and queries are tenant-scoped. |
| Error handling and observability | B- | App error boundary, structured API errors, request IDs, explicit integration-disabled states, and real diagnostics replace fabricated healthy fallbacks. External error aggregation, alerting, and uptime monitoring are not configured. |
| Product and user flow | B- | Public marketing and demo are separated from the authenticated app. Admin now exposes platform, onboarding, diagnostics, backup, users, audit, and settings paths. Complete browser/device/accessibility coverage is still absent. |
| Integrations | D | EHR and billing fail closed when unconfigured, but PointClickCare live OAuth/FHIR, Stripe durable billing, distributor contract feeds, USDA production credentials, email delivery, and kitchen hardware have not been proven end to end. |
| Deployment | B pending live verification | API, demo, marketing, and PostgreSQL are separate Railway services. Static-service commands and public URLs are configured. This grade becomes final only after all three services deploy and the smoke test passes. |

**Controlled Ross Manor beta: 68/100. Shared multi-facility clinical SaaS: 45/100.**

## Material corrections completed

- Added migration 027 for facility ownership, platform administrators, facility lifecycle state, beta tier, and kitchen service mode.
- Added a ShorelineOps platform control plane for facility registration, activation gating, user assignment, and onboarding status.
- Scoped facility administrators to their own accounts and audit records.
- Added facility and platform claims to signed JWT access tokens and refresh flows.
- Replaced unsigned commercial license acceptance with HMAC verification on the API. Platform administrators receive server-authoritative enterprise access.
- Removed the active Supabase browser dependency and made production data-layer fallbacks fail visibly instead of silently saving divergent local data.
- Prevented the service worker from caching API/PHI responses.
- Protected direct timecard reads and punches with authentication while retaining a separately authenticated webhook path.
- Preserved NPO, fluid restriction, effective date, version, and provenance fields during resident admission.
- Removed fabricated healer outcomes and automatic clinical-order assignment.
- Added structured errors and request IDs; diagnostics no longer report a fake healthy state on failure.
- Updated Astro/Tailwind/Vite and patched runtime dependencies to a zero-vulnerability audit.
- Corrected CI so it builds the API and runs the actual complete test command.
- Reconciled environment and deployment documentation with Railway/PostgreSQL.

## Deployment environment contract

### API service

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `PLATFORM_OWNER_EMAIL=shadowwalkernc@gmail.com`
- `LICENSE_SIGNING_SECRET` with at least 32 characters
- `FRONTEND_URL` containing every allowed production app/demo origin

Required only when the integration is enabled:

- `EHR_WEBHOOK_SECRET`, PointClickCare OAuth/FHIR credentials
- Stripe secret and webhook keys
- USDA FoodData Central key
- SMTP/email provider credentials
- Kiosk/timeclock webhook secret

The setup bootstrap secret must be rotated or removed after setup. Secrets must stay in Railway and must not use a `VITE_` prefix.

### Public services

- Marketing serves the Astro static build at `/` and must remain public.
- Demo serves the explicit `VITE_DEMO_MODE=true` build and must remain public without an account.
- The production application serves at `/app/` and requires authentication.

## Release gates still open after the Ross Manor beta

1. Add `facility_id` to every PHI and operational table, backfill Ross Manor, scope every query, and enforce PostgreSQL RLS or an equally strong transaction-bound policy.
2. Make migrations transactional and single-runner safe; compare columns, types, constraints, indexes, and policies rather than table names alone.
3. Perform an encrypted backup export and a restore into a disposable PostgreSQL database; record recovery time and recovery point evidence.
4. Complete real PointClickCare, distributor, USDA, Stripe, notification, and supported hardware sandbox tests. Marketing must describe disabled integrations accurately until each passes.
5. Add Playwright coverage for public marketing, public demo, login/MFA, platform admin, facility admin, onboarding, resident admission, diet-order review, kitchen safety, backup, and failure states.
6. Run WCAG/mobile/device testing and split the main application bundle by route.
7. Add external error reporting, uptime checks, log retention, alert routing, and an incident runbook.
8. Conduct clinical validation with a registered dietitian and a supervised Ross Manor beta before relying on the system for meal-service decisions.

## Operating boundary

Ross Manor is the only facility authorized for active beta use under the current schema. Additional facilities may be registered in the control plane, but the application deliberately keeps them disabled until shared tenant isolation and facility provisioning are complete.

