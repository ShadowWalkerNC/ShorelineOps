# ShorelineOps — Full Technical & Product Audit

**Audit date:** 2026-10-09  
**Repository:** `ShadowWalkerNC/ShorelineOps`  
**Audited branch:** `main`  
**Audited head:** `e2099f518ed6360ccb98bf47a10edbc9b20a59f2` (`docs: clarify ShorelineOps platform positioning`)  
**Audit mode:** Read-only application audit; this file is the only repository change produced by the audit.  
**Overall maturity:** **Advanced alpha / internal-pilot candidate**  
**Current overall score:** **61 / 100**  
**Potential score after recommended remediation:** **88 / 100**

> **Important scope note:** This audit is based on direct source inspection of the repository, GitHub-hosted build/test/security evidence, configuration, migrations, routes, frontend flows, adapters, documentation, and existing acceptance artifacts. It did not connect to a real resident census, live EHR, live distributor, live Bluetooth probe, live printer, or production facility. Passing tests are treated as evidence of the behavior those tests cover—not proof of production readiness or regulatory compliance.

---

## Evidence labels used in this report

- **VERIFIED** — directly supported by inspected implementation, configuration, or current executed CI evidence.
- **PARTIAL** — meaningful implementation exists, but important parts are incomplete, weakly validated, or disconnected.
- **UNVERIFIED** — a claim may be plausible, but this audit found insufficient execution evidence.
- **RISK** — design or operational condition that could create failure even if no current bug is proven.
- **BUG** — implementation inconsistency with a concrete failure path.
- **CLINICAL SAFETY** — finding that could affect resident diet, allergy, NPO, texture/liquid safety, clinical freshness, or evidence of care.
- **SECURITY** — authentication, authorization, dependency, secret, isolation, or attack-surface finding.
- **TECH DEBT** — maintainability or architectural debt that does not itself prove incorrect behavior.
- **MISSING** — required workflow/capability is not materially implemented.

---

# 1. Executive Assessment

## What ShorelineOps is today

ShorelineOps is **not a mock dashboard and not a mere proof of concept**. It is a broad healthcare/senior-living dietary operations application with a real React/Vite frontend, Express backend, PostgreSQL/SQLite database abstraction, migrations, authentication/session infrastructure, resident and clinical dietary records, menus, recipes, production sheets, tray-run state, temperature/HACCP logging, purchasing, inventory, audit logging, reporting, an EHR queue/integration boundary, PWA/Electron surfaces, CI jobs, and meaningful tests.

The strongest parts of the repository are the parts closest to an actual kitchen operation:

- resident records and service projections;
- clinical diet/allergy/NPO/profile history foundations;
- production sheets and census-driven calculations;
- tray-run state and event persistence;
- fail-closed tray safety logic;
- kitchen meal-order/tally workflows;
- purchasing and PO/invoice foundations;
- true inventory items/ledger/count structures;
- audit/session/authentication foundations;
- PostgreSQL concurrency acceptance for selected critical paths;
- safe refusal behavior where offline or hardware capabilities cannot be trusted.

The repository also contains a second category of functionality that **looks much more complete in documentation than it is in code**. PointClickCare, USDA FoodData Central, broadline vendor pricing/EDI, hardware printing/probes, multi-facility enterprise behavior, CLI behavior, and MCP/AI surfaces are currently adapters, simulations, local approximations, parked code, or partial foundations rather than verified production integrations.

## What it is genuinely capable of right now

**VERIFIED / materially implemented:**

- authenticated local/server-backed user flows;
- persisted residents, census/service information, diets, NPO, allergies, texture values, and clinical history for several clinical fields;
- menus and recipes;
- persisted production sheets;
- tray-run/station/event workflows;
- fail-closed resident/recipe safety checks;
- kitchen orders/tallies;
- generic food/equipment temperature logs and corrective-action fields;
- purchasing/vendor/catalog/order-guide/PO/invoice structures;
- inventory items, transaction ledger, count sessions;
- audit logging;
- PostgreSQL migrations and selected PostgreSQL concurrency tests;
- encrypted logical backup/restore acceptance in current CI;
- PWA shell/static caching with deliberately limited clinical offline behavior;
- Docker build/readiness evidence.

**Not currently credible as production capability without additional work:**

- real PointClickCare two-way/FHIR integration;
- live Sysco/US Foods/Dennis contract-price/EDI integration;
- real USDA FoodData Central database access;
- verified Zebra/Bluetooth probe/printer workflows;
- true multi-facility enterprise operation over current clinical tables;
- clinically complete dysphagia/IDDSI beverage handling;
- clinically authoritative nutrient analysis;
- autonomous/production MCP behavior;
- production CLI administration;
- a fully validated healthcare compliance package;
- unattended production deployment with a currently green release gate.

## How close it is to the stated vision

My estimate is:

- **~60–65% of the envisioned functional surface has real implementation behind it.**
- **~45–55% is at a depth I would consider ready for serious production hardening.**
- **~20–25% of the visible/claimed surface appears more complete in documentation/UI than the underlying implementation actually is**, especially integrations, hardware, enterprise/multi-facility, nutrition data, CLI, and MCP.

These are professional judgment estimates, not code-coverage metrics.

## Maturity classification

**Advanced Alpha / Internal-Pilot Candidate**

Not a throwaway prototype. Not yet a production candidate.

A carefully scoped internal pilot with synthetic/de-identified residents and no reliance on mocked integrations would be reasonable after P0 issues are addressed. A live resident-care deployment should wait for clinical-safety remediation, green release/security gates, real-world acceptance tests, and explicit operational runbooks.

## Strongest areas

1. **Safety posture in several core flows.** Tray safety and offline clinical behavior prefer holding/refusing over inventing success.
2. **Substantial operational breadth.** Residents, kitchen, production, trays, purchasing, inventory and reporting share a real backend/data layer.
3. **Authentication/session foundation.** Revocable persisted sessions, JWT audience/purpose checks, TOTP support, facility binding and fail-closed capabilities are materially stronger than the average prototype.
4. **Real database/migration work.** This is not localStorage pretending to be a healthcare platform.
5. **Current PostgreSQL acceptance for selected concurrency/recovery cases.** Current CI proves more than older status documents claim.
6. **Product concept.** Healthcare dietary operations is coherent enough to justify a dedicated product separate from general restaurant software.

## Weakest areas

1. Clinical-domain completeness is uneven: food texture exists, but liquid consistency/thickened-liquid handling is not a first-class structured clinical field.
2. A confirmed fluid-restriction history/versioning defect undermines clinical change traceability.
3. External integrations are substantially overrepresented in documentation.
4. Authorization is strong in some clinical areas but inconsistent across purchasing/inventory/operational mutations.
5. Current CI/security gates on `main` are red.
6. Deployment configuration has runtime drift (`render.yaml` still requests Node 20 while the codebase has moved to newer Node requirements).
7. MCP/CLI/hardware areas are not at the quality level of the core resident/production backend.
8. Large route files and duplicated domain rules will make future clinical hardening harder.

## Biggest technical risks

- inconsistent authorization semantics across routers;
- duplicated safety/domain mappings across client and server;
- PostgreSQL/SQLite behavior drift;
- broad JSON/`any` payloads in production-critical structures;
- materialized inventory state plus ledger state drifting;
- oversized route/controller modules accumulating business logic;
- deployment/runtime configuration drift;
- red dependency security audit gates;
- unprotected `main` branch despite a safety-sensitive product.

## Biggest product risks

- breadth outrunning validated depth;
- documentation claiming integrations that are simulators/scaffolds;
- trying to become clinical nutrition, foodservice ERP, EHR integration, hardware platform and enterprise SaaS simultaneously;
- unclear line between a facility-operational tool and a clinically authoritative system of record;
- trust loss if buyers discover “live” integrations are synthetic after evaluation.

## Biggest healthcare operational risks

- fluid restriction changes can escape the same history/versioning path used by other clinical fields;
- structured liquid consistency is missing despite dysphagia/IDDSI ambitions;
- nutrition data is approximate/hard-coded but could be mistaken for authoritative nutrition analysis;
- therapeutic-diet transformations are too simple to be treated as clinical prescribing logic;
- real EHR synchronization is absent, so stale/manual clinical reconciliation remains necessary;
- no real-facility acceptance has proven that staff can reliably execute the full meal-service workflow under time pressure.

## What could prevent real facility adoption

- inability to prove clinical-data freshness and complete change history;
- lack of real EHR integration where facilities expect it;
- incomplete liquid/dysphagia workflow;
- vendor/hardware claims not matching actual implementation;
- current red CI/security gates;
- lack of a demonstrated support/backup/restore/upgrade/runbook story at a real facility;
- no evidence yet of sustained tablet/kitchen usability under actual service conditions;
- buyer concerns around HIPAA/security/compliance claims without formal governance/evidence.

## What should be addressed first

Do **not** add features first. Restore a trustworthy foundation:

1. get `main` release gates green;
2. fix the fluid-restriction clinical-history/version bug;
3. add a first-class liquid-consistency/thickened-liquid model and workflow;
4. complete a route-by-route mutation authorization audit;
5. prevent approximate/mock integrations from appearing authoritative;
6. establish real end-to-end clinical acceptance tests;
7. only then deepen one external integration at a time.

## Executive grade

**C+ — 61/100**

That grade reflects a valuable, real application whose underlying core is substantially better than a prototype, but whose safety-sensitive production bar is much higher than its current acceptance evidence.

---

# 2. Repository & Codebase Health

## Organization

**Grade: B-**

The repository is understandable at the top level: frontend under `src/`, backend under `server/`, SDK under `sdk/`, scripts, docs, Docker/deployment configuration, Electron/PWA surfaces, and CI workflows. Feature folders on the frontend are generally discoverable.

The backend is less cleanly separated. Several route files have become large controller/service/domain aggregates:

- `server/src/routes/admin.ts` (~large multi-responsibility route module)
- `server/src/routes/purchasing.ts`
- `server/src/routes/kitchen.ts`
- `server/src/routes/hardware.ts`
- `server/src/routes/distributor.ts`
- `server/src/routes/inventory.ts`
- `server/src/routes/ehr.ts`

These modules mix HTTP concerns, validation, business logic, transaction orchestration, formatting and integration behavior. This is still salvageable; it is a refactoring target, not a reason for a rewrite.

