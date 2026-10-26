# ShorelineOps Care OS v5.0 — Handoff & Roadmap Notes

> **Date:** October 26, 2026  
> **Status:** Production-Ready Core / SaaS Scale  
> **Repository:** `ShadowWalkerNC/ShorelineOps` (`main`)  
> **Authors:** Antigravity AI Orchestrator & Muse Code AI Specialist  

---

## 1. What Was Done

### A. Clinical Safety & IDDSI 2.0 Dysphagia Standards
- **First-Class Liquid Consistency & Fluid Provenance (Migration 031)**:
  - Added versioned `liquid_consistency` (IDDSI Levels 0–4: Thin, Slightly Thick, Mildly Thick, Moderately Thick, Extremely Thick) and `fluid_restriction_ml` tracking columns to `residents` and `resident_diet_history`.
  - Modification of any liquid consistency, food texture, fluid limit, or allergen list atomically increments `diet_order_version`.
  - Integrated `IDDSI_LIQUID_CONSISTENCY_MISMATCH` safety checks into `server/src/engine/traySafety.ts`, ensuring thin-liquid aspiration hazards trigger non-overridable meal delivery holds.
- **Deterministic Clinical Hard-Blocks**:
  - Unassigned food textures (`level: -1`) and NPO orders strictly block tray assembly and batch cook worksheets.
  - Active allergen intersections are calculated deterministically across recipe bills of materials with zero override.

### B. Security, Authorization & Tenant Isolation
- **PostgreSQL Row-Level Security (Migration 032)**:
  - Enabled `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` with `tenant_isolation_policy` across 17 clinical and operational tables (`residents`, `resident_diet_history`, `ehr_reconciliation_queue`, `tray_events`, `tray_temperature_logs`, `temperature_logs`, `recipes`, `menu_items`, `vendors`, `purchase_orders`, `inventory_items`, `substitutions`, `tasks`, `time_entries`, `staff_schedules`, `users`, `audit_log`).
  - Added query translation in `server/src/db/pool.ts` to strip PostgreSQL-only RLS DDL in local SQLite mode without schema divergence.
- **Fine-Grained Semantic Capability Matrix (`server/src/middleware/permissions.ts`)**:
  - Replaced coarse linear role checks with a 10-role × 8-capability matrix (`requireCapability`), preventing culinary managers from performing clinical dietitian actions (`clinical:write`, `ehr:triage`) and vice versa.
- **Authentication & Revocation**:
  - Standardized UI bearer token reads via `tokenManager.getAccessToken()`.
  - Enforced atomic session revocation using persisted SHA-256 tokens and user `auth_version`.
- **Dependency Security**:
  - Patched 13 upstream npm advisories via `npm audit fix` (`body-parser`, `proxy-addr`, `vite`, `fast-uri`, `shell-quote`, etc.).
  - Confirmed `braces@3.0.3` resolution across dependencies.

### C. Native iOS Companion Application (`ios/ShorelineOps`)
- **Scaffolding via `xtool` 1.22.2 + Swift 6.1**:
  - Scaffolded native SwiftPM project (`ios/ShorelineOps`) configured with bundle ID `com.shorelineops.careos` for cross-compilation from Windows/WSL2 and Linux without macOS/Xcode.
- **Jakob's Law 5-Tab Navigation**:
  - Standard sticky bottom tab bar (`Dashboard`, `Residents`, `Menu`, `Kitchen`, `More`) with tactile $\ge 44\text{pt}$ touch targets.
  - Bedside signed tray verification scanner (`DeterministicTraySafetyEngine`) detecting NPO hard-blocks, unassigned textures, allergen conflicts, IDDSI liquid mismatches, and stale ticket versions.
  - HACCP CCP temperature logger enforcing corrective action documentation on out-of-range temperatures.
- **Swift Testing Suite**:
  - Added `ClinicalSafetyTests.swift` passing 4/4 tests in 0.004s on Swift 6.1.

### D. Operations & Simulation Verification
- **24-Hour Stress Simulation (`scripts/daily_operations_full_simulation.js`)**:
  - Executed full 24-hour shift simulation (05:00–21:30) via Muse CLI.
  - Verified 11/11 injected real-world kitchen mistakes, equipment failures, and clinical hazards resolved fail-closed with 100% integrity. Documented in `docs/DAILY_OPERATIONS_AUDIT.md`.
- **CLI & Marketing Cleanup**:
  - Replaced placeholder `@shoreline/cli` copy on the marketing site with runnable `npm run cli -- <command>` and `npm link` instructions.
  - Removed deprecated `culinaryos` CLI alias from `bin/shoreline.js` and `package-lock.json`.

---

## 2. What's Left to Do (Deployment & Facility Readiness Gates)

The core application code is functionally complete and passes all automated tests. The remaining items represent operational, hardware, and deployment-specific facility gates before live resident rollout:

### 1. Physical Device & Mobile Deployment
- [ ] **Physical iOS Hardware Testing**: Connect physical iPhone/iPad devices via USB (`usbmuxd` in WSL2) and execute `xtool dev` / `xtool install` with Apple Developer credentials (`xtool auth`).
- [ ] **Kiosk Hardware Testing**: Validate tactile response of Bluetooth LE temperature probes (Cooper-Atkins / BlueTherm) in high-moisture kitchen environments.

### 2. Live Cloud & External Service Connectivity
- [ ] **Spark SDK Live Verification**: Verify live endpoint connectivity using an authorized `MODEL_API_KEY` with synthetic-only patient data.
- [ ] **PointClickCare Live Partner Sandbox**: Execute OAuth 2-way sync verification with PCC staging tenant prior to facility go-live.
- [ ] **Dennis & Sysco EDI SFTP Testing**: Test scheduled EDI 850 PO transmission and EDI 810 invoice ingestion with live distributor SFTP test accounts.

### 3. Disaster Recovery & Infrastructure Acceptance
- [ ] **Off-Host Backup & Restore Drill**: Run an automated restore from an encrypted PostgreSQL 16 backup to an isolated staging host, verifying RTO and RPO against facility SLAs.
- [ ] **Multi-Replica Load Testing**: Execute concurrent user load simulation (k6 / Artillery) across multi-facility tenant routing with active Row-Level Security.

### 4. Facility Regulatory & Clinical Sign-Off
- [ ] **Independent RD Recipe Review**: Complete formal clinical evidence review for all 4-week cycle menu recipes before removing pre-seeded demo notices.
- [ ] **Facility Survey Binder Audit**: Run `shoreline survey cms-binder` with the facility's Certified Dietary Manager to verify state-specific Appendix PP crosswalks.

---

## 3. Key Verification Commands

```bash
# Run full server integration & desktop runtime test suite (192 tests)
npm test

# Run native iOS Swift 6.1 unit test suite
cd ios/ShorelineOps && wsl -d Ubuntu -- bash -lc "swift test"

# Run 24-hour operations stress simulation
node scripts/daily_operations_full_simulation.js

# Build production marketing and demo distribution
npm run build:demo && npm run build:marketing

# Run CLI diagnostic doctor
node bin/shoreline.js doctor
```
