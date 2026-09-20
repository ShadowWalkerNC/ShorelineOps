# CulinaryOS product strategy and go-to-market plan

2026-09-20 · Proposal for founder decision, not permission to launch or take payments.

## Evidence and commercial judgment

**Verified:** ShorelineOps implements healthcare dietary workflows, not a general restaurant/POS product. Census, therapeutic diets, cycle menus, batch production, tray cards and purchasing dominate the repository (`README.md`; `src/App.tsx:67-126`; `server/src/engine/`). The founder specifies CulinaryOS LLC, while current legal pages identify Shoreline Operations LLC. The repository's pricing and legal documents are proposals, not evidence of revenue, executed contracts or support capability.

**Likely:** the most defensible initial product is a founder-supported, single-facility dietary operations tool. **Unknown:** customer commitments, willingness to pay, deployment ownership, buyer budget, required integrations and legal relationship between the two company names. **Risk:** clinical safety and trust defects documented in the [intelligence report](CULINARYOS_REPOSITORY_INTELLIGENCE_REPORT.md) prevent a real-resident or paid production launch now.

**Recommendation:** internal synthetic-data validation first; then, only after the relevant release gates pass, a small supervised design-partner pilot. Treat pricing, savings and differentiation below as hypotheses to test. Do not advertise clinical guarantees, guaranteed savings, live EHR/EDI or automated subscriptions while those remain unverified.

## Product strategy

### Positioning and customer

Proposed positioning: **“ShorelineOps by CulinaryOS helps a dietary team turn reviewed resident needs and menus into clear daily kitchen work, with printable outputs and visible exceptions.”** This describes the intended outcome; release copy must identify which parts have passed validation. It does not promise clinical judgment, certification or uninterrupted offline service.

**Assumption — first ideal customer:** a single 40–120-bed senior-care facility with one dietary manager, a named dietitian/clinical reviewer, a stable kitchen workstation/printer, and a willingness to run parallel paper checks. This is suggested by `docs/PILOT_GO_LIVE_RUNBOOK.md`, not established market traction. Select one facility category and jurisdiction with the founder; assisted living and skilled nursing have different obligations and buying processes.

The daily user is the dietary manager or cook; the clinical data authority is the authorized dietitian/nursing team; the economic buyer is the administrator/owner; IT/privacy and possibly a regional dining lead influence approval. Do not merge these into one persona. Initial acquisition should favor a reachable operator with a specific repeated problem over a large chain requiring integrations and procurement certification.

| Job to be done | Current alternative to investigate | Pain hypothesis | Desired measurable outcome |
|---|---|---|---|
| Convert reviewed census/diets into the day's production quantities | EHR printout plus spreadsheet/paper count | Re-keying, late changes, stale lists | Time to reviewed kitchen sheet; discrepancy count |
| Communicate restrictions at meal preparation and dispatch | Printed cards, whiteboard, verbal handoff | Unknown/stale restrictions mistaken for approval | Zero unresolved restrictions presented as safe; review turnaround |
| Prepare consistent menus and recipe yields | Binders and spreadsheets | Recipe scaling and change coordination | Correct portions and approved substitutions on first review |
| Reconcile stock with proposed orders | Vendor portal/order guide and manual par sheets | Pack-size mismatch and excess ordering | Manager-confirmed order accuracy; documented unit provenance |
| Recover during interruption or outage | Paper downtime binder | Staff lose access or duplicate work | Current approved paper fallback; measured recovery/reconciliation |
| Assemble operational evidence | Separate logs and binders | Missing context or provenance | Traceable records with reviewer/time/source, not a compliance guarantee |

Manual alternatives above are research hypotheses, not claims about every facility. Seasonal menus, census turnover, annual budgets, inspection pressure, staffing changes and meal-service peaks should inform interview scheduling and pilot duration; actual local patterns remain Unknown.

### Main loop and scope

Primary loop: authorized census entry/import → reviewed diet/restriction state → selected menu/recipe → quantity calculation → daily kitchen sheet/print → review/correction → durable return visit. Clinical meal authorization and tray dispatch remain held until the safety-specific acceptance cases pass.

