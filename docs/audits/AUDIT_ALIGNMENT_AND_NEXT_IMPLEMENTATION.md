# Audit alignment and next implementation

## Assessment boundary

The supplied **ForgeSatchel Repository Final-Build and Completeness Audit** describes a separate GitHub repository at an October 4, 2026 snapshot. Its remote inventory, protection settings and score are supplied evidence, not independently reverified here. This checkout is `ShadowWalkerNC/ShorelineOps`, HEAD `37b6899`, and was clean before this document. No local `C:\Users\white\Documents\GitHub\ForgeSatchel` checkout was found at the inspected location.

Do not import ShorelineOps into ForgeSatchel, change remotes, merge histories or introduce a Rust/Muse runtime until the intended relationship between the two products is established. That product decision does not prevent completing this alignment and ShorelineOps implementation sequence.

## Alignment

| Audit recommendation | ShorelineOps evidence and disposition |
|---|---|
| Establish authoritative source | Already present here: React client, Express server, Astro marketing and Git history. ForgeSatchel source recovery cannot be inferred from this checkout. |
| Assemble a workspace | `package.json` already declares `server` and `marketing` npm workspaces. Extend existing boundaries only when necessary; no directory migration merely to match a proposed layout. |
| Reproducible build and tests | Root scripts and `.github/workflows/ci.yml` exist. Prior local acceptance recorded 228 system checks plus 160 automated tests. A clean-checkout CI result and hosted acceptance remain separate evidence. |
| Rust integration | Conditional, not a completeness requirement for this product. Keep TypeScript/Node; require measurements or a hardware requirement before adding Rust. |
| Muse integration | Muse CLI has been used as development tooling. A shipped SDK is not established as a product requirement. Do not expose clinical data or production authority to development agents. |
| Release provenance | Record commit, successful CI, artifact checksums, acceptance results and rollback procedure before release. An annotated tag alone does not prove correctness. |
| Final-build judgment | Agree that source/build/tests are not production certification. Reject projected 35/55/100 completeness scores as acceptance evidence. |

## Locked architecture

Reuse the existing TypeScript/React/Node workspace. Marketing `/`, sandbox `/demo/` and authenticated application `/app/` remain separate. One facility per database; LAN operation requires the authoritative server. Disconnected clients cannot authorize trays or report unsaved clinical work as completed. Preserve NPO/allergen blocks, clinical capability allowlists, EHR approval boundaries and purchasing authorization. Keep AI development tooling outside deterministic clinical decisions.

## Remaining engineering sequence

| Order | Severity | Work and source scope | Acceptance before completion |
|---|---|---|---|
| 1 | High | Clean-checkout CI and disposable PostgreSQL acceptance: existing workflow, test runner and DB/clinical integration tests. Reuse current scripts; pin supported runtime and isolate test database credentials. | Fresh install/build/typecheck/test succeeds. PostgreSQL migrations, reporting, concurrent EHR updates and tray checks preserve authorization and atomicity. No production database used. |
| 2 | High | Complete encrypted backup/recovery design using current backup scripts and deployment docs. Choose deployment-supported encryption/key custody before implementation. | Restore a complete disposable DB; verify clinical/audit provenance, wrong-key failure and failure-safe publication/rotation. Measure and document RPO/RTO. No partial clinical restore enabled. |
| 3 | Medium | Production desktop lifecycle in `electron-main.js` and existing installer. Replace development server launch with compiled backend; validate packaged resource paths, readiness and shutdown. | Packaged app runs without Vite/dev tooling; unavailable backend stays honest; no orphan process; application routes and login work. Start with current Windows target, then prove each additional OS separately. |
| 4 | Medium | Replace or remove the placeholder kitchen WebSocket handshake in `server/src/index.ts`, according to actual callers. Prefer existing HTTP behavior if push is not required. | Invalid/unauthorized upgrade rejected; implemented protocol tested for reconnect, disconnect and permission changes. No pretend live stream. |
| 5 | Medium | Meal-rush load and replica behavior: rate limits, DB access, idempotency middleware and frontend bundle. Measure before changing architecture. | Agreed latency/load targets measured using synthetic facility workloads. Process-local replay limitation documented; durable idempotency required before multiple API replicas. Split bundles only where profiling supports it. |
| 6 | High release gate | Device, responsive/accessibility and hosted acceptance of the exact release candidate. | Printer/scanner real-device results; keyboard and screen-reader workflows; marketing/demo/app deep-link and reload checks; readiness/TLS/session checks; rollback rehearsal. |

## Ownership and implementation gate

- Codex owns source integration, deterministic/security review and acceptance evidence.
- Muse may receive bounded edits or test work when available; inspect its artifacts independently. It is not a prerequisite for clinical runtime operation.
- Security/DB reviewer and packaging/UX reviewer work on independent areas; avoid shared-file or build-output races.
- Begin with order 1 after confirming the product/repository target. Do not simultaneously restructure folders, add Rust and ship a Muse SDK.
- Infrastructure key management, product identity and device targets are decisions; retrieve existing deployment evidence before asking for missing business choices.

## Validation of this reconciliation

Inspected current remote, HEAD, workspace manifest, CI file, desktop launch source, WebSocket upgrade source, idempotency middleware and backup scripts. Compared them with the existing remediation handoff and design adoption record. No application code or infrastructure changed; prior test counts are historical local evidence, not a newly executed suite. This document is the completed planning handoff; remaining acceptance gates are not complete.
