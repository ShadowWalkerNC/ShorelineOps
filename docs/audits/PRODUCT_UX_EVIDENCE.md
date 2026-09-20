# Product, UX, and marketing evidence appendix

Date: 2026-09-20. Scope: static source inspection only; no browser, service startup, device, screen-reader, network, live integration, or customer verification performed by this reviewer. Verified means source behavior is visible, not that the end-to-end journey passed. No application code changed.

## Most consequential findings

| ID | Priority | Finding and confidence | Evidence | Acceptance and verification |
|---|---|---|---|---|
| UX-01 | P0 | Verified: resident writes catch any API error, then write the localStorage emulator and report normal completion. This includes rejected clinical writes, not just network loss. Likely: operator sees a saved diet while server/other tablet has different data. | `src/state/residentsStore.ts:108-201`; `src/lib/supabase.ts:303-339` | Rejected writes remain errors; deliberate offline edits display pending state and reconcile with server authority. Test 403/409/422/500/offline, reload and second device, including NPO changes. |
| UX-02 | P0 | Verified: non-2xx scanner responses fabricate VALID for profile version >=2, with a simulated label, but still play the success chime and invoke assembled tracking. Verification fetch reads obsolete localStorage auth while tracking uses tokenManager. Risk: a rejected verification can produce reassuring feedback and attempt an assembled record. Server acceptance not runtime proven here. | `src/features/kitchen/components/TrayAssemblyScanner.tsx:66-145`; `src/security/tokenManager.ts:1-26` | Use real token; all unavailable/rejected validation stays HOLD, never success audio or tracking; simulation strictly demo-only. Test 401/403/500 and stale ticket. |
| UX-03 | P0 | Verified: admin create-user, role updates, deactivation, audit loading and settings save use session memory in all modes. Production starts empty but operations still only mutate arrays. Administrative controls cannot administer server identities through this store. | `src/state/adminStore.ts:1-81`; `src/features/admin/components/UserManager.tsx:33-38` | Bind to authorized API or remove operational controls; deactivate a real account and verify subsequent request rejection; reload must preserve changes and audit. |
| UX-04 | P0 before public promotion | Verified: public claim “100% HIPAA & CMS-2567 Compliant,” availability guarantee and deterministic offline synchronization promises exist. Compliance and SLA proof unknown. Contradiction: offline queue has no callers in src. | `marketing/src/pages/index.astro:668`; `marketing/src/pages/terms.astro:144-147`; `marketing/src/pages/security.astro:155`; `src/lib/offlineQueue.ts:45-110` | Owner-approved claim register with supporting evidence; remove/qualify unsupported claims; legal review entity/BAA/terms before publication. |
| UX-05 | P1 | Verified: setup prepopulates administrator password, bootstrap secret, facility identity and BAA acceptance=true. These are operational values, not placeholders. | `src/features/setup/SetupWizardPage.tsx:25-38,68-109` | Production starts blank with explicit unchecked agreement; fresh credential entry required; record reviewed agreement version. Test clean setup. |
| UX-06 | P1 | Verified: offline queue storage primitives exist, but repository search for queueOfflineAction/getPendingOfflineActions/removeOfflineAction finds definitions only. Automatic replay is not implemented through this queue. Recipes also silently fall back to memory on failed API writes. | `src/lib/offlineQueue.ts:45-110`; `src/state/recipesStore.ts:26-70`; `TODO.md:39` | Either limit offline promise to read-only or implement visible durable pending/error/reconciliation semantics; reload offline write, reconnect, verify exactly once and cross-device. |
| UX-07 | P1 | Verified: backup export/restore fetch tokens from localStorage token/shoreline_jwt; actual tokenManager keeps access token in memory, refresh in sessionStorage. Likely authenticated backup UI requests fail. | `src/features/admin/components/BackupRecoveryPanel.tsx:45-47,85-87,117-119`; `src/security/tokenManager.ts:11-26` | Use common client; authenticated export + dry-run restore + restore in isolated test database. |
| UX-08 | P1 | Verified: mobile More sheet is div-based with no dialog semantics, focus trap, initial/return focus, or Escape handling. Shared controls default to 36px; small buttons 32px, below repository 44/48px requirement unless callers override. Runtime dimensions unmeasured. | `src/components/MobileMoreSheet.tsx:68-76`; `src/components/ui/button.tsx:19-23`; `src/components/ui/input.tsx:13` | Radix sheet/dialog behavior; keyboard and screen-reader audit; measure targets across resident/setup/admin forms at 320/390px. |
| UX-09 | P1 | Verified: named customer testimonials and quantified outcomes are published; authenticity/permission/provenance unknown, not proven fabricated. Legal pages name Shoreline Operations LLC while founder directs CulinaryOS LLC. | `marketing/src/pages/index.astro:539-616`; `marketing/src/pages/terms.astro:66`; `marketing/src/layouts/BaseLayout.astro:51-58,214` | Verify consent and underlying outcomes or remove; founder/legal confirm seller, DBA, support and data-controller identity. |
| UX-10 | P1 | Verified: marketing enterprise CTA points to /enterprise, absent from app route map; enterprise syndication store is a timed in-memory simulation. It is not evidence of a deployed multi-facility product. | `marketing/src/pages/distributors.astro:137`; `src/App.tsx:67-126`; `src/state/enterpriseStore.ts:142-174` | CTA targets a real page; postpone multi-facility claims until durable tenant isolation and propagation verified. |
| UX-11 | P2 | Verified: metadata, OG, JSON-LD exist; Astro has no configured site URL and default canonical uses Astro.url.href. No sitemap integration/robots.txt or analytics event SDK found in inspected marketing files. Canonical output must be checked in built site. | `marketing/src/layouts/BaseLayout.astro:20-23,87-100`; `marketing/astro.config.mjs:1-6` | Assert production absolute canonical, sitemap/robots, truthful schema; track non-PHI CTA/onboarding outcomes with documented privacy choices. |
| UX-12 | P1 | Verified: report initial fetch errors often only log console.error, leaving data empty/stale without actionable state. | `src/features/reporting/ReportingPage.tsx:65-113,138-172` | Display unavailable/error with retry, never interpret failure as zero incidents; test failures/empty responses distinctly. |

