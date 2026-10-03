# ShorelineOps remediation handoff — 2026-10-01

Status: bounded remediation implemented and locally verified; final verification completed 2026-10-02. Muse CLI performed application/configuration edits; Codex coordinated, independently reviewed and ran acceptance checks. No commits, pushes, deployments, real database access or PHI access performed. The pre-existing `public/brand/` work remains intact.

## Mission and architecture decision

ShorelineOps is an authoritative clinical nutrition operations system: reviewed resident orders inform menus, procurement, production, signed tray delivery and audit records. Browser/PWA, CLI and future packaged desktop clients must share the same server-side safety and authorization contracts. Support one facility per database; facility-LAN operation requires a reachable server. Disconnected clients cannot authorize clinical actions.

Keep TypeScript/Node. No measured CPU bottleneck justifies a Rust rewrite. Consider Rust for a bounded hardware agent or proven CPU hotspot after correctness, deployment and device acceptance. A language change would not resolve missing authorization, incorrect queries or incomplete recovery.

## Findings and disposition

| Severity | Confirmed issue or acceptance gap | Remediation / remaining solution |
|---|---|---|
| Critical | Cached successful mutations replayed before authentication | Authenticate and authorize before replay; bind keys to user, role, facility, route/query and body; exclude credential flows. |
| High | Resident and clinical report access lacked explicit role boundaries | Capability allowlists; full clinical records restricted; service readers receive limited projections; deny vendor access. |
| High | Rank-based checks admitted unrelated clinical writers | Preserve strict dietitian/manager clinical writes and dietitian/admin EHR approvals; deny admin clinical CSV bypass. |
| High | Read-only users could generate signed clinical cards; legacy printing guessed fluid texture | Require write/print capability; disable legacy printer endpoint until it shares the validated signed contract. |
| High | Reporting used obsolete schema; repeated SQLite placeholders misbound values | Use canonical resident/production schema and numbered SQLite parameter binding; verify meaningful synthetic records. |
| High | Database TLS and deployment configuration were permissive | Verify remote certificates by default, reject unsafe plaintext/ambiguous hosts, require secrets, keep PostgreSQL private and probe readiness. |
| High | Partial restore could overwrite clinical data without complete provenance | Disable partial restore; allow inspection only; require controlled complete database recovery. |
| High acceptance gap | Encrypted backups and isolated restore are unproven | Backup scripts fail closed and restrict artifacts; encryption, verified restore and measured RPO/RTO remain release gates. |
| High acceptance gap | SQLite tests do not establish PostgreSQL concurrency correctness | Run disposable PostgreSQL migrations/reporting and concurrent clinical/EHR/scan acceptance before clinical release. |
| Medium | Desktop packaging starts a development backend; WebSocket is a placeholder | Separate acceptance work: compiled production backend/lifecycle and authenticated protocol implementation or removal. |
| Medium | IP limits can throttle a shared facility; replay cache is process-local | Measure meal-rush load; use appropriate user/endpoint limits and durable operation semantics before multiple API replicas. |
| Medium risk | Build emits an approximately 1.67 MB minified application bundle | Add route/module code splitting after tablet/network measurements; current build warning is evidence of size, not a measured latency failure. |

## Verification

- PASS: `npm run typecheck`.
- PASS: `npm run build:demo` (marketing, demo and production app assets).
- PASS: `npm run build:marketing`.
- PASS: `npm test` — 228 system checks and 99 additional automated tests; zero failures, cancellations or skips. This includes server compilation, existing NPO/allergen/stale-tray/EHR/purchasing regressions and the new remediation suites.
- PASS: real HTTP focused security/replay/reporting suites — 22 tests. Authentication/recovery focused suites — 12 tests. Counts overlap the full suite and must not be added to it.
- PASS: independent read-only security and deployment review. Review findings were corrected and then verified, including response replay types, signed-card authorization, admin CSV bypass, substitution PHI, finance-detail access, TLS host edge cases and backup command safety.
- PASS: `git diff --check`.
- Tests exercise synthetic databases, installed pg configuration parsing (without a connection), structural manifests and fake backup processes. The test runner excludes the separate `compliance.test.js` harness; passing tests are not compliance certification.
- NOT RUN: real PostgreSQL server/certificate/concurrency, container execution, encrypted restore, printer/scanner, packaged desktop, production, accessibility and meal-rush/load acceptance.

## Operational limitations

Backup artifacts remain plaintext; restrictive file permissions do not supply encryption. HTTPS termination must be configured separately. Do not use a shared database for multiple facilities. Process-local replay is not a durable cross-replica exactly-once guarantee. JWT authorization changes are not immediate account revocation. Simulation endpoints must retain explicit simulation labels. Source inspection and local tests do not certify production readiness.

Detailed finance reads are manager/admin-only; full substitution records are admin/manager/dietitian-only. Operational readers retain aggregate reports and necessary resident service projections. Existing frontend affordances may still advertise actions that the API now denies; align role-specific UI during the next client acceptance pass. Unsafe legacy hardware printing returns `503 HARDWARE_PRINT_UNAVAILABLE`; partial application restore returns `503 RECOVERY_UNAVAILABLE` and dry-run is inspection only.

The build regenerated compiled server output. Generated client service-worker-only changes were removed; source and unrelated brand work were preserved. Muse also reported pre-existing OpenAPI documentation drift, which was left outside this remediation. See [architecture assessment](ARCHITECTURE_REASSESSMENT_2026-09-30.md), [approved plan](REMEDIATION_PLAN_2026-09-30.md) and [deployment implementation](DEPLOYMENT_IMPLEMENTATION_2026-10-01.md) for detailed scope and evidence.