## Naming / identity drift

**TECH DEBT:** root package identity is `shoreline-v5`, while current server/version strings and documentation include later version generations. The repository also exposes both `shoreline` and `culinaryos` CLI aliases to the same executable. That is confusing within the broader ShadowWalker portfolio, where CulinaryOS is a separate product.

Recommendation: when behavior changes are authorized later, remove the `culinaryos` alias, normalize version ownership, and define a single canonical version source.

## Separation of concerns

Frontend feature separation is generally reasonable. Backend domain separation is only partial. The largest concern is not folder naming; it is duplicated or route-local business policy.

Examples:

- IDDSI/texture mapping exists in more than one place and includes “keep in sync” style coupling.
- authorization sometimes uses semantic capabilities and elsewhere generic role-rank checks.
- inventory uses both current `on_hand` state and a transaction ledger.
- production sheet structures contain flexible JSON, reducing structural enforcement.

## TypeScript quality

**Grade: C+**

The codebase uses TypeScript broadly and Zod in important areas, but safety-critical structures still use loose shapes and casts.

Notable examples:

- production sheet mutation schemas accept broad `z.any()` rows/counts;
- database rows are frequently shaped dynamically;
- SDK response handling uses loose casts;
- JSONB is heavily used for complex operational snapshots.

The correct improvement is targeted strengthening around clinical, production, purchasing and audit boundaries—not a project-wide type-system rewrite.

## Hardcoded values / assumptions

Verified examples include:

- reporting labor estimates based on fixed assumptions rather than actual payroll/labor;
- hard-coded reporting category allocation percentages;
- local USDA food profiles and generic nutrient fallback;
- simulated broadline catalog/pricing behavior;
- synthetic PointClickCare census;
- sample scanner/hardware data;
- CLI canned data.

These are acceptable for prototypes only if they are clearly labeled and impossible to confuse with production evidence.

## Dependency / build health

- Node runtime direction has moved to Node 24 in `.node-version` and Docker.
- `render.yaml` remains on Node 20 — **deployment drift**.
- current GitHub Security Audit has failed root/server high-severity audit gates.
- current Windows CI has a test failure while Linux build/typecheck/system jobs and PostgreSQL acceptance jobs succeed.

**SECURITY / RELIABILITY:** `main` is currently unprotected according to the repository branch metadata. For a safety-sensitive product, required checks should eventually be enforced before direct changes land.

---

# 3. Actual Architecture Review

## Reconstructed architecture

```text
                    ┌─────────────────────────────┐
                    │ React 18 / Vite Frontend    │
                    │ PWA + Electron surfaces     │
                    │ Zustand / feature modules   │
                    └──────────────┬──────────────┘
                                   │ REST /api/v1
                                   v
                    ┌─────────────────────────────┐
                    │ Express API                 │
                    │ Helmet / CORS / rate limit  │
                    │ request ID / auth / tenant  │
                    └──────────────┬──────────────┘
                                   │
       ┌───────────────────────────┼──────────────────────────────┐
       │                           │                              │
       v                           v                              v
┌──────────────┐           ┌─────────────────┐          ┌─────────────────┐
│ Clinical     │           │ Operations      │          │ Integrations    │
│ residents    │           │ menus/recipes   │          │ EHR / vendors   │
│ history/EHR  │           │ production      │          │ USDA/hardware   │
│ audit        │           │ kitchen/trays   │          │ MCP             │
└──────┬───────┘           │ purchasing/inv  │          └────────┬────────┘
       │                   └────────┬────────┘                   │
       └────────────────────────────┼────────────────────────────┘
                                    v
                         ┌──────────────────────┐
                         │ DB abstraction       │
                         │ PostgreSQL target    │
                         │ SQLite local/dev     │
                         └──────────┬───────────┘
                                    │
                                    v
                         migrations / audit /
                         operational snapshots

External integration reality:
- PointClickCare: adapter + synthetic data, not live FHIR sync
- USDA: local/hardcoded nutrition approximation, not live FDC
- Broadline: scaffold/mock catalog/pricing, not live EDI
- Hardware: sample/disabled legacy behavior, not accepted device stack

Offline reality:
- service worker caches shell/static assets
- clinical work deliberately fails closed without trustworthy current server data
```

## Frontend architecture

Feature-oriented React is appropriate. Lazy routing and separate feature folders are positive. The main architectural issue is not the framework but the number of workflow variants and some direct low-level HTTP/auth behavior living in feature components rather than a single API/client layer.

## Backend architecture

Express is sufficient for this product scale. The issue is not Express scalability; it is large route modules absorbing domain logic. A rewrite to another framework would add risk without solving the underlying boundary problems.

## Database architecture

PostgreSQL is the correct production direction. SQLite compatibility is useful for development but creates a second behavior surface that must not silently become production truth.

## Authentication architecture

Strong foundation:

- signed JWT access token with explicit purpose/audience validation;
- revocable persisted sessions;
- MFA/TOTP support;
- refresh/session handling;
- production-secret requirements;
- rate limiting;
- facility binding.

## Authorization architecture

Mixed quality.

Clinical routes increasingly use fail-closed capabilities. Other modules still rely on broad rank ordering or only authentication. This is a major hardening priority.

## Tenant architecture

Current healthcare-safe boundary is effectively **one facility per database**. The code explicitly constrains facility context. This is a legitimate architecture, but it means older descriptions of broad multi-facility clinical tenancy are not the current product reality.

## Offline architecture

The current conservative approach is appropriate: cache the application shell/static content, but refuse to imply clinical freshness when the server is unavailable.

## Background/event behavior

The repository includes periodic/daemon-style operational work and forecast/reporting behavior, but it does not currently implement a broad event-driven architecture. That is fine. An event bus is not needed simply for architectural fashion.

## Scaling judgment

The architecture is appropriate for a facility-scale application and can be evolved. It does **not** need to be rewritten into microservices. The first structural limit is domain/module maintainability and single-facility data ownership, not Express itself.

---

# 4. Feature Reality Check

Legend: **Production-capable** here means the code appears technically complete enough for the feature itself, not that the whole product is production-ready. Safety-sensitive features still require facility acceptance.

| Area | Feature | Status | Evidence / Notes |
|---|---|---|---|
| Residents | census/resident records | Functional but incomplete | `server/src/routes/residents.ts`; real persistence and projections |
| Residents | room/table assignments | Functional but incomplete | resident/service fields exist; real-world flow not fully accepted |
| Residents | therapeutic diet | Functional but incomplete | structured diet field; production transformations too simplistic for authoritative clinical logic |
| Residents | allergies | Functional but incomplete | structured arrays/history and tray safety; quality depends on recipe ingredient/allergen completeness |
| Residents | NPO | Functional | structured field, UI visibility, tray safety block |
| Residents | IDDSI food texture | Functional but incomplete | structured texture levels and production/tray logic; lacks full clinical acceptance |
| Residents | liquid consistency/thickened liquids | **Missing** | no comparable first-class structured beverage IDDSI workflow found |
| Residents | fluid restriction | **Broken / partial** | field exists but change snapshot/history/versioning omits it; UI coverage incomplete |
| Residents | diet history/versioning | Functional but incomplete | clinical history exists, but fluid restriction escapes the comparison path |
| Clinical | allergen enforcement | Functional but incomplete | fail-closed tray safety is strong; source recipe data still determines accuracy |
| Clinical | clinical holds | Functional | tray hold/reject safety paths exist |
| Clinical | diet-order reconciliation | Prototype/partial | local EHR queue/workflow exists; external PCC feed is synthetic |
| Clinical | RD workflow | Functional but incomplete | clinical flags/history exist; RD-review submission has an auth-token bug |
| Clinical | nutrition analysis | **Prototype** | `server/src/integrations/usda.ts` uses local profiles/generic fallback, not live FoodData Central |
| Menu | weekly/cycle menus | Functional | persisted menu weeks and current/menu routes |
| Menu | meal periods/choices | Functional | persisted menu structure |
| Menu | substitutions | Functional but incomplete | operational substitution handling exists; clinical governance incomplete |
| Menu | special-diet validation | Partial | transforms/checks exist but are too shallow for clinical authority |
| Recipes | recipe CRUD/versioning | Functional | real persisted routes/data |
| Recipes | scaling/yields | Functional but incomplete | core calculations exist; acceptance/provenance needs strengthening |
| Recipes | allergens | Functional but incomplete | fields/checking exist; quality depends on complete ingredient metadata |
| Recipes | nutrition | Prototype | downstream source is approximate/hardcoded |
| Recipes | costing | Functional but incomplete | vendor/inventory cost foundations; live contract data not real |
| Production | census-driven production | Functional | persisted production sheets/forecasting |
| Production | prep/batch sheets | Functional but incomplete | production rows/counts exist; broad schema validation |
| Production | station assignments | Functional | tray-run/station structures |
| Production | forecasting | Functional but incomplete | real code, but needs facility calibration |
| Production | leftovers/waste | Partial | some operational structures; not a complete waste-management system |
| Production | cook temperatures | Partial | generic HACCP temperature logger exists; not tightly integrated across every production step |
| Tray service | tray cards/runs | Functional | persisted tray runs/events and resident snapshots |
| Tray service | safety verification | Functional but incomplete | strong fail-closed `traySafety.ts`; clinical data completeness still matters |
| Tray service | QR support | Functional | signed/structured support exists in production/tray flows |
| Tray service | replacement/hold/reject | Functional | event state exists; UI uses basic `window.prompt` reasons |
| Dining room | dining-room workflow | Partial | service/tray tooling exists, but full real-floor workflow not accepted |
| HACCP | food/equipment temp logs | Functional | `TempLogPanel.tsx` + hardware HACCP route |
| HACCP | hot/cold holding | Functional but incomplete | generic threshold/target model |
| HACCP | cooking temps | Functional but incomplete | generic log route; no full product-specific critical-control workflow |
| HACCP | cooling | **Partial/Missing dedicated workflow** | no robust staged cooling timeline found |
| HACCP | reheating | **Partial/Missing dedicated workflow** | generic logging can record temps, but dedicated validation/timing not complete |
| HACCP | corrective action | Functional but incomplete | field/log exists; workflow/escalation evidence limited |
| HACCP | equipment logs | Functional but incomplete | generic equipment category; hardware acceptance absent |
| Purchasing | vendors/catalogs | Functional | substantial persisted backend |
| Purchasing | purchase orders | Functional | real DB/transaction behavior |
| Purchasing | suggested orders | Functional but incomplete | logic exists; source live pricing/inventory semantics need validation |
| Purchasing | distributor comparison | Prototype/partial | broadline adapter uses scaffold/mock pricing |
| Purchasing | split purchasing | Partial | comparison/mapping foundations exist |
| Purchasing | receiving/invoices | Functional but incomplete | persisted structures and matching logic |
| Purchasing | 3-way matching | Functional but incomplete | backend implementation; facility acceptance needed |
| Inventory | inventory system | **Yes — functional but incomplete** | inventory items + transactions + counts are real |
| Inventory | perpetual ledger | Functional but incomplete | transaction table exists; application-enforced integrity, not full DB immutability |
| Inventory | physical counts | Functional | count sessions/routes |
| Inventory | pars | Functional/partial | item/order-guide concepts |
| Inventory | waste/transfers | Partial | not a full mature ledger workflow |
| Inventory | lot/expiry tracking | Missing/limited | no mature lot-controlled food inventory system found |
| Inventory | valuation/food-cost integration | Partial | multiple cost concepts; reporting includes assumptions |
| Compliance | audit log | Functional | append-only protection stronger on PostgreSQL |
| Compliance | survey readiness | Partial | reports/audit material exist; no evidence of complete regulator-validated binder |
| Compliance | CMS/F-tag claims | Partial/Unverified | documentation exists; regulatory correctness must not be inferred from labels |
| EHR | incoming queue/webhook safety | Functional foundation | HMAC/raw-body boundary and queue code are real |
| EHR | PointClickCare live sync | **Mock/prototype** | synthetic hard-coded census in integration adapter |
| Vendor | Sysco/US Foods/Dennis live pricing/EDI | **Mock/prototype** | broadline scaffold/mock catalog/pricing |
| Nutrition | USDA FDC 8,000+ foods | **Unsupported claim** | local hard-coded set + generic fallback instead of FDC calls |
| Hardware | Bluetooth probe | Stub/disabled | unsafe legacy simulation intentionally retired; endpoint returns unavailable/501 |
| Hardware | Zebra/raw printing | Stub/disabled | no accepted real printer path found |
| SDK | client SDK | Partial | useful read/API wrapper, but endpoint/type parity is incomplete |
| CLI | operational CLI | **Demo/prototype** | canned/hardcoded data, not live authenticated administration |
| MCP/AI | MCP tools | Prototype/parked | manager-gated/write-breaker, but stale/mock internal paths remain |