Secondary use cases: manual par count, manager-approved CSV purchasing, HACCP recording with verified manual input, and evidence export. A sensor, vendor or nutrition lookup is supplemental; absence must not fabricate a successful result.

| Stage | Include | Explicit exclusions / gate |
|---|---|---|
| Internal MVP | Synthetic census, authorized changes, menus/recipes, daily sheets, truthful save/errors, print, tested bootstrap/auth | No real resident reliance, no paid service claims; close P0s first |
| Supervised pilot | One isolated facility, agreed data boundary, founder onboarding, reviewed core loop, paper fallback, backup/restore and support | Applicable privacy agreements and operational controls before PHI; three parallel meals and clinical sign-off per pilot runbook |
| Version1 | Repeatable supported installation, real account administration/recovery, durable audit/export, validated mobile/keyboard workflows, confirmed manual procurement | Every included workflow has release evidence; transparent operating hours and limitations |
| Later | Verified vendor/EHR exchange, multi-facility management, automated billing, richer cost analytics, selected hardware integrations | Customer pull, reliable isolation, provider contracts and integration tests precede launch |

Postpone broad HR/payroll, generalized restaurant positioning, plugin marketplace expansion, clinical AI, desktop packaging on every platform, and feature parity with large suites. Preserve existing useful code but remove unvalidated functionality from sales promises and operational navigation as an approved implementation batch.

### Competition, alternatives and differentiation

Research checked 2026-09-20. Vendor materials establish advertised offerings; they are not independent proof of their results or ShorelineOps demand.

