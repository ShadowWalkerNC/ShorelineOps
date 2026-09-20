# CulinaryOS readiness audit — 2026-09-20

**Decision: internal testing with synthetic records only.** No release candidate has been designated; no release gate report or production approval is issued.

## Requested deliverables

1. [Repository intelligence report](CULINARYOS_REPOSITORY_INTELLIGENCE_REPORT.md) — architecture, capabilities, journeys, issues and readiness grades.
2. [Multidisciplinary review](CULINARYOS_MULTIDISCIPLINARY_REVIEW.md) — all40 council perspectives, reconciled priorities and launch recommendation.
3. [Product and GTM plan](CULINARYOS_PRODUCT_AND_GTM_PLAN.md) — segment, alternatives, pricing hypotheses, website, analytics and founder decisions.
4. [Execution roadmap](CULINARYOS_EXECUTION_ROADMAP.md) — milestones0–7, accountable tasks, acceptance criteria and first proposed batch.
5. [Release test matrix](CULINARYOS_RELEASE_TEST_MATRIX.md) — executed evidence separated from source failures and tests not run.

Supporting source reviews: [Security/data](SECURITY_DATA_EVIDENCE.md), [Product/UX](PRODUCT_UX_EVIDENCE.md). Their static-only statements describe those subreviews; runtime results belong to the main report and matrix. The main report adds the healer, deployment, CI, package and generated-metadata findings.

## Verification record

Inspected source baseline: `409c752`. During the resumed audit, HEAD was observed at `7af36ac` (9/20), with earlier audit files tracked there; this audit did not create that commit. Findings describe the inspected source; later application edits require revalidation. Environment: Windows, Node24.21.0, npm11.19.0, existing installed dependencies. No clean-install or Node20 parity claim.

| Command or probe | Recorded outcome | Artifact |
|---|---|---|
| npm run build:demo | Pass after sandbox-access retry; mainJS1980.72kB minified/359.13kB gzip; precache3303.58KiB | build-demo.log |
| npm run build:marketing | Pass after sandbox-access retry;7 static pages | build-marketing.log |
| npm --prefix server run build | Pass | build-server.log |
| npm run lint | Pass; frontend/server compiler checks only | lint.log |
| npm test | 228 passed,0 failed; empty DATABASE_URL and unique temporary SQLITE_PATH; NODE_ENV=test | system-test.log |
| Isolated server HTTP smoke | health200, setup/status200, anonymous residents401 | runtime-probe.log / runtime-probe.cjs |
| MFA-pending token contract | **Fail**: requireAuth called next for signed mfa_verify-purpose token; expected rejection | runtime-probe.log / runtime-probe.cjs |
| npm audit --omit=dev --json | Gate fail;11 flagged packages:1 critical,5 high,5 moderate; exploitability not determined | dependency-audit.json |
| Generated homepage canonical/og:url | Fail public metadata expectation: http://localhost:4321/ | marketing/dist/index.html; BaseLayout.astro |
| CI step inspection | Server build step has neither run nor uses | .github/workflows/ci.yml |

Original build attempts failed on sandbox filesystem restrictions, not compilation. Approved retries succeeded. The initial advisory request failed on sandbox network access; approved retry returned the recorded findings. No package upgrades were performed. Raw .log artifacts are locally available but gitignored; this Markdown summary preserves outcomes in a normally tracked format. Audit package findings count vulnerable package nodes, not distinct proven exploitable vulnerabilities.

Browser/device/assistive-technology QA, PostgreSQL parity, production-like Docker/cloud deployment, clean setup/login journeys, full recovery, customer interviews and live billing/provider validation remain unperformed. The isolated runtime child was stopped; disposable synthetic databases remain under the OS temporary directory. No production database or service account was used.

## Environment contract discovered

Names only; no secret values are reproduced. This is inventory, not a configuration change or endorsement of defaults.

| Variable | Evidence / intended use | Audit note |
|---|---|---|
| PORT, NODE_ENV | server/src/index.ts | Production mode is not sufficient to stop current demo seeding |
| JWT_SECRET | requireAuth.ts, auth.ts, index.ts | Require stable strong production secret; startup behavior inconsistent |
| JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN_DAYS, MFA_ISSUER | routes/auth.ts | Document token/refresh policy and MFA issuer |
| DATABASE_URL, SQLITE_PATH | db/pool.ts | Select supported backend; explicitly isolate test DB |
| DATABASE_SSL_REJECT_UNAUTHORIZED | db/pool.ts | Current default disables certificate verification |
| SETUP_BOOTSTRAP_SECRET | routes/setup.ts | Production setup requirement absent from main example inventory |
| FRONTEND_URL | index.ts | CORS default5173 differs from Vite dev5180 |
| VITE_API_URL | src/api/client.ts, auth.ts, tokenManager.ts | Client expects API base including /api; example/Render omits it |
| VITE_DEMO_MODE / DEMO_MODE | client stores/auth vs server requireTier.ts | Distinct client/server flags; specify deliberate modes separately |
| VITE_SESSION_TIMEOUT_MS | AuthContext.ts/useSessionTimeout.ts | Actual default15min differs from documentation10min |
| SHORELINE_LICENSE_KEY / VITE_SHORELINE_LICENSE_KEY | requireTier.ts / license.ts | Never place signing secrets in Vite variables; current verification inadequate |
| PCC_CLIENT_ID, PCC_CLIENT_SECRET, PCC_FACILITY_ID | integrations/pointclickcare.ts | Presence is not proof of live exchange; example omits facility ID |
| EHR_WEBHOOK_SECRET | routes/ehr.ts | External signed webhook boundary; actual provider configuration Unknown |
| USDA_FDC_API_KEY | integrations/usda.ts:129 | Code differs from example USDA_API_KEY; fix contract before claiming live data |
| STRIPE_WEBHOOK_SECRET | routes/billing.ts | Signature implementation exists; lifecycle not durable |
| STRIPE_SECRET_KEY | .env.example | Listed, not proof of active checkout integration |
| FACILITY_ID, FACILITY_SEGMENT | hardware/config modules | Caller/config facility identifiers do not establish tenancy |
| ENABLE_TIMECARD_PLUGIN, KIOSK_API_SECRET, AOD_KIOSK_URL/AOD_KIOSK_IDENTIFIER/AOD_TZ | index.ts/routes/timecard.ts | Optional module should remain out of MVP unless validated |
| PUBLIC_DEMO_URL | marketing layout/pages | Confirm intended app link; published route claims need link tests |

## Approval handoff

Please approve or revise the first repair batch: **separate demo seeding from production bootstrap and reject MFA-pending tokens at normal API boundaries**, with focused regressions and required builds/tests. Expected files, risks, acceptance and rollback constraints are in the roadmap's “Recommended first implementation batch.”

Approval is requested because section9 of the attached request explicitly says to stop after the audit before major changes, including authentication. Application, environment, infrastructure, billing and schema changes have not been made. Approval for this batch would not authorize production deployment, data deletion, shared SaaS or live payments.