---

# 5. Healthcare Safety Review

## HS-01 — Fluid restriction changes are not included in clinical change/version history

**CLINICAL SAFETY — HIGH — VERIFIED BUG**

Evidence:

- `server/src/routes/residents.ts` supports `fluidRestrictionMl` / `fluid_restriction_ml` mutation.
- the clinical snapshot/change comparison covers diet, texture, NPO and allergens but not fluid restriction.
- downstream version/history behavior is driven by that clinical-change detection.

Consequence:

A fluid restriction can change without the same `profile_version` bump/history event used for other safety-sensitive clinical fields. This undermines auditability and can make downstream consumers believe the clinical profile version is unchanged.

Required remediation:

Add fluid restriction to the canonical clinical snapshot, comparison, history payload, tests, UI timeline and concurrency scenarios. Consider all future clinical fields to be registered centrally rather than manually remembered in several places.

## HS-02 — Liquid consistency / thickened-liquid handling is not first-class

**CLINICAL SAFETY — HIGH — VERIFIED GAP**

Food texture levels are structured. A comparable structured liquid-consistency field/workflow was not found. Free-text instructions are not an adequate substitute for a product claiming comprehensive IDDSI handling.

Risk:

A resident can have safe food texture represented while beverage thickness is ambiguous, stale, or hidden in notes.

Required remediation:

Create an explicitly governed beverage consistency model with allowed values, effective date/history, display on resident/tray/service surfaces, safety checks, tests and migration strategy. Do not invent clinical mappings without subject-matter validation.

## HS-03 — Nutrition source is not authoritative

**CLINICAL SAFETY — HIGH if used clinically; PRODUCT — VERIFIED**

`server/src/integrations/usda.ts` does not perform live FoodData Central lookup. It contains a small hard-coded profile set and generic fallback values.

Risk:

Estimated nutrients could be mistaken for verified renal/diabetic/sodium/calorie data.

Required remediation:

Until a real, provenance-aware nutrition source is implemented, label approximate values as non-clinical or fail closed for workflows that require clinical precision.

## HS-04 — Therapeutic-diet logic is too simplistic to be authoritative

**CLINICAL SAFETY — HIGH RISK**

Production transformations use relatively simple mappings/string-level substitutions for concepts such as cardiac/renal/low-sodium/diabetic handling. These are useful operational helpers but not sufficient evidence of a clinically governed diet engine.

Required remediation:

Separate operational menu transformation from clinical diet-order truth. Build a reviewed rule set with provenance, versioning, explicit exclusions, tests and dietitian governance before marketing it as clinical enforcement.

## HS-05 — PointClickCare freshness is simulated

**CLINICAL SAFETY — HIGH PRODUCT RISK / VERIFIED**

The PCC adapter returns synthetic residents rather than a live PCC/FHIR census.

Risk:

If UI/docs imply live synchronization, staff may wrongly assume the system reflects the current EHR.

Required remediation:

Make simulation unmistakable in non-production; prevent simulated mode in production. Real integration should have sandbox acceptance, cursor/retry/idempotency behavior, reconciliation, freshness timestamps and fail-closed stale-state indicators.

## HS-06 — RD review flag submission uses an obsolete token location

**BUG / CLINICAL WORKFLOW — HIGH**

`src/features/residents/components/ResidentFormModal.tsx` reads `localStorage.getItem('shoreline_auth_token')`, while current production auth keeps access tokens in memory and refresh state separately. This can cause a clinical flag/report action to fail authentication even when the user is logged in.

## HS-07 — Duplicate IDDSI/texture mappings can drift

**CLINICAL SAFETY / TECH DEBT — MEDIUM-HIGH**

Client/server mappings are maintained separately. Safety-critical meaning should not rely on “keep in sync” conventions.

Recommendation: one shared versioned contract or generated mapping consumed by both surfaces, with contract tests.

## HS-08 — Offline behavior is appropriately fail-closed

**STRENGTH — VERIFIED**

The offline UI does not pretend stale resident clinical data is current. This is the correct default for a safety-sensitive application. Preserve this behavior while adding better offline indicators and explicitly safe read-only workflows.

## HS-09 — Tray safety generally prefers holds over unsafe inference

**STRENGTH — VERIFIED**

`server/src/engine/traySafety.ts` blocks NPO, checks allergy/ingredient evidence, restricted diet and texture compatibility, and can hold service when recipe safety evidence is insufficient. This is one of the best architectural choices in the codebase.

Do not weaken it to improve “smoothness.” Improve underlying recipe/allergen data instead.

## HS-10 — Signoff identity should not rely on caller-supplied names

**RISK — MEDIUM**

Where production/signoff endpoints accept display-name style fields from request input, the authoritative identity should be bound to the authenticated user/session, with optional separately recorded attestation text. Audit evidence must never depend on a user-supplied staff name alone.

---

# 6. Security Review

## Strengths

**VERIFIED:**

- Helmet/security headers and CSP-related handling;
- CORS configuration;
- global and authentication rate limiting;
- JWT audience/purpose checks;
- production JWT secret-length guard;
- persisted/revocable sessions;
- facility-context validation;
- TOTP/MFA support;
- raw-body preservation for signed webhook verification;
- HMAC webhook boundary for EHR path;
- fail-closed capability map on important clinical operations;
- database readiness gates;
- production Postgres audit protection stronger than simple application logging.

## Confirmed / probable weaknesses

### SEC-01 — Current dependency audit gates are red

**SECURITY — HIGH — VERIFIED**

The latest GitHub Security Audit run fails root and server high-severity `npm audit --omit=dev --audit-level=high` gates. This audit did not obtain the advisory list itself, so the exact vulnerable packages/CVEs remain **UNKNOWN** until the workflow captures them.

Action: capture advisories, determine reachability, upgrade or mitigate safely, and keep the gate required.

### SEC-02 — Purchasing authorization is inconsistent

**SECURITY — HIGH — VERIFIED/PARTIAL depending handler**

Several purchasing mutations are protected by authentication at the router level but lack a comparable explicit capability/manager restriction at the individual mutation boundary. A safety-sensitive operations system should not rely on “any authenticated employee” semantics for ordering/configuration.

Action: inventory every mutation endpoint and map it to named capabilities.

### SEC-03 — Role ranking can grant semantically unrelated rights

**SECURITY — MEDIUM-HIGH**

Generic `requireRole('staff')` style rank checks can unintentionally allow higher-ranked but operationally unrelated roles. Role rank is useful for coarse access, but purchasing, clinical, inventory and administrative mutation should use semantic capabilities.

### SEC-04 — `main` branch is unprotected

**SECURITY / RELIABILITY — HIGH PROCESS RISK — VERIFIED**

GitHub branch metadata reports `main` protection disabled. Given red CI and a healthcare-safety domain, direct unreviewed pushes can bypass safety checks.

Recommendation: require CI/security checks and protected review/merge policy once the current gates are stabilized.

### SEC-05 — Actions are version-tag pinned, not immutable-SHA pinned

**SUPPLY CHAIN — MEDIUM**

Actions such as checkout/setup-node use major tags. Harden stable workflows with immutable SHAs where practical and use dependency review/security scanning.

### SEC-06 — MCP write surface is not ready for production

**SECURITY — HIGH if enabled**

The MCP layer is parked/experimental. It has manager gating and a write breaker, which is good, but stale/mock implementation paths and a potentially mutating self-heal concept mean write capability should remain disabled until fully accepted.

### SEC-07 — One-facility-per-database is the current isolation boundary

**VERIFIED ARCHITECTURE**

