# ShorelineOps control plane — bounded account slice (CP-01 / CP-02 / CP-12)

Central account service with its own PostgreSQL database. This slice covers
signup + email verification, login / opaque cookie sessions / logout /
password reset with session revocation, and the account audit log. It stores
no patient records and accepts no clinical staff JWTs.

Verified accounts may request Pro Cloud ($199/facility/month) or Enterprise
($399/facility/month). Requests require the owner's manual activation and
create no Railway resources. Community remains free and self-hosted.

**Not implemented here:** billing, Stripe, license issuance and automatic
Railway resource creation. Stripe is explicitly deferred.

## Layout

- `src/index.ts` — app boot, `/health`, `/ready`, static portal
- `src/routes/signup.ts` — CP-01 signup / verify / resend
- `src/routes/accountAuth.ts` — CP-02 login / logout / me / password reset
- `src/routes/portal.ts` — authenticated status (honest capability flags)
- `src/activation.ts` / `src/activate-cli.ts` — owner-only registration of checked, pre-created isolated customer resources
- `src/email/gmail.ts` — Gmail HTTPS OAuth2 adapter (no SMTP, no mail dep)
- `src/email/outbox.ts` — encrypted retryable outbox (AES-256-GCM)
- `src/security/` — tokens, sessions, CSRF guard, rate limits, audit
- `src/db/` + `migrations/` — pool, migrator, real PG schema
- `public/` — minimal accessible portal forms (44px targets, labelled inputs)
- `docs/GMAIL_OAUTH_SETUP.md` — sender authorization guide (no credentials)

## Environment (names only — set values in hosting, never in files)

| Name | Purpose |
|---|---|
| `CONTROL_DATABASE_URL` | Central control-plane PostgreSQL URL |
| `CONTROL_OUTBOX_ENC_KEY` | base64 32-byte AES key for outbox payloads |
| `CONTROL_PUBLIC_ORIGIN` | Canonical account-service origin, required HTTPS in production |
| `CONTROL_ALLOWED_ORIGINS` | Extra comma-separated CSRF origins (optional) |
| `CONTROL_COOKIE_SECURE` | Development cookie override; production always uses secure cookies |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_SENDER` | Gmail OAuth2 sender (all four required) |

| `CONTROL_TEST_DATABASE_URL` | Gated integration-test database (see below) |
| `PORT` | Listen port (default 3101) |

Portal status exposes the gate as `sender.configured` (configuration only, not a live delivery check).

## Run

```sh
npm ci --workspaces=false
npm run build      # tsc
npm run db:migrate # applies migrations/ to CONTROL_DATABASE_URL
npm start
```

Health: `GET /health` (no DB), `GET /ready` (DB check). Portal: `/`.
Startup applies migrations with a PostgreSQL advisory lock before listening.
The process dispatches due email every 15 seconds. Atomic 90-second leases
recover interrupted sends. Delivery is at least once, and account tokens are
single use. Successful delivery clears the encrypted outbox payload.

Build the service image from the repository root with
`docker build -f control-plane/Dockerfile -t shoreline-control-plane .`.
For Railway, use repository root as the build context and configuration path
`/control-plane/railway.json`. Give this service its own central PostgreSQL
database. Customer facility services and databases remain separate.
No cloud deployment has been performed as part of local validation.

## Manual cloud activation

After a verified customer requests a plan, the owner must separately create
a dedicated production application service and PostgreSQL service/database.
Use unique random JWT, database and first-run setup secrets for every customer.
Do not reuse the central account database or another facility's resources.
No signup endpoint performs these steps.

The owner can register those resources using the authenticated Railway CLI:
`node dist/activate-cli.js --activate metadata.json`. The JSON contains only
`email`, `plan` (`PRO_TIER` or `ENTERPRISE_TIER`), `projectId`, `environmentId`,
`appServiceId`, `databaseServiceId`, and the HTTPS `appOrigin` under
`*.up.railway.app`. No secrets belong in this file. The operator process needs
`CONTROL_DATABASE_URL` and `CONTROL_OUTBOX_ENC_KEY`. On Windows, an npm-installed
Railway CLI is detected under APPDATA; `CONTROL_RAILWAY_EXECUTABLE` can select
another native CLI executable.

Activation verifies provider identities, production configuration, the app's
private PostgreSQL connection against its database service, readiness, unique
service ownership and distinct secrets. It rejects unverified accounts,
unrequested plans, reuse and conflicting activation. No public activation
endpoint exists. The authenticated customer receives only their app link and
their encrypted-at-rest first-run setup key; portal responses prohibit caching.
Activation does not grant a paid software license or start billing. Hosted
provisioning and entitlement acceptance remain separate release gates.

## Tests

```sh
npm run build && npm test
```

Integration tests run ONLY when `CONTROL_TEST_DATABASE_URL` explicitly points
at a loopback host with a database name starting `shoreline_control_test_`;
otherwise the suite reports NOT RUN and touches nothing. Tests never send
mail, never write `.env`, and truncate only the allowlisted control tables.

## Honest gates

- Gmail sender unset → `emailStatus: 'unavailable'`, resend `503
  EMAIL_UNAVAILABLE`, portal `sender.configured: false`. Nothing fake-sent.
- Any `Authorization: Bearer …` credential → `401 CONTROL_SESSION_REQUIRED`.