## Feature inventory (source-reviewed status)

All rows require runtime verification before Ship. Route evidence: `src/App.tsx:67-126`.

| Feature | Status | Evidence | Value / quality | Missing pieces | Launch recommendation |
|---|---|---|---|---|---|
| Dashboard by device | Partial | `src/features/dashboard/DashboardPage.tsx`; mobile/tablet component siblings | High; substantive interface | Validate aggregates/freshness and links | Internal test |
| Resident census/profile/import/diet review | Partial | `src/state/residentsStore.ts:73-201`; `src/features/residents/ResidentsPage.tsx`; `components/CensusImportModal.tsx` | High; save truth unsafe | UX-01, role/error/cross-device tests | Do not ship clinical use |
| EHR reconciliation | Partial / live unknown | `src/features/residents/EhrReconciliationQueue.tsx:56`; `ResidentsPage.tsx:204-210` | High; honest error empty path and FeatureGate exist | Real PCC credentials/data mapping/reconciliation verification | Beta only after safety validation |
| Menu cycle and item library | Partial | `src/state/menuStore.ts:96-228,234-359` | High; broad controls | API-error local fallback and persistence | Internal test |
| Recipe book/yield/nutrition | Partial | `src/state/recipesStore.ts:26-80`; `src/features/recipes/RecipeBookPage.tsx` | High; fallback may lose edits | Real nutrition/scaling validation, durable saves | Internal test |
| Production/signoff/hydration | Partial | `src/state/productionStore.ts:54-180`; `src/features/production/components/HydrationPass.tsx` | High; API plus local fallback | Failed-signoff truth, persistence, clinical validation | Internal test |
| Kitchen orders/sheets | Partial | `src/features/kitchen/OrderEntryPage.tsx:37-44,340`; `KitchenSheetPage.tsx` | High; clinical flags visible | Safety enforcement end-to-end, error/offline proof | Do not ship clinical use yet |
| Tray cards/QR/dispatch | Partial / flawed simulation | `src/features/kitchen/TrayCardGeneratorPage.tsx:255-259`; `components/TrayAssemblyScanner.tsx:112-145`; `src/features/traydispatch/TrayDispatchPage.tsx` | High; NPO banner exists | UX-02, real scan and dispatch reconciliation | Do not ship clinical use |
| HACCP/Bluetooth | Partial / hardware unknown | `src/features/kitchen/TempLogPanel.tsx`; `WebBluetoothProbe.ts` | High; actual device code exists | Physical device and stale/missing-reading validation | Beta only after validation |
| Inventory/par/waste | Partial | `src/features/inventory/InventoryPage.tsx`; `src/state/inventoryStore.ts` | High | Durable production data and reconciliation review | Internal test |
| Purchasing/catalog/import/MRP/matching | Partial / integration unknown | `src/features/purchasing/PurchasingPage.tsx`; `src/features/distributor/DistributorPortalPage.tsx:115-193` | High; substantive API-backed UI | Real vendor operations and entitlements verified end-to-end | Beta only |
| Reporting/CPD/binder | Partial | `src/features/reporting/ReportingPage.tsx:65-172`; `CmsSurveyBinderSection.tsx:115-312` | High; binder FeatureGate exists | UX-12; data provenance and financial/clinical accuracy | Internal test |
| Staff/timecard/scheduling/tasks | Partial | `src/features/staff/StaffPage.tsx`; `StaffProfilePage.tsx:216`; timecard/tasks feature folders | Medium; schedule placeholder documented | Real staff joins/permissions/payroll boundaries | Postpone non-core scope |
| Admin users/audit/settings | Mock in-memory | `src/state/adminStore.ts:1-81` | High need; misleading control behavior | UX-03 | Do not ship |
| Backup/recovery | Partial / likely broken UI auth | `src/features/admin/components/BackupRecoveryPanel.tsx:45-118` | High | UX-07 and isolated restore proof | Do not claim verified backup |
| License entry/feature gate | Partial | `src/features/admin/components/LicenseManagerPanel.tsx:160-178`; `src/components/FeatureGate.tsx` | Medium | Actual entitlement lifecycle/server enforcement | Internal test |
| Multi-facility syndication | Mock / no app route | `src/state/enterpriseStore.ts:142-174`; `src/App.tsx` | Unvalidated | Durable tenant-aware implementation | Do not ship/market |
| PWA/offline | Partial | `src/sw.ts:16-29,59-79`; `src/lib/offlineQueue.ts` | High operational value | Replay absent; stale clinical data/logout/cache boundaries need testing | Read-only boundaries until proven |
| Marketing/legal/pricing | Partial | `marketing/src/pages`; `BaseLayout.astro` | Clear senior-care category | Claims, entity, CTA, legal and SEO proof | Revise before public promotion |