There is no broad row-level multi-tenant RLS model for clinical data. This is not automatically a vulnerability because the current architecture deliberately binds a database to one facility. It becomes a security defect only if deployment or enterprise code starts sharing a clinical DB across facilities without redesigning isolation.

## HIPAA / compliance statement

Nothing in this audit establishes HIPAA compliance, SOC 2 certification, regulatory certification, or a contractual SLA. Security controls are necessary but not sufficient for those claims. Policies, BAAs, governance, incident handling, retention, access review, hosting posture, backups, training and operational practice all matter.

---

# 7. Database & Data Model Review

## Simplified entity relationship view

```text
FacilityConfig
   │
   ├──── Users ─── Sessions / Refresh Tokens
   │
   └──── AuditLog

Residents
   │
   ├──── ResidentClinicalHistory
   ├──── EHR queue / reconciliation records
   └──── Tray / production resident snapshots

MenuWeeks (JSON days)
   │
   └──── Recipes
           └──── ingredients / allergens / nutrition metadata

ProductionSheets (JSON rows/counts)
   │
   └──── TrayRuns
           └──── TrayRunEvents

Vendors
   └──── VendorItems / FacilityItemMaps
            └──── OrderGuides
                    └──── PurchaseOrders
                           ├──── PurchaseOrderLines
                           └──── Invoices / matching records

InventoryItems
   ├──── InventoryTransactions
   └──── InventoryCounts
```

## Strengths

- actual migration history exists;
- PostgreSQL is explicitly exercised in CI;
- important foreign-key/uniqueness concepts exist;
- audit/history tables exist;
- purchase/inventory domains are not merely frontend state;
- selected concurrency paths are tested using real PostgreSQL;
- audit append-only protection is stronger on PostgreSQL.

## Data-model risks

### DB-01 — Clinical-field registration is manual and already missed fluid restriction

The confirmed fluid-restriction history bug is evidence that adding a clinical column does not automatically add it to snapshot/version/audit semantics.

Recommendation: centralize the clinical snapshot/version schema and test every clinical field for history/version behavior.

### DB-02 — Significant JSONB operational state

Menu days, production rows/counts and other snapshots use flexible JSON. This is useful for versioned snapshots but weakens database-level validation/search/integrity.

Recommendation: retain snapshots where historical immutability benefits from them, but move canonical entities/relationships that require querying/integrity into explicit tables.

### DB-03 — Inventory has ledger + materialized `on_hand`

Two representations of stock can drift unless every mutation is transactional and canonical reconciliation exists.

Recommendation: define ledger/source-of-truth semantics, use transactional updates, reconciliation checks and database constraints where feasible.

### DB-04 — Inventory append-only semantics are application-enforced

Migration comments indicate no general DB trigger protects inventory transactions. This may be acceptable, but it is weaker than the audit log’s PostgreSQL-level append-only enforcement.

### DB-05 — SQLite/Postgres semantic split

Production acceptance should be PostgreSQL-first. SQLite is useful for local/dev but should not be allowed to silently validate critical concurrency or constraint behavior that differs from PostgreSQL.

### DB-06 — Single-facility model is real

The current data model is appropriate if each facility has its own clinical database. Multi-facility commercialization must either preserve that isolation with a control plane or intentionally redesign tenant keys/RLS; it should not emerge accidentally.

---

# 8. API Review

## Strengths

- versioned `/api/v1` structure;
- Zod validation is common;
- explicit auth/tenant/request middleware;
- sensible route grouping;
- structured health/readiness behavior;
- transaction use in important purchasing/tray workflows;
- clear 4xx/5xx behavior in many inspected paths.

## Weaknesses

### API-01 — Authorization semantics differ by module

Some routes use explicit capabilities, others broad role rank, others only authentication. This is the most important API consistency problem.

### API-02 — Some mutation schemas are too permissive

Production sheet structures accept broad arrays/objects. Safety and audit-critical mutations need narrower schemas.

### API-03 — Side-effectful GET behavior

A production-sheet generation route uses GET semantics while generating/persisting state. Safe retries/caches/crawlers should not mutate state through GET.

### API-04 — Pagination/filtering maturity varies

Operational datasets are manageable at one facility today, but long-lived audit/HACCP/order histories need consistent pagination/filtering before years of data accumulate.

### API-05 — API/SDK parity is incomplete

The SDK references functionality (including a CMS survey-binder style method) that cannot be matched to a current server endpoint by repository search. Treat the SDK as partial until parity tests become authoritative.

### API-06 — Real-time is polling, not streaming

The server explicitly rejects WebSocket upgrades and the tray UI polls periodically. Do not describe current behavior as WebSocket/live real-time infrastructure.

---

# 9. Frontend / UI / UX Review

## General assessment

**Grade: B-**

The interface appears designed around actual work rather than generic SaaS dashboards in several important areas. Resident safety badges, tray controls, broad feature navigation and tablet-friendly patterns are positives.

## Kitchen/tablet strengths

- large tray controls and clear state bands;
- visible NPO/allergy/diet information in resident-oriented flows;
- busy-state protection on tray actions;
- lazy feature loading;
- dedicated kitchen/production/tray screens rather than forcing every task into admin tables.

## UX weaknesses

### UX-01 — `window.prompt` remains in tray exception flows

Hold/reject/replacement reasons are operationally important records. Native prompts are slow, inconsistent on tablets, inaccessible compared with a controlled dialog, and poorly structured.

### UX-02 — Clinical liquid consistency is not visible because it is not modeled

This is both a domain and UI gap.

### UX-03 — Error/loading/stale-state patterns are inconsistent

The offline page is strong, but every clinical surface should explicitly show freshness/last sync/source when external data exists.

### UX-04 — Breadth raises navigation/cognitive load

The product serves cooks, dietary aides, directors, RDs and administrators. Each role should default to a constrained workflow/home rather than exposing every module.

### UX-05 — Some surfaces feel like technical/system tooling

Enterprise/integration/MCP/hardware concepts should stay out of frontline kitchen navigation unless they directly support a staff task.

## Accessibility

There is evidence of accessibility intent, but no fresh, comprehensive acceptance result proving WCAG/ADA-oriented quality across the application. Tablet touch targets appear better than many administrative apps; keyboard/focus/screen-reader verification still needs a dedicated pass.

---

# 10. Real-World Kitchen Workflow Review

## Morning

### ShorelineOps helps with

- current resident/census data stored in one system;
- resident diets/NPO/allergies;
- meal counts and production planning;
- menu context;
- production sheets;
- tray generation/state;
- temperature documentation.

### Staff would still need external/manual processes for

- real-time EHR changes because PCC is not actually connected;
- call-out/staffing coordination beyond the dietary product;
- clinically verified thickened-liquid orders;
- facility-specific emergency/change communication unless manually entered;
- some substitutions and last-minute clinical clarification by phone/RD/nursing.

## Prep

### Helps with

- recipes/yields;
- production quantities;
- prep/production sheet concepts;
- resident texture/diet awareness;
- generic safety instructions.

### Still needs external/manual validation for

- clinically complete IDDSI preparation/testing procedures;
- beverage thickening;
- allergen separation SOP execution;
- thawing schedules and full HACCP task timing;
- real nutrient source verification.

## Service

### Helps with

- tray runs;
- resident safety display;
- NPO block;
- allergy/diet/texture checks;
- hold/reject/replace events;
- QR/tray-card concepts.

### Remaining likely external workflows

- nursing/RD confirmation of new orders;
- resident location changes not yet synchronized from an EHR;
- physical tray-line visual/second-person checks;
- late tray/dining room exceptions that do not map cleanly to current state machine;
- printer/scanner hardware until real device paths are accepted.

## Ordering

### Helps with

- vendors/items;
- order guides;
- POs;
- invoices;
- inventory/counts;
- suggested ordering;
- matching foundations.

### Still external/manual

- actual distributor contract catalogs/pricing;
- EDI transmission/acknowledgment;
- live substitutions/availability;
- credits and discrepancies across real vendor feeds;
- some invoice/OCR/accounting integration.

## End of shift

### Helps with

- generic temperature records;
- audit trail;
- production/tray history;
- some waste/inventory data.

### Remaining gaps

- dedicated cooling-stage workflow/timers;
- robust reheating workflow;
- comprehensive cleaning/task verification;
- formal structured shift handoff;
- mature leftover disposition linking production, cooling, inventory and next-use rules.

## Practical conclusion

ShorelineOps could reduce paper substantially in a controlled pilot, but it would **not yet replace the EHR, vendor portals, hardware workflows, nursing/RD communication, or all HACCP paper/SOP processes**. Those boundaries should be communicated honestly.

---

# 11. Testing & Quality Review

## What is genuinely tested

Current GitHub Actions provide meaningful evidence for:

- Linux typecheck/build/system verification;
- PostgreSQL migration/acceptance;
- selected clinical decision races/concurrency;
- authentication-session revocation;
- encrypted logical backup and isolated restore;
- SDK boundary checks;
- Docker readiness.

The repository also has a broad custom test runner (`scripts/run-tests.mjs`) and multiple targeted test categories rather than a single superficial unit-test suite.

## Current red gates

- Windows build/test job currently fails at the test stage.
- root/server high-severity dependency audit jobs currently fail.

Therefore the current head is **not green**.

## Important unproven areas

- real PCC integration;
- real vendor EDI/pricing;
- real hardware;
- packaged desktop in a facility environment;
- complete accessibility;
- long-duration/offline interruption behavior;
- full multi-user meal-service acceptance;
- complete clinical liquid/IDDSI behavior;
- facility-scale load over months/years.

## Testing gaps to prioritize

1. every clinical-field mutation must assert version/history/audit semantics;
2. NPO/allergy/texture/liquid/fluid-restriction matrix tests;
3. concurrent clinical update conflicts;
4. stale external-data failure behavior;
5. authorization matrix over every mutation endpoint;
6. ledger/current-inventory reconciliation;
7. API/SDK parity;
8. real browser E2E for resident → production → tray → HACCP flows;
9. accessibility regression tests plus manual acceptance;
10. production deployment smoke/rollback tests.

Passing test count should not be used as a production-readiness metric without coverage mapping.

---

# 12. Deployment & Operations Review

## Current evidence

