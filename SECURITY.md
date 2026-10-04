# Security Controls & Deployment Responsibilities

ShorelineOps provides application controls that support facility security procedures. This document is not a HIPAA compliance determination, SOC 2 report, ISO certification, or service-level agreement. Confirm applicable privacy agreements and validate the chosen hosting environment before handling resident information.

Clinical deployments currently require one facility per application deployment and database. Facility identifiers and roles do not establish isolation within a shared clinical database.

## Controls Present in Source

These entries identify implementation locations, not certification or completed hosted acceptance. Test configuration, permissions, device behavior, and recovery in the deployed environment.

| Control | Scope | Implementation |
|---|---|---|
| HTTPS and HSTS | Hosting configuration | Hosting terminates TLS; static header declarations in `public/_headers` require host support and live verification |
| HTTP security headers | API and static hosting | Express Helmet and static `_headers` declarations; validate actual responses |
| Session auto-logout (15 min default) | Browser idle behavior | `AuthContext` idle timer (`VITE_SESSION_TIMEOUT_MS`); test actual shared devices |
| Audit logging | Protected decisions and submitted events | Authenticated `POST /api/audit` actor comes from JWT; retention and tamper resistance require separate validation |
| Input sanitization / XSS prevention | Input and rendering boundaries | `sanitize.ts` and safe quantity parsing; this is not a claim that all injection paths are independently audited |
| Role-based access control | Protected server actions | JWT role/capabilities, `requireRole`, permission middleware, and frontend visibility guards |
| Authentication | Passwords and access tokens | bcrypt password hashing and signed JWTs; refresh tokens use sessionStorage |
| Setup bootstrap lock | Production initialization | `SETUP_BOOTSTRAP_SECRET` required for `/api/setup/initialize`; development has an explicit fallback |
| Kiosk webhook auth | Shared-secret boundary | `KIOSK_API_SECRET` required for `/api/timecard/webhook` |
| MFA (TOTP) | Configurable authentication | Login challenge and forced enrollment when `mfa_required`; `/api/auth/mfa/*` |
| Open-redirect mitigation | Login navigation | `safeRedirectPath` for post-login navigation |
| Dependency scanning | Repository automation | Dependabot configuration and `.github/workflows/security-audit.yml`; inspect current run results |

Do not treat browser storage behavior as a blanket guarantee that no resident information can persist locally. Review each state store, download, printout, and device policy for the approved installation. Database/backup encryption, key custody, audit retention, and off-host recovery are deployment responsibilities and require acceptance evidence.

## Demo mode

Set `VITE_DEMO_MODE=true` only for non-PHI demos. Production / PHI deployments must leave this unset or `false` and use the Express JWT API.

## Pending

- [ ] SMS/email MFA fallback (TOTP is implemented)
- [ ] Audit log retention automation (6-year)
- [ ] Penetration testing (annual)
- [ ] BAA signed with all PHI-touching vendors
- [ ] Independent application and dependency review against current installed versions (the frontend currently uses React 18 and Vite 8)
- [ ] Deployed encryption/key custody and isolated full-database restore acceptance
- [ ] Shared-device session, physical hardware, and applicable provider acceptance

## Dependency Vulnerabilities

Run `npm audit` in `/` and `/server` and resolve high/critical findings before handling real PHI.

## Reporting a Vulnerability

Please email security@shoreline.app (do not open a public GitHub issue).
