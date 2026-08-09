# Security & Compliance

Shoreline is designed to meet the requirements of **HIPAA**, **SOC 2 Type II**, and **ISO 27002**.

## Implemented Controls

| Control | Standard | Implementation |
|---|---|---|
| Encryption in transit (TLS 1.2+) | HIPAA, SOC2, ISO | Hosting HTTPS + HSTS (`public/_headers`) |
| HTTP security headers | SOC2, ISO | `public/_headers` — CSP, HSTS, X-Frame-Options, etc. |
| Session auto-logout (15 min default) | HIPAA §164.312(a)(2)(iii) | `AuthContext` idle timer (`VITE_SESSION_TIMEOUT_MS`) |
| Audit logging | HIPAA §164.312(b), SOC2 CC7 | Authenticated `POST /api/audit` — actor from JWT only |
| Input sanitization / XSS prevention | SOC2, ISO 27002 8.28 | `sanitize.ts` + safe quantity parsing (no `eval`) |
| Role-based access control (RBAC) | HIPAA minimum necessary, SOC2 CC6.3 | JWT `role` claim + `requireRole` + frontend `RequireRole` |
| No PHI in localStorage | HIPAA | Tokens in memory / sessionStorage refresh only |
| Setup bootstrap lock | SOC2 CC6 | `SETUP_BOOTSTRAP_SECRET` required for `/api/setup/initialize` |
| Kiosk webhook auth | SOC2 CC6 | `KIOSK_API_SECRET` required for `/api/timecard/webhook` |
| MFA (TOTP) | HIPAA, SOC2 | Login challenge + forced enrollment when `mfa_required`; `/api/auth/mfa/*` |
| Role-aware Supabase RLS | HIPAA minimum necessary | `profiles` + `role_at_least()` policies in `supabase/schema.sql` |
| Open-redirect mitigation | SOC2 | `safeRedirectPath` for post-login navigation |
| Dependency scanning | SOC2 | Dependabot + `.github/workflows/security-audit.yml` |

## Demo mode

Set `VITE_DEMO_MODE=true` only for non-PHI demos. Production / PHI deployments must leave this unset or `false` and use the Express JWT API.

## Pending

- [ ] SMS/email MFA fallback (TOTP is implemented)
- [ ] Audit log retention automation (6-year)
- [ ] Penetration testing (annual)
- [ ] BAA signed with all PHI-touching vendors
- [ ] React 19 + React Router 8 (clears remaining RSC-mode advisory; N/A to this Vite SPA today)
- [ ] Vite 7+/8 major bump (dev-server esbuild advisory)

## Dependency Vulnerabilities

Run `npm audit` in `/` and `/server` and resolve high/critical findings before handling real PHI.

## Reporting a Vulnerability

Please email security@shoreline.app (do not open a public GitHub issue).