- Dockerfile exists and current Docker readiness job succeeds.
- Node 24 is used in `.node-version` and Docker.
- Railway configuration exists.
- Render configuration exists but requests Node 20.
- current CI proves PostgreSQL migration, selected concurrency and encrypted logical restore.
- health/readiness endpoint behavior exists.

## Deployment blockers

### OPS-01 — Render runtime drift

**HIGH** — `render.yaml` specifies Node 20 while the repository runtime baseline has moved forward. This can produce divergent runtime behavior or failed deployment.

### OPS-02 — Current release gates are red

No production promotion process should treat the current head as accepted while Windows tests/security audit are failing.

### OPS-03 — No real-facility acceptance

Container startup is not the same as an operational deployment. A production candidate needs installation/update/rollback/backup/restore/device/network/browser/tablet acceptance in the actual target environment.

### OPS-04 — Branch protection absent

Required checks are not enforced at the Git branch boundary.

## Operational maturity assessment

**C**. The repository has more operational tooling than an average alpha, but it lacks the final evidence and governance needed for a healthcare production candidate.

---

# 13. Documentation Audit — Claims vs Reality

| Claim | Documentation source | Implementation evidence | Status | Notes |
|---|---|---|---|---|
| resident dietary operations | README/architecture | residents, kitchen, production, tray routes | **Verified** | materially real |
| NPO/allergy/texture safety | README/architecture | resident model + `traySafety.ts` | **Partially Verified** | strong foundation; liquid consistency missing |
| PointClickCare two-way/live sync | README/architecture | `server/src/integrations/pointclickcare.ts` synthetic census | **Misleading / Unsupported as live** | adapter is not production PCC sync |
| Sysco/US Foods/Dennis live contract pricing | README | `server/src/integrations/broadline.ts` scaffold/mock behavior | **Misleading / Unsupported as live** | real provider acceptance absent |
| vendor EDI sync | README | adapter scaffolding | **Partially Verified / Planned** | protocol/product integration not live |
| USDA FoodData Central 8,000+ foods | README | `server/src/integrations/usda.ts` local profiles/fallback | **Unsupported** | no live FDC lookup found |
| Bluetooth probe integration | README/docs | hardware route returns unsupported for retired unsafe simulation | **Prototype/Disabled** | safer than faking success |
| Zebra/raw printing | README/docs | legacy simulation retired/501 path | **Prototype/Disabled** | needs real adapter acceptance |
| multi-facility enterprise | architecture/docs | `enterprise.ts` returns current configured facility; tenant middleware says one facility/DB | **Outdated / Future** | current clinical architecture is single-facility DB |
| real-time operational updates | broad docs wording | WebSocket upgrades explicitly rejected; polling used | **Partially Verified** | near-real-time polling, not WebSocket live stream |
| PostgreSQL production path | docs/status | current CI Postgres migration/concurrency succeeds | **Verified for covered scenarios** | not full production acceptance |
| backup/restore | docs/status | current CI encrypted logical backup + isolated restore passes | **Verified for covered workflow** | update STATUS to reflect newer evidence |
| secure auth/session | security/docs | JWT/session/TOTP/facility checks | **Verified foundation** | authz inconsistencies remain |
| HIPAA/compliant/enterprise-ready implications | marketing language | technical controls only | **Unverified as compliance claim** | requires organizational/legal controls too |
| SDK | docs | `sdk/src/ShorelineClient.ts` | **Partially Verified** | parity drift exists |
| CLI | package/bin docs | `bin/shoreline.js` | **Misleading if called operational** | primarily canned/demo behavior |
| MCP/AI | docs/code | parked MCP route/server | **Prototype** | keep writes off |

## Documentation conclusion

The repository should distinguish three categories explicitly:

1. **Available now** — real facility-operational features backed by code/tests.
2. **Adapter-ready / simulated** — useful engineering foundations without a verified external connection.
3. **Planned** — product roadmap only.

This would materially improve buyer and contributor trust.

---

# 14. Integration Review

| Integration | Classification | Evidence |
|---|---|---|
| PointClickCare | **Adapter / mocked synthetic feed** | hard-coded census in PCC adapter |
| Sysco | **Scaffold / mocked pricing** | broadline adapter |
| US Foods | **Scaffold / mocked pricing** | broadline adapter |
| Dennis Food Service | **Scaffold / mocked pricing** | broadline adapter |
| GFS | **Planned/documentation-level or insufficient evidence** | no accepted production connector found |
| PFG | **Planned/documentation-level or insufficient evidence** | no accepted production connector found |
| USDA FoodData Central | **Mock/local approximation** | hard-coded/local nutrition source |
| Zebra printer | **Disabled/prototype** | no accepted real hardware path |
| Bluetooth probe | **Disabled/prototype** | unsafe simulation retired |
| generic scanner | **Prototype/sample** | in-memory/sample flows |
| EDI | **Interface concept/scaffold** | no accepted live provider transaction cycle |
| SFTP/webhooks | **Partial infrastructure** | webhook/security foundations exist, external acceptance varies |

## Integration strategy recommendation

Do not build six vendor connectors simultaneously. Pick **one real EHR integration** and **one real distributor integration** only after core P0/P1 safety stabilization, and make each pass sandbox/contract/retry/reconciliation/failure acceptance before claiming support.

---

# 15. SDK, CLI, MCP & AI Review

## SDK

**Grade: C**

Positive:

- dedicated client exists;
- typed TS surface;
- token configuration;
- common read workflows exposed.

Weaknesses:

- incomplete API parity;
- loose response casting;
- apparent stale/nonexistent endpoint reference for CMS survey-binder behavior;
- not authoritative enough to be called complete.

Recommendation: generate/verify endpoint parity in CI or maintain a contract test suite against the real Express app.

## CLI

**Grade: D**

`bin/shoreline.js` is primarily a demonstration/canned-data CLI rather than a trustworthy authenticated operational CLI.

Also, exposing `culinaryos` as an alias is misleading in the current portfolio.

Decision needed later: either mark CLI explicitly `demo` and narrow claims, or rebuild it as a thin authenticated client over the real API. Do not maintain a parallel business-logic implementation.

## MCP / AI

**Grade: D+/C-**

The MCP layer contains useful architectural ideas—manager gating, write breaker, bounded tools—but remains parked and stale in places.

Verified issues include:

- a stale resident query path using an old `active` style condition inconsistent with the current resident status model;
- mock order generation;
- self-heal/remediation concepts that should not be autonomously enabled in a safety-sensitive system.

AI should not adjudicate resident clinical truth, allergens, NPO or texture/liquid orders where deterministic validated data should govern. MCP is most appropriate later for read/report/admin assistance over well-defined APIs.

---

# 16. Performance & Scalability

## 40 residents

Likely comfortable on current architecture if database indexes and operational deployment are healthy.

## 100 residents

Still reasonable. Meal-service concurrency and tablet polling should be tested under actual simultaneous use.

## 500 residents / multiple facilities

This is where the current one-facility-per-database model and operational assumptions matter more than raw Express throughput. Separate facility DBs plus a control plane may be safer than forcing shared clinical tenancy.

## Long-lived data growth

Potential pressure areas:

- audit log;
- HACCP logs;
- tray-run events;
- purchase/invoice histories;
- resident clinical history;
- large menu/production JSON snapshots.

Need consistent pagination, archival/retention policy and indexes.

## Potential bottlenecks

- polling for live tray state at scale;
- large JSON payloads/snapshots;
- route logic performing too much composition inline;
- report queries that aggregate long histories;
- vendor catalog expansion;
- duplicate calculations in client/server.

## Recommendation

Do not introduce microservices or a message broker now. Measure a realistic one-facility load first. Optimize specific queries/payloads after evidence.

---

# 17. Accessibility Review

**Current grade: C+/B-; acceptance incomplete.**

Positive indicators:

- tablet-oriented controls in several frontline flows;
- semantic React form/component structure in many areas;
- safety information is often textual rather than color-only;
- PWA/responsive intent.

Unverified / needs dedicated acceptance:

- full keyboard navigation;
- focus order/traps;
- screen-reader labels across custom controls;
- contrast in every theme/state;
- 44px+ touch target consistency;
- error announcement semantics;
- modal focus restoration;
- tray-line operation with gloves/fast taps;
- high-noise/high-pressure kitchen readability.

Replace native prompts with accessible controlled dialogs. Run automated tooling **and** manual keyboard/screen-reader/tablet acceptance.

---

# 18. Product Review

## Primary user

Day-to-day users should be:

- dietary director/foodservice manager;
- cooks;
- dietary aides;
- registered dietitian/clinical dietary staff;
- facility administrator for oversight.

Nursing/EHR users are adjacent data partners rather than the primary workflow owner.

## Buyer

Likely:

- senior-living operator;
- nursing/skilled facility operator;
- administrator/regional foodservice leadership;
- smaller operator underserved by large enterprise systems.

## Primary problem

> Keep resident dietary safety, kitchen production and healthcare foodservice evidence synchronized enough that staff can execute the correct meal for the correct resident while reducing paper, duplicated entry and survey risk.

That is a much stronger product center than “all-in-one enterprise healthcare ERP.”

## Strongest differentiators if finished

1. Resident safety tightly connected to kitchen production/tray workflows.
2. Foodservice-first rather than generic EHR-first UX.
3. Clinical dietary changes represented in operational kitchen tools.
4. Purchasing/inventory plus production in the same dietary domain.
5. Local/facility-friendly deployment options and fail-closed operation.

## Scope that distracts today

- autonomous MCP/self-healing;
- broad enterprise/billing polish before one-facility acceptance;
- many simultaneous vendor claims;
- hardware breadth before one accepted printer/probe workflow;
- CLI as a separate product surface;
- multi-facility dashboards before single-facility clinical workflows are fully proven.

## Recommended MVP / first production target

- secure facility setup/auth;
- resident census/profile;
- allergies/NPO/diet/food texture/liquid consistency/fluid restrictions with complete versioning;
- menu/recipe foundation;
- production/census planning;
- tray card/run/safety verification;
- HACCP core logs including real cooling/reheating workflows;
- audit/change history;
- basic inventory/purchasing;
- backup/restore and deployment runbook;
- optional manual EHR import/reconciliation before live integration.

Defer broad AI, enterprise and multi-vendor depth.

---

# 19. Competitive / Category Positioning

