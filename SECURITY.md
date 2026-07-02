# Security & Compliance

Shoreline is designed to meet the requirements of **HIPAA**, **SOC 2 Type II**, and **ISO 27002**.

## Implemented Controls

| Control | Standard | Implementation |
|---|---|---|
| Encryption in transit (TLS 1.2+) | HIPAA, SOC2, ISO | Enforced by Render (HTTPS only) + HSTS header |
| HTTP security headers | SOC2, ISO | `public/_headers` — CSP, HSTS, X-Frame-Options, etc. |
| Session auto-logout (15 min) | HIPAA §164.312(a)(2)(iii) | `useSessionTimeout` hook |
| Audit logging | HIPAA §164.312(b), SOC2 CC7 | `auditLog` utility → POST `/api/audit` |
| Input sanitization / XSS prevention | SOC2, ISO 27002 8.28 | `sanitize.ts` utility |
| Role-based access control (RBAC) | HIPAA minimum necessary, SOC2 CC6.3 | `RequireRole` component + `UserRole` type |
| No PHI in localStorage | HIPAA | `secureStorage` guard in `sanitize.ts` |
| Auth context with MFA-ready scaffold | HIPAA, SOC2 | `AuthContext.tsx` |

## Pending (requires backend)

- [ ] JWT short-lived tokens (15–60 min) + refresh token rotation
- [ ] MFA enforcement (TOTP / SMS)
- [ ] Audit log persistence (append-only, 6-year retention)
- [ ] Database encryption at rest (AES-256)
- [ ] Penetration testing (annual — SOC 2 / ISO requirement)
- [ ] BAA signed with Render and all PHI-touching vendors
- [ ] Written policies: Privacy Policy, Incident Response Plan, Access Control Policy
- [ ] Vulnerability scanning in CI (Dependabot / Snyk)

## Dependency Vulnerabilities

Run `npm audit` and resolve all high/critical findings before handling real PHI.
Current known: 1 moderate, 1 high — must be resolved before production PHI use.

## Reporting a Vulnerability

Please email security@shoreline.app (do not open a public GitHub issue).