| Alternative | Classification | Confirmed overlap / switching implication | Source |
|---|---|---|---|
| MealSuite | Confirmed direct category competitor | Senior-living profiles, menus, recipes, production and procurement; a broad feature checklist is not differentiation | [MealSuite senior living](https://www.mealsuite.com/senior-living) |
| MatrixCare MealTracker | Confirmed direct category competitor | Nutrition/menu planning, resident preferences and production guidance; established workflow integration is an adoption advantage | [MealTracker](https://www.matrixcare.com/nutrition-management/) |
| Existing facility EHR and vendor portals | Category alternatives / complements | Can remain systems of record or purchasing channels; actual products and contracts need discovery | Repository PCC/vendor connectors show intended coexistence, not confirmed customer installation |
| Spreadsheet + paper binder + printer | Manual alternative hypothesis | Familiar, flexible, immediate and low switching cost; software must beat its daily effort while preserving downtime usability | Validate through operator observation |
| Shared notes/group messages | Coordination alternative hypothesis | Easy handoffs, weak versioning/provenance; do not assume suitability for health data | Validate actual usage and facility policy |
| Do nothing / extend current suite | Economic competitor | No migration/training burden; switching requires a clear repeated advantage | Customer-discovery question, not market-size evidence |

Potential differentiation is **simpler onboarding, a transparent supported scope, reviewable printed output and accessible self-hosted core**, subject to implementation/licensing validation. Offline reliability and distributor independence can become strengths only after tests and genuine data provenance. Do not claim “cheaper” without total costs including hosting, training, support, devices and downtime.

Reasons to switch to validate: fewer repeated entries, faster kitchen-sheet preparation, clearer pending changes, easier staff training, and responsive founder support. Adoption barriers: source data cleanup, double entry without EHR integration, printer/device constraints, limited training time, security procurement and incumbent contract terms. Trust barriers: default credentials, safety-state bugs, unsupported compliance statements, unresolved seller identity and unproved recovery. The engineering roadmap directly addresses these before demand-generation spend.

### Customer discovery and evidence plan

1. Interview five operators across three independently recruited facilities; include dietary manager, clinical reviewer, frontline cook and buyer where possible. Ask for the last concrete workflow problem, current workaround, frequency, time/cost, budget owner and buying constraints. Use synthetic/redacted examples.
2. Observe at least two meal-preparation handoffs without collecting resident data. Record steps, interruptions, paper artifacts, device access and who approves changes. Do not ask users to invent feature lists.
3. Test a task-based prototype or repaired internal build: import ten synthetic profiles, correct a restriction, build a kitchen sheet, identify a failed save, recover after interruption. Measure task success and assistance needed.
4. Ask buyers to choose between maintaining their current process and a specifically scoped supported pilot at a stated price. Record objections and explicit commitments; expressions of interest are not purchase orders.
5. Proceed to a gated design-partner pilot only if at least three facilities report a similar recurring problem and at least two buyers agree to evaluate the scoped offer. These are proposed decision thresholds, not achieved metrics.

Savings measurement: collect a consented baseline and comparable post-pilot service periods; distinguish training time, staffing/census/menu changes and unplanned rework. Publish case studies only with permission, method and actual measured results. No current testimonial is assumed fabricated, but provenance must be established before reuse (`marketing/src/pages/index.astro:539-616`).

## Commercial model

### Pricing approach and proposed tiers

Recommend founder-led demonstration and scoped pilot rather than open self-service trial while onboarding, account recovery and billing are incomplete. A Community offering can support evaluation, but “free software” must not imply free managed support or validated PHI hosting. `LICENSING.md` currently quotes $199/$399 tiers; those prices are not validated willingness to pay, and the feature matrix conflicts with project enterprise-gating rules.

| Tier | Proposed offer | Price approach | Conditions |
|---|---|---|---|
| Community | Core single-facility operational software and docs; self-managed infrastructure | $0 software license only if the founder confirms authoritative license | Core safety never subscription-gated; do not promise managed backups/support |
| Supported single-facility pilot / V1 | Defined onboarding, supported deployment and validated core workflow | Test $199–$399 per facility/month as a hypothesis, with transparent separately quoted setup if needed | Not an offer until costs, contracts and safety gates reviewed; no per-resident safety restriction |
| Enterprise / integrations | Genuine scoped EHR/vendor integration or multi-facility service | Quote after discovery; no fixed $399 promise for unbounded integration/support | Explicitly unavailable until isolation, provider agreements, recovery and service coverage are proven |

Unit-economics worksheet per customer: price − hosting/database/backups − monitoring − payment fees − expected support hours × founder labor rate − onboarding amortization − contracted clinical/security review allocation. Track gross contribution and cash separately; no margin forecast is justified before these inputs exist. Set capacity to the number of facilities the founder can onboard and support within the contracted response window, not an arbitrary signup target.

### Pilot terms and delivery

Proposed early-adopter offer: a small number of design partners receive a written, time-limited evaluation scope, founder-assisted data preparation, training and weekly feedback review. Before paid reliance, pass the matrix, disclose limitations, agree support hours, and approve the contract/data boundary. A later paid pilot may use externally administered invoicing under contract; the app's Stripe scaffold must not be portrayed as a billing system. Do not promise free lifetime service or unlimited customization.

Founder onboarding checklist: confirm buyer/user/clinical approver → approve data/hosting boundary → validate printer/device → import and review authorized source data → rehearse changes/failures → parallel meal services → obtain sign-off → document handoff/support/fallback. Record first-value completion, not just account creation. Stop operational cutover if safety, provenance or recovery checks fail.

### Feature gating and subscription behavior

Keep census, essential diet safety, meal preparation and access to necessary operational records available through administrative billing disputes in accordance with the approved continuity policy. Gate optional commercial automation server-side using authenticated, signed, facility-bound entitlements. A caller-supplied unsigned key is not authorization (`server/src/middleware/requireTier.ts:10-30`). Establish one authoritative tier matrix consistent across contracts, UI and backend.

| State/change | Required behavior before automated billing is sold |
|---|---|
| Trial begins/ends | Explicit start/end and included services; no surprise charge or loss of essential safety function |
| Upgrade | Authorized request, disclosed charge/proration, durable provider→facility mapping; grant only after confirmed lifecycle event |
| Downgrade | Show effective date and excluded automation; preserve retained records and approved core continuity |
| Payment failure | Durable delinquent state, real notification/retry and owner follow-up; never claim message sent without delivery |
| Cancel | Confirm request and effective end date; provide export/support path and retention schedule |
| Reactivate | Reconcile provider state, prevent duplicate subscriptions, restore only authorized entitlement |
| Refund/dispute | Human review, documented responsibility and ledger; no automatic clinical lockout |
| Duplicate/out-of-order webhook | Idempotent durable event processing, ordering/reconciliation strategy; restart/replay tests |

Billing requirements: verify signature on raw bytes (already implemented), persist provider/customer/subscription/event IDs and current state, test crashes and replay, provide actual customer communication, and reconcile periodically. No card data should pass through application storage if a hosted provider flow is chosen. Provider and implementation selection needs founder approval; no new integration is selected by this audit.

### Support, success and retention

Support model: founder as named primary with an agreed backup person; published coverage hours and severity criteria; clinical emergencies remain governed by the facility's clinical/downtime procedures. Provide a real contact channel, redacted diagnostic instructions and ticket history. Do not solicit PHI in ordinary email or analytics. Test delivery only after explicit authorization to send messages.

| Signal | Proposed definition | Interpretation / action |
|---|---|---|
| Activation | Facility completes reviewed census→menu→sheet and returns successfully | Stronger than login; investigate assisted versus independent completion |
| Weekly retained use | Agreed core workflow completed on the facility's expected service days | Compare to operating schedule, not generic daily-active counts |
| Accuracy/trust | Pending changes understood; no rejected operation shown as success | Any false-safe outcome is a stop/review event, not a conversion metric |
| Support burden | Founder hours and repeated issues per facility/week | Feed simplification and pricing; do not hide labor in margin claims |
| Data quality | Source records reviewed and exceptions resolved by authorized staff | Avoid incentivizing empty/default records to improve a dashboard |
| Churn risk | Missing returns, ongoing double entry, blocked integrations, staff turnover or unresolved support | Conduct account review and offer export; do not infer cause from inactivity alone |
| Retention proof | Buyer chooses to continue after observing agreed operational outcomes | Separate renewal from discounts/contract inertia |

## Marketing website plan

Existing Astro pages: homepage, pricing, story, distributors, security, privacy and terms. Source has metadata/OG/JSON-LD, but generated homepage canonical/og:url is localhost. Enterprise CTA points to absent application route. Some testimonials and performance claims lack supporting evidence. Seller identity and source license conflict. References: `marketing/src/layouts/BaseLayout.astro:20-23`; `marketing/src/pages/distributors.astro:137`; `LICENSE`; `LICENSING.md`.

Every proposed public page must use the approved canonical domain, real links, unique title/description, appropriate heading hierarchy, accessible focus/contrast, accurate social metadata and truthful structured data. Add sitemap/robots and exclude private/demo account data from indexing. Confirm domain ownership and Search Console access separately; neither was verified. Optimize to measured LCP<2.5s, INP<200ms and CLS<0.1 at the75th percentile when field data is available; these are targets, not measured results. [Core Web Vitals guidance](https://web.dev/articles/vitals).

| Page / current state | Primary visitor | Goal / core message | CTA | Required sections | SEO opportunity | Conversion event |
|---|---|---|---|---|---|---|
| Homepage / exists | Dietary manager or administrator | Explain supported daily loop and stage | Request scoped demo | Audience, problem, actual screens, core loop, limitations, real proof when available | Senior-care dietary workflow, no unverifiable compliance keywords | demo_requested |
| Product / proposed | Evaluator | Show census→menu→sheet with review boundaries | View workflow / request demo | Task sequence, supported data, permissions, print/fallback, included/excluded features | Dietary production planning | workflow_demo_opened |
| Use case: daily kitchen sheets / proposed | Chef/CDM | Reduce repeated preparation work | See example synthetic sheet | Before/after process, source review, correction, print, tested limits | Senior-living kitchen production sheets | sample_output_viewed |
| Use case: reviewed resident needs / proposed | Dietitian/clinical lead | Explain authority, exceptions and safety controls honestly | Review validation approach | Roles, NPO/allergen holds, stale data, human review, known limits | Dietary handoff operations; no clinical-outcome guarantee | safety_overview_viewed |
| Pricing / exists | Buyer | Transparent validated scope and support cost | Discuss pilot | Tier inclusions/exclusions, setup, support, cancellation/export, FAQ | Facility dietary software pricing | pricing_inquiry_started |
| FAQ / proposed, may begin as pricing section | User/buyer | Resolve hosting/offline/training/support questions | Ask a question | Data handling, prerequisites, downtime, integration availability, commercial terms | Specific workflow questions | faq_contact_started |
| About CulinaryOS LLC / story exists | Buyer | Identify actual seller and founder background | Contact founder | Confirmed identity/DBA, relevant experience, mission, real contact | Branded searches | founder_contact_started |
| Contact/support / proposed | Prospect or existing customer | Route demo versus support with no PHI | Submit inquiry / support channel | Coverage, severity, allowed info, status link if available, fallback | Branded support | contact_submitted / support_requested |
| Login/setup / app exists; signup absent | Approved pilot staff | Use correct deployment safely | Login / approved setup | Accessible auth, recovery, deployment identity, status/errors; no fake signup | Private pages noindex | login_completed / onboarding_completed |
| Privacy / exists, review needed | Buyer/privacy lead | Describe actual data and processors | Contact privacy owner | Data types, purposes, recipients, storage, retention, rights/request process | Trust/navigation, not acquisition | privacy_contact_started |
| Terms / exists, review needed | Buyer/legal | Accurate seller and service obligations | Discuss agreement | Scope, fees, permitted use, support, termination/export, limitations, applicable terms | Branded trust | agreement_inquiry_started |
| Cookie/privacy notice / conditional | Any visitor | Actual browser storage/tracking choices | Manage choices if applicable | Necessary storage and any optional telemetry, jurisdiction review | Not an SEO acquisition page | privacy_choices_saved |
| Help/docs / existing Markdown, public UX proposed | Operator/admin | Complete known workflows and recover | Follow guide / contact support | First-use, error states, paper fallback, backup/restore, release notes | Task-based help searches with no PHI | guide_completed |
| Security / exists, rewrite needed | IT/privacy buyer | State implemented and independently verified controls separately | Request security information | Control scope, deployment responsibility, incident contact, evidence dates, no invented certifications | Branded security | security_inquiry_started |
| Distributors / exists, narrow | Operator/vendor evaluator | Explain manual CSV and future integrations accurately | See supported import spec | Formats, pack matching, approval, live/stub disclosure | Vendor CSV workflow only | import_guide_viewed |
| Blog/resources / defer | Future organic audience | Only publish useful reviewed operational guides | Read core product/use case | Named reviewer, sources, real examples, maintained dates | Validate demand before content investment | resource_to_demo |

Do not publish additional pages merely to expand navigation. Start by repairing existing claims, links and metadata; product/use-case/FAQ content may initially be sections on the current site. Legal policies require review against the actual operating model, not generic copy generation.

## Privacy-conscious analytics plan

No analytics provider is selected. Define the contract first and obtain privacy approval. Avoid resident names/IDs, diets, diagnoses, free text, raw URLs with query identifiers, uploaded records, credentials, session replay of clinical screens and billing details. Use generated facility pseudonyms only if approved; minimize timestamps/granularity and retention. Operational audit logs and marketing analytics have different access and retention needs.

| Funnel stage | Event | Trigger | Properties | Why it matters |
|---|---|---|---|---|
| Acquisition | landing_viewed | Consented/approved page view | page_slug, campaign_category, anonymous_session | Understand relevant traffic without PHI |
| Acquisition | demo_requested | Successful inquiry receipt, not button click | page_slug, segment_category, request_id | Measures reachable demand |
| Activation | onboarding_started | Authorized facility setup starts | pseudonymous_facility, deployment_type, app_version | Identify setup drop-off |
| Activation | onboarding_completed | Persisted setup + successful return/login | pseudonymous_facility, elapsed_bucket | Avoid counting failed setup as success |
| Activation | first_value_completed | Reviewed synthetic/approved core output saved and rendered | facility_pseudonym, workflow_type, assisted_boolean | Track real outcome rather than account count |
| Engagement | kitchen_sheet_completed | Successful persisted core workflow | facility_pseudonym, app_version, duration_bucket | Measure repeat value without resident details |
| Engagement | operation_failed | Application surfaces a failure | operation_enum, safe_error_code, online_boolean, app_version | Prioritize reliability; sanitize payload |
| Engagement | pending_work_resolved | Server acknowledges approved queued work, if implemented | operation_enum, delay_bucket, outcome_enum | Measures truth of future offline claim |
| Conversion | pilot_agreed | Signed pilot recorded by authorized owner | facility_pseudonym, offer_version, channel | Separates discussion from commitment |
| Conversion | subscription_activated | Durable reconciled billing confirmation, when implemented | plan_id, facility_pseudonym, provider_event_id | Not inferred from checkout click |
| Retention | weekly_core_use | Derived aggregate meeting expected schedule | facility_pseudonym, week, completed_days_bucket | Meaningful recurring work |
| Retention | renewal_decided | Buyer confirms continue/cancel | plan_id, tenure_bucket, coded_reason_optional | Demand evidence; no free text in analytics |
| Support | support_requested | Ticket/inquiry receipt | category_enum, severity_enum, app_version | Measure support demand and recurring friction |
| Support | support_resolved | Verified resolution | category_enum, elapsed_bucket, reopened_boolean | Cost and satisfaction proxy |

Verification: inspect synthetic payloads, schema-allowlist properties, test blocked telemetry/network failure, avoid duplicate event on reload/retry, honor approved consent choices and deletion/retention rules. Do not add an analytics SDK until provider/data decisions are approved. Weekly founder review should compare activation, retained use, unresolved defects, support time and paid commitments—not vanity pageviews alone.

## Decisions required

### Decision Required: Initial customer and pilot data

#### Why this matters

Healthcare workflow and data sensitivity determine safe scope, evidence requirements and sales cycle.

#### Current evidence

- README and code target senior care; general restaurants/food trucks are not the current product.
- Critical clinical/auth defects remain; production privacy controls and demand are Unknown.
- [HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html) links ePHI use to safeguards, risk analysis and applicable business associate arrangements.

#### Option A — Synthetic single-facility validation first

- Benefits: fastest safe learning, smaller scope and lower integration burden.
- Costs: does not yet prove real service or revenue.
- Risks: synthetic tasks may miss operational edge cases.
- Complexity: lower; requires later gated real-world validation.
- Long-term implications: core contracts can stabilize before broader rollout.

#### Option B — Commit now to real-resident launch preparation

- Benefits: validation targets actual operating conditions.
- Costs: clinical/privacy/security/hosting and support preparation before any cutover.
- Risks: longer lead time; unsafe to deploy before blockers close.
- Complexity: high, even for one facility.
- Long-term implications: clearer production obligations and higher ongoing support.

#### Recommendation

Option A now, with the facility category chosen explicitly. This is not permission to use PHI later.

#### Founder decision needed

Which first facility category should the pilot serve, and do you approve synthetic-only validation until the clinical/privacy release gates pass?

### Decision Required: Seller identity and source license

#### Why this matters

Buyers need a consistent contracting party and distribution rights; code gates alone do not define a commercial license.

#### Current evidence

- User names CulinaryOS LLC; marketing terms name Shoreline Operations LLC.
- Root LICENSE is MIT; LICENSING.md lists AGPL/Apache, and other pages mix names.
- Ownership, DBA arrangements and executed agreements are Unknown; qualified legal review is needed.

#### Option A — CulinaryOS LLC as confirmed seller, ShorelineOps as product

- Benefits: matches founder's brief and simplifies messaging.
- Costs: approved updates across policies, contracts, notices and support.
- Risks: cannot assume ownership or registration facts.
- Complexity: modest copy work after legal facts established.
- Long-term implications: coherent company/product architecture.

#### Option B — Retain another legal seller / documented relationship

- Benefits: may preserve existing legitimate agreements if they exist.
- Costs: explain relationship and update inconsistent branding.
- Risks: confusion if the relationship is not documented.
- Complexity: depends on actual entities and rights.
- Long-term implications: multiple-brand administration.

#### Recommendation

Confirm Option A or document the actual relationship; separately establish the authoritative license with counsel before changing license notices. Do not silently relicense existing contributions.

#### Founder decision needed

Is CulinaryOS LLC the contracting/data-processing entity for ShorelineOps, and which source license and commercial rights are actually authorized?

### Decision Required: Pilot billing and service commitment

#### Why this matters

Current billing code verifies webhooks but does not manage durable subscriptions or actual notification delivery.

#### Current evidence

- `server/src/billing/stripeEngine.ts:66-126` is a lifecycle scaffold.
- `LICENSING.md` has unvalidated $199/$399 prices and broad promises.
- Competitor offerings establish a paid software category; no direct evidence establishes these prices or customer demand.

#### Option A — Founder-administered contracted pilot after gates

- Benefits: fewer technical dependencies, explicit scope/support and customer learning.
- Costs: manual invoicing/reconciliation and founder time.
- Risks: inconsistent administration unless documented.
- Complexity: lower than self-service SaaS, still requires agreements and accurate records.
- Long-term implications: migrate to automation after repeatable demand.

#### Option B — Complete automated subscriptions before selling

- Benefits: standardized lifecycle and eventual scale.
- Costs: durable billing architecture, integration and lifecycle tests.
- Risks: premature expense before validated demand.
- Complexity: L–XL with provider and account decisions.
- Long-term implications: stronger scale foundation when operations are ready.

#### Recommendation

Option A for a small gated pilot; quote support capacity honestly and validate price. Neither option authorizes payments in this audit.

#### Founder decision needed

Should the first paid offer use manually administered contracts/invoices, and what support hours and facility capacity can you commit to?

## Launch sequence and measures

1. Now: close safety/auth/save/admin/CI blockers; correct unsubstantiated claims; confirm segment and seller. Keep demonstrations synthetic.
2. Next: complete reproducible core acceptance, supported deployment, backup/restore, account recovery, browser/mobile/accessibility and incident drills. Recruit design partners without promising unavailable capabilities.
3. Pilot: scope-approved onboarding, parallel service and clinical sign-off, regular feedback, actual support response and operational measures. Pause rollout on safety or data-integrity failure.
4. Paid launch: demonstrate repeatable activation, retained use, buyer commitment and support economics; complete contract/billing/monitoring/privacy gates. Designate a release candidate and then produce the release gate report.
5. Later: invest in integrations or shared SaaS only for repeated customer demand with provider and isolation evidence.

## Status

- **Current phase:** Audit / strategy proposal complete.
- **Current objective:** Define a narrow, credible path to customer validation and paid delivery.
- **Work completed:** Positioning, scope, alternatives, commercial hypotheses, pages, analytics and decision cards.
- **Files inspected or changed:** Repository/marketing/evidence reports reviewed; this document added.
- **Verified findings:** Healthcare focus, incomplete commercial lifecycle and contradictory identity/claims.
- **Likely findings:** Single-facility daily production loop is the best initial focus.
- **Assumptions:** Proposed facility range, pilot approach, price range and discovery thresholds.
- **Open risks:** Demand, support cost, privacy/hosting obligations, legal rights and operational acceptance.
- **P0 blockers:** See intelligence report; no commercial plan overrides clinical or security gates.
- **Founder decisions needed:** Segment/data boundary, seller/license, pilot billing/support and repair approval.
- **Checks run:** Source/manifest review and primary-source public research; local baseline in intelligence report.
- **Checks passed:** Documented build/system baseline only; no commercial conversion proof.
- **Checks failed or not run:** Buyer research, price tests, signed pilot, live billing and public-site release QA not performed.
- **Recommended next action:** Approve the first bounded repair batch and answer decision cards.
- **Confidence level:** Medium for scope recommendation; low for pricing/demand until customer evidence exists.