Based on the repository, ShorelineOps sits at the intersection of:

- senior-living dietary operations;
- healthcare foodservice management;
- menu/recipe/production software;
- clinical nutrition-adjacent workflow;
- inventory/purchasing;
- EHR-adjacent dietary reconciliation.

Its most credible category is **healthcare dietary operations platform**, not a full EHR and not merely restaurant software.

To become meaningfully competitive it needs:

1. clinically complete diet/texture/liquid/allergy/NPO order representation;
2. undeniable audit/history/freshness behavior;
3. one or two real EHR/vendor integrations rather than many mocked ones;
4. excellent tray-line/tablet UX;
5. proven deployment/recovery/security operations;
6. credible survey/compliance evidence without overclaiming certification;
7. reliable implementation at a real pilot facility.

---

# 20. Technical Debt Register

| ID | Area | Problem | Evidence | Severity | Effort | Recommendation |
|---|---|---|---|---|---|---|
| TD-01 | Clinical model | fluid restriction omitted from clinical snapshot/version path | `server/src/routes/residents.ts` | Critical/High | Small-Medium | centralize clinical snapshot schema and tests |
| TD-02 | Clinical model | no first-class liquid consistency | resident types/forms | High | Medium-Large | add governed field/history/UI/safety path |
| TD-03 | Auth | RD flag uses obsolete localStorage token | `ResidentFormModal.tsx` | High | Small | use canonical API/auth client |
| TD-04 | Authorization | inconsistent capability vs rank/auth-only mutation gates | purchasing/inventory/kitchen | High | Medium | endpoint capability matrix |
| TD-05 | Runtime | Render pins Node 20 while repo moved forward | `render.yaml` | High | Small | align runtime and test deployment |
| TD-06 | Dependencies | current high-severity audit gates fail | GitHub Actions | High | Medium | capture/triage/update advisories |
| TD-07 | Domain rules | duplicated IDDSI mapping | frontend/server | High | Medium | shared versioned contract |
| TD-08 | Nutrition | fake/local USDA fallback can look authoritative | `integrations/usda.ts` | High | Medium-Large | real provider/provenance or nonclinical label |
| TD-09 | Integrations | PCC synthetic data behind integration name | `integrations/pointclickcare.ts` | High | Large | explicit simulator; later real OAuth/FHIR |
| TD-10 | Integrations | broadline mock pricing/catalog | `integrations/broadline.ts` | High | Large | one real vendor connector first |
| TD-11 | API | production rows/counts weakly typed | `routes/production.ts` | Medium-High | Medium | explicit Zod contracts |
| TD-12 | REST | mutation via GET generation route | production route | Medium | Small | use POST/action resource |
| TD-13 | Inventory | materialized on-hand + ledger can drift | inventory schema/routes | High | Medium | source-of-truth + reconciliation |
| TD-14 | Backend | oversized route modules | routes/admin/purchasing/kitchen/etc. | Medium | Large | extract domain services gradually |
| TD-15 | SDK | partial/stale endpoint parity | `sdk/` | Medium | Medium | contract parity tests |
| TD-16 | CLI | canned data and duplicate CulinaryOS alias | `bin/shoreline.js`, package | Medium | Small-Medium | demo label or real API client; remove alias |
| TD-17 | MCP | stale/mock paths | `server/src/mcp/server.ts` | High if enabled | Medium | keep disabled; repair after core |
| TD-18 | Versioning | package/server/docs versions drift | package/health/docs | Low-Medium | Small | single version source |
| TD-19 | Tenancy | older multi-facility docs differ from one-facility DB | tenant middleware/docs | Medium | Medium | document current boundary; defer redesign |
| TD-20 | Branch/process | `main` unprotected | GitHub branch metadata | High process | Small | protect after green checks |

---

# 21. Bug / Risk Register

| ID | Finding | Type | Severity | Likelihood | Impact | Evidence | Recommended Fix |
|---|---|---|---|---|---|---|---|
| R-01 | fluid restriction does not participate in clinical version/history comparison | clinical safety/data integrity | **Critical/High** | High when edited | High | `residents.ts` snapshot/change code | add field to canonical clinical history/version contract + tests |
| R-02 | no structured liquid consistency/thickened-liquid workflow | clinical safety/missing | High | High in dysphagia populations | High | resident types/UI | implement governed beverage IDDSI field end-to-end |
| R-03 | RD-review flag uses obsolete token location | bug/auth | High | High on affected flow | Medium-High | `ResidentFormModal.tsx` vs token manager | canonical API client/auth context |
| R-04 | current high-severity dependency audits fail | security | High | Unknown reachability | High potential | GitHub Security Audit | capture advisories and remediate |
| R-05 | Windows test job fails on current main | reliability/build | High | Current | High | GitHub CI | reproduce and fix before release |
| R-06 | purchasing mutations may be available to any authenticated user | security/authz | High | Medium | High | `purchasing.ts` gates | capability-gate every mutation |
| R-07 | rank-based roles can inherit unrelated operational writes | security | High | Medium | High | generic role checks | semantic capabilities |
| R-08 | README implies live PCC but adapter is synthetic | clinical/product | High | High if believed | High | PCC adapter | correct claims + explicit simulator guard |
| R-09 | USDA values are local estimates | clinical/product | High | High | High if used clinically | USDA integration | provenance/fail-closed clinical usage |
| R-10 | therapeutic-diet transforms are simplistic | clinical safety | High | Medium | High | production engine | governed clinical rules, not string transformation |
| R-11 | duplicated IDDSI mapping can drift | clinical safety | High | Medium | High | frontend/server mapping | shared contract + tests |
| R-12 | Render still requests Node 20 | deployment | High | High on Render | High | `render.yaml` | align runtime |
| R-13 | broadline pricing/catalog is mock | product/integration | Medium-High | High | Medium-High | broadline adapter | explicit simulator / one real connector |
| R-14 | hardware endpoints are not accepted real device integrations | reliability/product | Medium | High if relied on | Medium-High | hardware routes | keep unavailable until real adapter acceptance |
| R-15 | MCP contains stale/mock paths | security/reliability | High if enabled | Low while off | High | MCP server | keep writes off; repair later |
| R-16 | inventory on-hand can drift from transaction ledger | data integrity | High | Medium | High | schema/routes | transactional/reconciliation controls |
| R-17 | production payload validation uses broad `any` | data integrity | Medium-High | Medium | High | production schemas | strong typed schema |
| R-18 | signoff display identity may accept caller-supplied staff name | audit/compliance | Medium | Medium | Medium | production/signoff route | bind to authenticated identity |
| R-19 | main branch unprotected | process/security | High | Medium | High | GitHub metadata | required checks/protection |
| R-20 | multi-facility claims ahead of data isolation architecture | security/product | Medium-High | Medium | High if expanded prematurely | tenant/enterprise routes | preserve one-facility DB until deliberate design |

---

# 22. Missing Features Required to Complete Existing Workflows

## Must-have

1. **Structured liquid consistency/thickened-liquid resident order** — necessary to complete dysphagia/IDDSI service safety.
2. **Complete clinical-field history/version registration** — every safety field must be auditable.
3. **Real clinical freshness/reconciliation semantics** — even before live EHR, show source and last-confirmed state.
4. **Dedicated cooling and reheating workflows** — generic temperature logging is insufficient for full HACCP execution.
5. **Mutation authorization matrix** — core security requirement, not a nice-to-have.
6. **Real end-to-end clinical acceptance test suite** — resident change → production → tray → verification.
7. **Deployment/rollback/restore runbook with green gates.**

## Should-have

1. structured shift handoff;
2. leftover/cooling/reuse disposition workflow;
3. stronger waste/transfer inventory semantics;
4. clearer dining-room/late-tray exceptions;
5. one real EHR connector;
6. one real vendor connector;
7. provenance-aware nutrient source;
8. SDK/API parity automation;
9. consistent stale/offline/source indicators.

## Nice-to-have

- hardware device adapters after one device path is accepted;
- barcode/QR improvements;
- richer reporting;
- role-tailored dashboards;
- improved forecasting after facility data exists.

## Future

- multi-facility control plane;
- regional/enterprise analytics;
- broad vendor marketplace;
- autonomous AI/MCP actions;
- billing/commercial administration beyond what is needed for actual launch.

---

# 23. Redundancy & Overengineering Review

## Simplify / consolidate

### Duplicate safety/domain mappings

Centralize IDDSI and other safety enums/contracts. Safety concepts should not be independently encoded in frontend and backend.

### SDK/CLI parallel surfaces

The server API should remain authoritative. SDK and CLI should be thin clients. The current demo CLI should not accumulate parallel business rules.

### Integration breadth

Do not maintain “supported” adapters for many vendors when none has production acceptance. One real connector is more valuable than six impressive class names.

### Enterprise/multi-facility

Keep the one-facility-per-database safety boundary until an actual multi-facility buyer/requirement justifies the control-plane work.

### AI/MCP

No clinical decision needs an LLM to determine NPO, allergens, texture or resident identity. Keep deterministic domain logic authoritative. MCP can later help with bounded reporting/admin workflows.

### Oversized routes

Refactor incrementally only where required to test/harden behavior. Do not launch a “clean architecture rewrite.”

---

# 24. File-by-File Hotspots

The following are the highest-value inspection/remediation hotspots, not an exhaustive file list.