## Journey inventory

| Journey | Classification | Evidence / reason |
|---|---|---|
| Visitor lands and understands proposition | Partially working (source only) | Homepage identifies senior care/healthcare dietary operations; live rendering not tested |
| Demo starts | Unknown runtime | DEMO_URL defaults to hosted /menu; clear sandbox CTA at `index.astro:44-50` |
| Self-service signup | Not implemented in frontend route map | Only /setup and /login auth entry routes, `App.tsx:67-69` |
| Email verification | Not implemented in inspected frontend | No verification route/form in App/Login |
| Create organization/admin | Partially working | Setup initialization POST exists; prefilled credential/consent issues, `SetupWizardPage.tsx:25-115` |
| First-time onboarding | Partially working | Facility/wings/admin/BAA wizard; no observed post-login first-value checklist |
| Login/MFA/logout | Unknown runtime; implemented paths | `LoginPage.tsx`; `tokenManager.ts`; logout in `MobileMoreSheet.tsx:39-43` |
| Password recovery | Not implemented in inspected frontend | No recovery route/link found in Login/App |
| First value: census → menu → batch sheet | Partially working | Routes and stores exist; silent local fallback prevents trustworthy proof |
| Primary service: orders → tray scan → dispatch | Partially working | Clinical presentation exists; UX-02 blocks safety claim |
| Save and return to data | Broken under API failure (static verified) | Resident emulator persists locally without server sync; recipe edits may be memory-only |
| Invite teammate / manage role | Mocked | Admin array mutation only; no invite delivery in this path |
| Begin trial / upgrade | Partially working | Pricing links demo/contact; license paste UI; no trial checkout route |
| Manage billing/cancel/reactivate | Not implemented in inspected frontend | No billing portal/checkout route; license state is not billing proof |
| Receive support | Partially working | `pricing.astro:116` mailto; mailbox operation and response process unknown |
| Export/restore | Unknown runtime, likely auth mismatch | Backup panel wrong token source |
| Delete account/facility data | Not implemented in inspected frontend | Entity deletes exist; no account/tenant deletion journey found |

## Grade suggestions

These are readiness judgments based on static evidence, not certification: Product clarity B (senior-care dietary focus strong); Customer value B hypothesis (high operational need, no verified discovery); UX/UI C (rich layouts, weak errors and misleading save states); Mobile C (five bottom tabs and kitchen enlarged targets exist, rendered sizing untested); Accessibility D (custom sheet semantics and undersized controls); Frontend D (mixed source-of-truth and auth clients); Privacy D pending cache/data retention validation; SaaS D (onboarding exists but account/team/billing paths incomplete); Billing F for self-service journey, contract invoicing unknown; Marketing D (clear audience with unsupported absolutes); Commercial/launch D, internal testing only.

Positive source evidence: bottom navigation includes Dashboard/Census/Kitchen/Tasks/More and safe-area padding (`Layout.tsx:555-611`); kitchen mode is a deliberate gloved-hand theme (`KitchenModeContext.tsx:1-12`); Radix dialog wrapper exists (`components/ui/dialog.tsx`); demo login credentials are gated by demo/dev (`LoginPage.tsx`); EHR failures deliberately avoid fake queue items (`EhrReconciliationQueue.tsx:56`). Preserve these while removing mismatches.

## Suggested scope and handoff

The evidence supports one initial product loop: a single-facility dietary manager imports/maintains a census, plans menus, prepares daily kitchen sheets, and records reviewed operational execution. Keep clinical meal service behind validated safety gates and supervised operational validation. Delay corporate syndication, plugin/CLI promotion, broad HR/payroll and automated commercial integration claims. Founder should choose legal seller identity and whether initial pilot excludes PHI; do not infer those decisions.

Checks performed: file inventory; source reads; rg route/store/auth/offline/demo/claim/analytics/SEO searches. No browser/runtime test results are claimed. Global inherited AGENTS path was not found at sibling `.github/AGENTS.md` in this subtask; parent handles global instruction discovery.