| Path | Why it matters | What is notable | Eventual action |
|---|---|---|---|
| `server/src/routes/residents.ts` | clinical source of truth | fluid restriction history/version gap; broad resident mutation logic | P0 clinical fix; centralize clinical snapshot contract |
| `src/features/residents/components/ResidentFormModal.tsx` | clinical edit UI | obsolete auth token for flag action; liquid field gap | P0 auth fix; add governed liquid workflow later |
| `src/types/resident.ts` | resident contract | food texture/fluid fields but no full beverage consistency | extend safely with migration/version semantics |
| `server/src/engine/traySafety.ts` | resident meal safety | strong fail-closed behavior | preserve; add liquid/fluid tests |
| `server/src/engine/production.ts` | diet/IDDSI production logic | duplicated mapping; simplistic therapeutic transforms | centralize mappings; separate clinical vs operational transformations |
| `server/src/routes/production.ts` | production persistence | broad `any` schemas; side-effectful generation GET | strengthen API contracts |
| `server/src/routes/trayruns.ts` | meal execution/audit | transactional event state; important concurrency surface | expand failure/concurrency acceptance |
| `src/features/traydispatch/TrayDispatchPage.tsx` | frontline tray UX | polling; native prompt exception capture | accessible dialogs; facility UX pilot |
| `server/src/routes/kitchen.ts` | kitchen workflow | large route/business module | split gradually after safety coverage |
| `src/features/kitchen/TempLogPanel.tsx` | HACCP data entry | real generic temp logging | connect to complete HACCP workflows |
| `server/src/routes/hardware.ts` | devices/HACCP | safe 501s plus sample/scanner behavior | keep unsupported until real device acceptance |
| `server/src/routes/purchasing.ts` | financial/operational mutation | huge module; inconsistent authz risk | capability audit first; service extraction later |
| `server/src/routes/inventory.ts` | stock truth | ledger + materialized on-hand | reconciliation/transaction invariants |
| `server/src/db/migrate.ts` | database contract | broad schema, JSONB, audit/inventory history | document invariants; strengthen critical constraints |
| `server/src/db/pool.ts` | PostgreSQL/SQLite behavior | dual DB adapter | PostgreSQL-first critical acceptance |
| `server/src/middleware/requireAuth.ts` | auth boundary | strong persisted-session validation | preserve and expand tests |
| `server/src/middleware/permissions.ts` | capability policy | good fail-closed map but incomplete module adoption | make semantic capabilities universal for mutations |
| `server/src/middleware/tenantContext.ts` | facility isolation | one facility/database | make documentation authoritative; prevent accidental multi-tenant reuse |
| `server/src/routes/ehr.ts` | clinical integration boundary | real webhook/queue foundation | keep; add freshness/reconciliation tests |
| `server/src/integrations/pointclickcare.ts` | EHR claim | synthetic census | rename/guard simulator; implement real connector only after acceptance plan |
| `server/src/integrations/usda.ts` | nutrition claim | local/hardcoded nutrition + generic fallback | nonclinical label or real provenance provider |
| `server/src/integrations/broadline.ts` | vendor claim | seeded/mock pricing/catalog | explicit scaffold; one real vendor later |
| `server/src/routes/reporting.ts` | management decisions | fixed labor/cost assumptions | expose provenance/warnings; replace estimates with real sources |
| `server/src/routes/enterprise.ts` | commercialization | current facility only; not real multi-facility clinical tenancy | defer expansion |
| `server/src/routes/mcp.ts` | AI/tool gateway | gated but parked | keep writes disabled |
| `server/src/mcp/server.ts` | MCP behavior | stale resident query/mock order/self-heal risk | repair only after core product |
| `sdk/src/ShorelineClient.ts` | external developer surface | partial/stale API parity | contract-test against real server |
| `bin/shoreline.js` | CLI | demo/canned data; duplicate `culinaryos` identity | mark demo or rebuild as API client |
| `src/security/AuthContext.tsx` | frontend auth | canonical auth context | centralize all authenticated calls through it/client |
| `src/security/tokenManager.ts` | token storage | in-memory access token design | remove legacy token reads elsewhere |
| `src/features/offline/OfflinePage.tsx` | clinical offline safety | correctly fail-closed | preserve; clarify freshness/status |
| `src/sw.ts` | PWA cache | app/static cache surface | keep clinical mutation/data caching constrained |
| `.github/workflows/ci.yml` | release evidence | some jobs green, Windows test red | restore all green, then require checks |
| `.github/workflows/security-audit.yml` | dependency gate | high-severity audit red | capture advisories + remediate |
| `Dockerfile` | production packaging | Node 24 path | keep aligned with CI/runtime |
| `render.yaml` | Render deployment | stale Node 20 | P0/P1 deployment alignment |
| `railway.json` | Railway deployment | provider path | verify one provider end-to-end before claiming turnkey |
| `README.md` | product truth | integration/production claims ahead of code | claims-vs-reality rewrite |
| `ARCHITECTURE.md` | technical truth | older multi-facility/integration descriptions | reconcile with current one-facility and mock adapters |
| `STATUS.md` | current acceptance | older warnings now partly stale vs newer CI | update only from current evidence |

---

# 25. Scorecard

| Category | Score /10 | Grade | Notes |
|---|---:|---|---|
| Product clarity | 8.0 | B+ | strong core problem; breadth dilutes focus |
| Architecture | 7.5 | B | salvageable and mostly appropriate; no rewrite needed |
| Code quality | 6.5 | C+ | real TypeScript/Zod, but large routes/loose boundaries |
| Maintainability | 6.0 | C+ | growing route/domain complexity and duplicate rules |
| Frontend quality | 7.0 | B- | broad real UI; uneven polish |
| UX | 6.5 | C+/B- | good frontline intent; some technical/native-dialog roughness |
| Mobile/tablet usability | 7.5 | B | promising tray/kitchen design; facility acceptance needed |
| Backend quality | 7.5 | B | substantial real backend; boundary cleanup needed |
| API design | 6.5 | C+ | good base, inconsistent authz/semantics |
| Database design | 7.0 | B- | real migrations/history; JSON/dual-state risks |
| Security | 6.0 | C+ | good architecture but current audit gate red |
| Authentication/authorization | 7.0 | B- | auth strong; authz inconsistent |
| Healthcare dietary safety | 6.5 | C+/B- | strong fail-closed thinking; serious clinical gaps |
| IDDSI implementation | 5.5 | C | food textures exist; beverage consistency incomplete |
| Allergen handling | 7.5 | B | fail-closed tray behavior is strong; source quality matters |
| Compliance/documentation | 5.5 | C | audit structures good; claims/evidence drift |
| Testing | 7.5 | B | meaningful suites/CI; current head not fully green |
| Reliability | 6.0 | C+ | core promising; external/hardware acceptance weak |
| Error handling | 7.0 | B- | fail-closed examples are good; uneven across domains |
| Offline resilience | 7.0 | B- | safe limitation rather than unsafe offline clinical edits |
| Performance | 7.0 | B- | reasonable for facility scope; not deeply load-accepted |
| Scalability | 6.0 | C+ | one-facility architecture is fine; enterprise scaling not built |
| Deployment | 5.5 | C | Docker/backup evidence, but red gates/runtime drift |
| Documentation | 6.0 | C+ | extensive but materially ahead of reality in places |
| Integrations | 4.0 | D+ | mostly scaffolds/simulators |
| SDK | 5.5 | C | useful but partial/stale parity |
| CLI | 3.5 | D | demo rather than operational client |
| MCP/AI architecture | 4.5 | D+/C- | reasonable guardrails, but parked/stale/mock |
| Accessibility | 6.0 | C+ | intent exists; fresh comprehensive acceptance absent |
| Real-world kitchen usability | 7.0 | B- | strong direction; still needs real service pilot |
| Production readiness | 4.5 | D+/C- | advanced alpha; not release candidate |

**Current overall score: 61 / 100**  
**Potential after recommended remediation: 88 / 100**

Potential 88 assumes the product narrows scope, proves clinical safety/reliability, delivers one real EHR/vendor integration rather than many simulations, and runs successfully in a real pilot. It does not require replacing the stack.

---

# 26. Prioritized Remediation Plan

## P0 — Immediate

### P0.1 Restore green release evidence

**Problem:** current Windows test and high-severity dependency audit gates fail.  
**Why it matters:** all later product conclusions are weaker while `main` is red.  
**Solution:** reproduce Windows test failure, capture dependency advisories, remediate/mitigate, re-run all gates.  
**Affected:** CI, dependencies, potentially test environment.  
**Complexity:** Medium.  
**Dependencies:** none.  
**Acceptance:** all required CI/security jobs green on the audited head or successor commit; advisories documented.

### P0.2 Correct fluid-restriction clinical history/versioning

**Problem:** fluid restriction is mutable but excluded from clinical change snapshot/version/history.  
**Why:** stale profile versions and missing clinical trace.  
**Solution:** include field in canonical clinical snapshot/change/history and downstream tests.  
**Affected:** resident backend, history, UI timeline, tests.  
**Complexity:** Small-Medium.  
**Acceptance:** change produces version increment/history/audit; concurrent/stale update tests pass.

### P0.3 Introduce first-class liquid consistency

**Problem:** no structured beverage IDDSI/thickened-liquid order.  
**Why:** dysphagia safety cannot rely on free text.  
**Solution:** clinically governed field/model/history/UI/tray/production rules with migration.  
**Affected:** DB, resident API/types/forms, tray cards, production, history.  
**Complexity:** Large.  
**Dependencies:** clinical domain review.  
**Acceptance:** full update/history/tray test matrix and RD-reviewed allowed values.

### P0.4 Fix RD-review flag authentication path

**Problem:** feature reads obsolete localStorage token.  
**Why:** clinical escalation can fail despite valid login.  
**Solution:** use canonical authenticated API/client context.  
**Complexity:** Small.  
**Acceptance:** browser E2E proves flag creation under production auth model.

### P0.5 Audit every mutation for semantic authorization

**Problem:** authz varies across capabilities, ranks and auth-only routes.  
**Why:** inappropriate staff roles may mutate purchasing/inventory/operations.  
**Solution:** endpoint-capability matrix; fail closed; tests for deny/allow cases.  
**Complexity:** Medium-Large.  
**Acceptance:** every non-read endpoint has explicit policy and authorization tests.

### P0.6 Prevent mock/approximate clinical data from looking authoritative

**Problem:** PCC/USDA/vendor names imply live sources.  
**Why:** staff may trust stale/fake data.  
**Solution:** explicit simulator source metadata; production guards; UI source/freshness badges; fail closed where clinical.  
**Complexity:** Medium.  
**Acceptance:** production config cannot silently fall back to simulated EHR/nutrition/vendor data.

### P0.7 Align deployed Node runtime

**Problem:** Render requests Node 20.  
**Solution:** align to supported tested baseline and add provider smoke test.  
**Complexity:** Small.  
**Acceptance:** deployment uses same supported major as CI/container and passes health/migration smoke.

## P1 — Stabilize

### P1.1 Shared safety-domain contract

Unify IDDSI/diet enums and mapping across frontend/backend. Acceptance: one canonical source + contract tests.

### P1.2 Strengthen production schemas

Replace broad `any` rows/counts with explicit versioned schemas; make state-producing endpoints mutation verbs. Acceptance: malformed sheet data rejected.

### P1.3 Inventory ledger integrity

Define canonical stock truth, transactionality and reconciliation. Acceptance: injected failure/concurrent count tests cannot create unexplained on-hand drift.

### P1.4 Authenticated signoff identity

Bind compliance signoff identity to authenticated session. Acceptance: caller cannot impersonate another staff display name as authoritative signoff.

### P1.5 Refactor only high-risk oversized modules

Extract resident clinical, purchasing and inventory domain services under coverage. Acceptance: no behavior change; narrower unit/contract test boundaries.

### P1.6 Protect `main`

After green gates, require review/checks before merge. Acceptance: branch rules block red/unchecked changes.

### P1.7 PostgreSQL-first critical testing

Maintain SQLite for dev if useful, but require PostgreSQL for clinical/purchasing/inventory concurrency acceptance.

## P2 — Complete Core Product

1. dedicated cooling workflow with staged timestamps/limits/corrective actions;
2. dedicated reheating workflow;
3. structured shift handoff;
4. leftover/waste/reuse flow;
5. better dining-room/late-tray exceptions;
6. provenance-aware nutrition or explicit nonclinical nutrition mode;
7. clinically governed therapeutic-diet rule library;
8. complete audit/source/freshness display;
9. SDK/API parity tests;
10. truthful documentation matched to implementation.

## P3 — Operational Excellence

1. real kitchen/tablet UX pilot;
2. replace native prompts with fast accessible dialogs;
3. accessibility acceptance;
4. device abstraction for one accepted printer/probe path;
5. observability/runbooks/alerts;
6. long-history pagination/retention;
7. offline/read-only freshness experience;
8. packaged desktop acceptance where still required.

## P4 — Integrations

Order of work:

1. one real EHR integration (PCC only if access/market need justifies it);
2. one real broadline/vendor connector;
3. real nutrition provider/FDC where clinically appropriate;
4. real print/probe/scanner integrations;
5. additional vendors only after the integration contract is proven.

Every integration must define authentication, sandbox test, retry/idempotency, freshness, reconciliation, failure mode and audit behavior.

## P5 — Scale & Commercialization

Only after a successful facility pilot:

- multi-facility control plane;
- regional dashboards;
- enterprise identity/admin;
- billing/commercial polish;
- support/upgrade fleet management;
- broader observability/SLOs;
- additional integrations.

Do not redesign clinical tables into a shared multitenant database merely to market “enterprise.” Separate facility databases may remain a deliberate safety boundary.

---

# 27. Final Verdict — If I Inherited ShorelineOps Today

## I would keep

- React/Vite frontend;
- Express backend;
- PostgreSQL direction;
- resident domain and clinical-history concept;
- revocable session/auth foundation;
- capability authorization concept;
- one-facility-per-database boundary for now;
- tray safety fail-closed philosophy;
- production/tray/purchasing/inventory foundations;
- audit log;
- PostgreSQL acceptance/backup work;
- PWA offline fail-closed behavior;
- Docker/CI foundation.

## I would remove or retire

- `culinaryos` CLI alias from ShorelineOps;
- any production-facing language implying live integrations that are simulations;
- unsafe/dead hardware simulation paths rather than reviving them;
- obsolete auth-token access patterns;
- stale MCP paths if they cannot be repaired cheaply when MCP work resumes.

## I would rewrite

Very little wholesale.

I would **rewrite specific boundaries**, not the application:

- clinical snapshot/version registration;
- authorization policy attachment around mutations;
- approximate nutrition provider abstraction;
- SDK/API parity layer;
- selected oversized route internals under tests.

I would not rewrite ShorelineOps in Rust, another web framework, microservices, or a new database architecture.

## I would consolidate

- IDDSI/diet/shared safety types;
- authenticated API access on the frontend;
- clinical field version/history logic;
- inventory source-of-truth rules;
- integration simulator/source metadata;
- version metadata.

## I would finish

- liquid consistency;
- clinical-field auditing;
- HACCP cooling/reheating;
- real-world tray/dining workflows;
- release/security gates;
- backup/restore/runbooks;
- one EHR integration;
- one vendor integration;
- one hardware path if the pilot needs it.

## I would postpone

- autonomous MCP writes;
- multi-facility shared tenancy;
- broad AI features;
- additional vendor connectors;
- regional enterprise analytics;
- ambitious hardware ecosystem;
- new product modules unrelated to facility pilot success.

## Ten direct answers

### 1. Is the fundamental concept strong?

**Yes.** The clinical-to-kitchen connection is a real product problem and ShorelineOps has a coherent reason to exist separately from generic restaurant software.

### 2. Is the current architecture salvageable?

**Yes. Strongly.** I would evolve it, not rewrite it. The biggest issues are boundary discipline, safety completeness, integration truthfulness and acceptance—not a fatal stack choice.

### 3. What percentage of the envisioned product genuinely exists?

Approximately **60–65% of the functional vision has real implementation**, with roughly **45–55% at production-hardening depth**.

### 4. What percentage appears polished but incomplete underneath?

Approximately **20–25% of the visible/claimed surface**, concentrated in integrations, hardware, nutrition, enterprise/multi-facility, SDK/CLI and MCP.

### 5. Five highest-value improvements

1. complete clinical safety model/history, especially fluid restrictions and liquid consistency;
2. make authorization semantic and consistent on every mutation;
3. restore green CI/security/deployment parity;
4. make integration/data provenance truthful, then implement one real EHR/vendor path;
5. run real end-to-end facility workflow acceptance.

### 6. Five largest risks

1. incomplete/stale clinical dietary truth reaching meal service;
2. documentation causing users to trust simulated external data;
3. inconsistent mutation authorization;
4. operational deployment/release evidence not yet green;
5. product breadth continuing to expand before core workflows are proven in a real facility.

### 7. What is preventing production deployment?

- current red CI/security gates;
- fluid-restriction clinical history/version defect;
- missing liquid consistency model;
- incomplete authz review;
- mock clinical/vendor/nutrition integrations presented too strongly;
- deployment runtime drift;
- no accepted real facility/hardware/end-to-end clinical pilot.

### 8. What would I build next?

Nothing new first. I would execute P0 remediation, then build a **clinical end-to-end acceptance suite** proving:

```text
resident order change
→ clinical version/history
→ production generation
→ tray safety
→ service event
→ HACCP/audit evidence
```

under concurrent users and failure conditions.

### 9. What should NOT be built yet?

- more AI/MCP autonomy;
- more vendor adapters;
- broad multi-facility tenancy;
- more enterprise dashboards;
- new hardware families;
- another rewrite/framework;
- additional product scope unrelated to the pilot.

### 10. Is ShorelineOps worth continuing?

**Yes.** The codebase contains enough real operational software and several good safety/security decisions to justify continued development. The rational path is not expansion; it is to convert a broad advanced alpha into a narrow, boring, dependable facility product.

---

# TOP 25 ACTIONS — Exact Execution Order

1. **Reproduce and resolve the current Windows CI test failure; make the code/test gate green.**
2. **Capture the exact root/server high-severity npm advisories and remediate or explicitly mitigate them.**
3. **Fix fluid-restriction participation in clinical snapshot, versioning, history and audit tests.**
4. **Design and implement a clinically reviewed first-class liquid-consistency/thickened-liquid field and end-to-end workflow.**
5. **Fix RD-review/clinical flag submission to use the canonical authenticated API/token path.**
6. **Create a complete mutation endpoint authorization matrix and capability-gate purchasing, inventory, kitchen, admin and clinical writes.**
7. **Align Render/runtime configuration with the supported tested Node baseline and add deployment smoke evidence.**
8. **Keep MCP writes disabled; remove/repair stale resident queries, mocked action paths and unsafe auto-remediation defaults before any future enablement.**
9. **Make simulated/approximate PCC, nutrition, vendor and hardware modes unmistakable and impossible to silently use as production truth.**
10. **Prevent generic USDA fallback values from being used as authoritative clinical nutrition; implement provenance/fail-closed behavior.**
11. **Separate therapeutic-diet clinical rules from simplistic operational string transformations and put them under RD-governed tests.**
12. **Create one shared versioned safety contract for IDDSI/diet enums/mappings used by client and server.**
13. **Correct README/ARCHITECTURE/STATUS claims for PCC, USDA, vendors, hardware, real-time behavior, multi-facility and production readiness.**
14. **Protect `main` with required green CI/security checks once those checks are stable.**
15. **Strengthen production-sheet and other safety/operations mutation schemas; remove broad `any` where malformed data matters.**
16. **Correct REST semantics for state-generating GET routes and bind compliance signoffs to authenticated identities.**
17. **Define inventory ledger/on-hand source-of-truth semantics and add reconciliation/concurrency tests.**
18. **Reconcile SDK routes/types with the live server and add automated API-parity tests.**
19. **Either label the CLI explicitly as demo tooling or convert it into a thin authenticated API client; remove the `culinaryos` alias.**
20. **Add dedicated HACCP cooling and reheating workflows with time/temperature stages, corrective actions and audit evidence.**
21. **Build the complete resident safety acceptance matrix: NPO, allergen, food texture, liquid consistency, fluid restriction, stale updates and concurrency.**
22. **Run real tablet/kitchen UX and accessibility acceptance; replace native prompt exception flows with fast accessible structured dialogs.**
23. **Run a clean deployment/upgrade/rollback/backup/restore acceptance on the intended production platform and write the operational runbook.**
24. **After core acceptance, implement and certify exactly one real EHR connector and one real distributor connector before adding more integrations.**
25. **Run a limited real-facility pilot; only after pilot evidence decide whether to expand multi-facility enterprise, additional hardware, broader integrations or AI/MCP features.**

---

## Final audit conclusion

ShorelineOps should be continued, but its success depends on changing the development question from:

> “How many healthcare dietary capabilities can this platform claim?”

into:

> **“Can one facility trust it, meal after meal, to preserve the correct resident dietary truth and produce defensible evidence when something changes or fails?”**

The repository is close enough to that goal that a rewrite would be wasteful. The next work should make the existing core safer, more truthful and more operationally proven—not broader.
