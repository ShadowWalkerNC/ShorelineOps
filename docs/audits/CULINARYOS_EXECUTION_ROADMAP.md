# CulinaryOS execution roadmap

Audit date: 2026-09-20. Mode: audit only. This is a proposed sequence, not authorization to implement or a delivery commitment. Current recommendation: internal testing with synthetic data. No release candidate has been established; do not create a release gate report until an identifiable candidate and deployment target exist.

## Evidence and planning basis

**Verified:** demo, marketing and server builds and lint passed in this audit; the isolated SQLite system run reports 228 passed, zero failed. See `build-demo.log`, `build-marketing.log`, `build-server.log`, `lint.log` and `system-test.log` in this folder. `runtime-probe.log` records health 200, setup status 200 and unauthenticated residents 401, but also acceptance of an MFA-pending-purpose token: this is a security failure, not a passed authentication gate. These checks do not establish browser journeys, PostgreSQL parity, production operation or clinical safety.

**Verified:** `dependency-audit.json` flags 11 package findings (one critical, five high, five moderate). **Unknown:** deployed reachability and exploitability; triage before selecting fixes. The CI server step is missing `run`/`uses` in `.github/workflows/ci.yml`; passing local builds do not establish a working hosted pipeline.

Finding IDs below refer to [Security/data evidence](SECURITY_DATA_EVIDENCE.md) and [Product/UX evidence](PRODUCT_UX_EVIDENCE.md), which contain source paths and line references. Additional P0: `server/src/agent/healer.ts:78-90` automatically assigns missing clinical diet/texture to Regular/Regular; `server/src/index.ts:252` schedules the agent every five minutes. Unknown clinical orders must require authorized review, never become presumed unrestricted diets.

**Likely:** one isolated facility's census → reviewed menu → daily kitchen sheet is the smallest useful product loop. **Assumption requiring founder confirmation:** begin with synthetic data and founder-led onboarding, deferring shared hosting, live EHR/EDI and self-service subscriptions. **Risk:** a narrow scope still needs all authentication, clinical and recovery controls applicable to that scope.

P0 means a launch blocker; P1 is required before paid launch or promptly after only where the gate explicitly permits it; P2 is subsequent value; P3 is optional. Conditional P0 work applies when that capability is included. Estimates: XS under two hours; S up to half a day; M 1–3 days; L 3–7 days; XL over one week, substantial uncertainty, or a major founder decision. Estimates are effort ranges, not delivery promises. Owner roles are accountabilities a founder may combine, not hiring requirements. Independent clinical and security review should be obtained where the founder cannot verify those risks.

Maintain one issue per task ID with status, evidence link and decision owner. Limit active implementation to one small batch. Milestone numbering groups outcomes; urgent P0 containment in later milestones precedes new feature work.

## Milestone 0 — Establish Baseline

Exit: repeatable evidence, bounded environment and explicit issue register; no readiness claim inferred from green builds.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M0.1 Record checkout and repeatable check baseline | P0 | QA / Release | Changes can be compared against known behavior | None | S | Commit/dirty state, Node/package versions, commands, exit codes and isolated DB path recorded; preserve current passing logs | Reproduce demo, marketing, server builds, lint and 228-test baseline in disposable storage; separate type-check evidence |
| M0.2 Reproduce supported local runtime and environment contract | P0 | Backend / DevOps | Setup works without undocumented secrets | M0.1 | M | Required versus optional variables, demo restrictions and SQLite/PostgreSQL startup paths documented; no secrets in examples; setup actually completes in disposable DB | Clean-install startup/setup/login smoke, readiness and restart; current health/setup-status probes are only partial evidence |
| M0.3 Create actionable blocker inventory and journey baseline | P0 | Product / QA | Highest harm is fixed before cosmetic work | Evidence appendices | S | Every P0/P1 finding has owner, linked task, acceptance test and scope; screenshot evidence marked unavailable until captured | Trace SEC/CLIN/DATA/UX IDs to issues; capture synthetic desktop/mobile flows when browser available |
| M0.4 Repair and validate CI workflow | P0 | DevOps | Broken changes cannot silently bypass checks | Founder approval for delivery configuration; M0.1 | S | Invalid server step has an executable action; required builds/lint/tests run on clean checkout; failures block merge | Workflow validation plus actual CI run and retained logs; no reliance solely on local checks |
| M0.5 Triage dependency advisories and license inventory | P0 | Security / Dependency reviewer | Known package risk is understood before exposure | Audit JSON, manifests/locks | M | All 11 flagged packages classified by dependency path, runtime/build exposure, fix and residual risk; license obligations inventoried | Advisory-specific reproduction or applicability analysis; targeted upgrades and full applicable checks after approval |

## Milestone 1 — Define and Complete the Core Value Loop

Exit: an authorized operator can produce an accurate daily kitchen sheet from reviewed source data, with truthful save and safety states.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M1.1 Validate first customer and meaningful outcome | P1 | Product / Hospitality operator | Product addresses a costly real task | Founder segment decision | M | Interview target facility operators about census/menu/service handoffs, current alternatives, adoption and purchasing; document evidence separately from hypotheses | Observe workflow and have operators define first-value completion and acceptable effort |
| M1.2 Isolate demo seed from real bootstrap (SEC-01) | P0 | Backend / Security | Real installs contain no public sample accounts | Approval; M0.2 | M | Production refuses demo seed, synthetic records and credential logging; explicit isolated demo remains possible; existing seed exposure gets remediation checklist | Clean production boot has zero seeded users/residents; explicit demo test; existing account/session review without exposing passwords |
| M1.3 Make admission/import/edit safety consistent (CLIN-01) | P0 | Backend / Clinical QA | NPO and allergy restrictions survive every entry path | Approval for authorization/data changes | L | Same clinical role policy and normalization for create/CSV/edit; NPO/fluid restrictions persist; no override of NPO/allergen blocks | Role-by-ingestion matrix, persisted flag checks and tray denial; explicit NPO and NPO-diet variants |
| M1.4 Stop inferred unrestricted clinical orders | P0 | Backend / Clinical reviewer | Missing orders stay visibly unresolved | Approval; healer source evidence | M | Scheduled healer cannot assign Regular/Regular for missing orders; unresolved data blocks applicable service pending authorized review; changes auditable | Run scheduled/manual healer on missing diet/texture fixture and assert no fabricated order or allowed unsafe tray |
| M1.5 Make saves and scanner results truthful (UX-01/02/06) | P0 | Frontend / QA | Operators can distinguish saved, pending and rejected work | M1.3; common authenticated client | L | API rejection never becomes local success; scanner failures stay HOLD with no success chime/assembled tracking; deliberate offline status explicit across core stores | 401/403/409/422/500/offline tests, reload and second-device checks, stale ticket scan; demo simulation isolated |
| M1.6 Complete one daily workflow and feedback states | P1 | Full-stack / UX / Operator | Census → menu → kitchen sheet yields trusted first value | M1.1–M1.5 | L | Durable records, actionable loading/empty/error/success states, reviewed quantities and printable output; restrict unvalidated clinical execution | Operator-led end-to-end walkthrough including corrections, interruption, return visit and failed reporting fetch (UX-12) |

## Milestone 2 — SaaS Foundations

Exit: identity and data ownership are real, not simulated; only the founder-approved commercial model is implemented.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M2.1 Reject MFA-pending tokens as access credentials (SEC-02) | P0 | Security / Backend | MFA actually protects resident access | Approval for auth changes | M | Explicit purpose/audience accepted only for completed access tokens across all consumers; pending enroll/verify tokens only work on intended endpoints | Repeat failing runtime probe, require 401 on residents/recipes/EHR/auth-me/custom JWT paths; completed authorized login remains valid |
| M2.2 Choose isolated deployment or genuine tenancy (DATA-01) | P0 | Founder / Architect / Privacy | One facility cannot access another | Founder decision card; approval | XL | Initial deployment restricted to one facility per DB/API or full authenticated tenant model delivered; header alone grants no ownership | Document restriction and enforce setup/config; shared option requires concurrent cross-tenant CRUD/search/export/cache/job denial tests |
| M2.3 Replace simulated administration (UX-03) | P0 | Backend / Frontend / Security | Role changes and deactivation affect real accounts | M2.1; M2.2; approval | L | Authorized server-backed identity management, durable audit and revocation; remove unavailable controls until implemented | Create/change/deactivate test account, reload, verify role denial and previously issued session behavior |
| M2.4 Harden onboarding, account recovery and session lifecycle | P1 | Backend / Onboarding UX | Owner can start, return and recover securely | M0.2; M2.1; approval for email/auth | L | Blank credentials and unchecked agreement (UX-05), atomic retryable setup with stable IDs (DATA-02); defined recovery/invite/email-verification need and delivery; logout/refresh tested | SQLite and PostgreSQL setup fault injection; replay/expired recovery/invite cases; concurrent refresh and logout tests |
| M2.5 Define data ownership, export and deletion | P1 | Privacy / Database / Support | Customer can retrieve data and understand retention | M2.2; PHI decision | L | Document controller/processor roles, export authorization, deletion/retention exceptions, backup expiry and offline cache boundaries | Isolated export/deletion tests incl. ownership, attachments/cache and recovery copies; legal review of stated policy |
| M2.6 Implement only approved entitlement/payment model (COMM-01/BILL-01) | P0 if subscriptions; P1 otherwise | Founder / Billing / Security | Purchases reliably map to agreed service | Commercial model and seller decisions; approval | XL | Signed facility-bound entitlements; either documented manual contract/invoice process or durable checkout/customer/event/subscription lifecycle; no false notification claims; essential service continuity specified | Tamper/expiry tests; if subscriptions: provider test-mode duplicates/out-of-order/crash/reconciliation, upgrades/cancel/reactivate and actual notifications |

## Milestone 3 — Production Hardening

Exit: release-critical behavior has adverse-case evidence, and recovery can be performed by the actual operator.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M3.1 Fail closed at startup and transport (SEC-03/DATA-03) | P0 | DevOps / Backend | Incomplete or misconfigured service does not accept work | Approval; M0.2 | M | Strong secret required in production, certificate verification on, readiness 503 until migrations/bootstrap complete; fatal migration failure stops service | Missing/short secret, bad certificate, failed/parallel/interrupted migration tests; deployed readiness smoke later |
| M3.2 Make clinical writes atomic and versioned (CLIN-02) | P0 for clinical use | Database / Clinical QA | Kitchen does not act on stale restrictions | M1.3; schema approval | L | Resident/history/provenance/audit/version agree atomically; fluid-only change increments version; concurrency and future-effective behavior defined | Fault injection and concurrent updates; stale tray invalidation; SQLite/PostgreSQL parity |
| M3.3 Review API security boundaries and failure contracts | P0 | Security / Backend | Unauthorized or malformed requests cannot change data | M2.1–M2.3 | L | Route-level role/ownership/input validation, custom token consumers, CORS/CSRF model, uploads, rate limits and safe errors inventoried; unresolved exploitable P0 closed | Negative API matrix, abuse/rate tests, secret/log review and targeted independent security assessment |
| M3.4 Prove backup and restore (OPS-01/UX-07) | P0 for real customer data | Database / Operations | Work can be recovered after failure | Storage/deployment decision; approval | L | Supported DB backup, correct UI token client, checked process exit codes, protected off-host copy, failure alerts; named owner and RPO/RTO | Restore synthetic backup into isolated DB; row/integrity/application checks and timed drill; never overwrite live data in verification |
| M3.5 Establish useful monitoring and incident response | P1 | SRE / Support / Privacy | Failures are detected and communicated | Deployment/privacy decisions; integration approval | M | Health, errors, job failures and capacity alerts have owner; logs redact PHI/secrets; short incident/escalation and rollback runbooks | Inject safe test failure, prove notification delivery and redaction; tabletop incident and rollback |
| M3.6 Validate accessibility, mobile and slow-network behavior (UX-08) | P1 | Accessibility / Mobile UX / QA | Rushed operators can complete work on real devices | Stable M1 loop | L | Keyboard/focus/labels/dialogs/contrast meet practical WCAG 2.2 AA review; 44/48px targets and safe areas; explicit offline/stale states | 320px/390px/tablet/desktop measurements, screen-reader pass, interrupted/slow requests, physical kitchen-device session |
| M3.7 Measure and improve performance without hiding failures | P1 | Performance / Database | Daily workflow remains responsive at realistic census | M1.6; synthetic workload | M | Baseline bundle/API/query/DB growth recorded with agreed budgets; public CWV targets treated as targets, not claims | Throttled mobile and realistic facility-load tests; query analysis; compare before/after and retain artifacts |

## Milestone 4 — Marketing and Conversion

Exit: every published capability and commercial promise is supported or explicitly limited.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M4.1 Correct claim, testimonial and integration truth (UX-04/09; INT-01) | P0 before promotion | Founder / Marketing / Privacy | Buyer understands actual capability | Evidence appendices; publication approval where needed | M | Remove/qualify unsupported compliance/SLA/offline/live-integration absolutes; verify testimonial permission/outcomes or omit; route and API limits match promises | Claim-to-evidence register; review homepage/security/terms/pricing/distributor copy against shipped scope |
| M4.2 Resolve legal seller and policies | P0 before commercial contracting | Founder / Legal / Privacy | Customer knows contracting and data-handling entity | CulinaryOS versus Shoreline entity decision | XL | Approved company/DBA identity consistent in terms/privacy/footer/contracts; data processing/BAA/vendor obligations decided for actual data and deployment | Qualified review of published documents and agreement process; no claim that source code proves compliance |
| M4.3 Complete focused pages, CTAs and sales/support path | P1 | Marketing / UX / Support | Visitor can assess fit and reach a real person | M1.1; M4.1–M4.2 | M | GTM page inventory complete; missing /enterprise CTA fixed; login/demo/contact/support paths real; pricing and trial/manual sales boundary explicit | Link and form/mailbox delivery checks, mobile visitor-to-contact walkthrough, response ownership test |
| M4.4 Verify SEO and social output (UX-11) | P2 | Technical SEO / Frontend | Public pages are discoverable and accurately shared | Approved domain and content | M | Production absolute canonical, useful unique metadata/OG, sitemap/robots and truthful structured data; private app indexing rules | Inspect generated output and deployed HTTP responses; crawl links and share-preview validation |
| M4.5 Add privacy-conscious funnel measurement | P1 | Product Analytics / Privacy | Founder learns where adoption fails | Event taxonomy; privacy and integration approval | M | CTA, activation, workflow completion and retention events have definitions; no resident names/diets/IDs or PHI in analytics payloads | Inspect network payloads, consent/disable behavior and duplicate handling; verify test events reach usable dashboard |

## Milestone 5 — Private Beta Readiness

Exit: explicitly scoped, supported beta with known limitations; real clinical data requires all applicable safety/privacy gates first.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M5.1 Prepare invite and first-value onboarding runbook | P1 | Customer Success / Founder | Pilot users reach value with bounded support effort | M1–M3 relevant gates; customer approval | M | Named pilot cohort, data restrictions, onboarding checklist, permissions and first-value target; no open unsafe clinical use | Supervised clean-account rehearsal with representative operator |
| M5.2 Establish feedback, bug reports and support procedure | P1 | Support / Product | Users receive help without sharing sensitive data insecurely | M3.5; M4.3 | S | One support intake, severity rubric, response windows, escalation and sanitized report template; founder time budget explicit | Submit test report through actual channel and follow to closure |
| M5.3 Publish beta scope, limitations and release notes | P1 | Product / Docs / Release | Users know what is and is not dependable | Selected candidate scope | S | Versioned supported workflows, excluded integrations/offline writes, known issues and recovery/contact instructions | Operator comprehension review and consistency check against UI/marketing |
| M5.4 Execute release matrix and private-beta gate | P0 | QA / Release / Clinical reviewer | Beta does not rely on untested critical journeys | M0–M5 applicable tasks | L | Candidate commit/environment identified; P0 closed; matrix includes browser, permissions, failure, backup and production smoke evidence; remaining P1 explicitly dispositioned | Run CULINARYOS_RELEASE_TEST_MATRIX.md; only now create release gate report; retain actual screenshots/logs and reviewers |

## Milestone 6 — Paid Launch Readiness

Exit: a concrete candidate passes the agreed paid-launch gate; commercial collection does not outrun operational capability.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M6.1 Validate deployed release, rollback and recovery | P0 | DevOps / Release / Database | Paid service can be operated and restored | Approved deployment; M3.4–M3.5; beta evidence | L | Candidate artifact/commit and environment identified; secrets, TLS, readiness, monitoring, backup schedule and rollback verified; documented migration reversibility | Deployment smoke, alert test and isolated restore; rehearsal rollback with data-compatibility checks |
| M6.2 Validate commercial lifecycle end to end | P0 | Billing / Founder / QA | Charges, access and cancellation match terms | M2.6; M4.2; model approval | L | Approved invoice or subscription path has reconciliation/refund/support procedure; self-service only if durable lifecycle proven; sales claims truthful | Test-mode payment/lifecycle scenarios or manual invoice-to-entitlement rehearsal; no live charge without authorization |
| M6.3 Confirm launch content and support capacity | P1 | GTM / Support / Founder | Customers know limitations and receive promised help | Beta outcomes; M4 complete | M | Approved pages, onboarding/help/release notes, support hours and escalation; price hypothesis revised using discovery and pilot evidence | Full buyer-to-first-value rehearsal and support load review; no invented testimonials or outcome metrics |
| M6.4 Perform paid-launch release gate review | P0 | Founder / Release / Security | Launch decision rests on current evidence | M6.1–M6.3; release candidate | M | Gate report covers all 27 requested dimensions; no open P0; P1 disposition scoped and owned; acceptable risk cannot override clinical safety rules | Review current candidate matrix/build/security/privacy/accessibility/performance/billing/operations evidence; founder records exact launch category |

## Milestone 7 — Post-Launch Operations

Exit: recurring operating responsibilities fit founder capacity and feedback changes the roadmap.

| Task | Priority | Owner Role | Customer Outcome | Dependencies | Estimate | Acceptance Criteria | Verification |
|---|---|---|---|---|---|---|---|
| M7.1 Run daily service and backup review | P1 | Operations / Support | Failures are caught before repeated customer harm | Authorized launch | S to establish | Short health/error/job/backup/support checklist, named coverage and escalation; sensitive data excluded from summaries | Retained dated checklist and alert follow-through; recurring drills at agreed interval |
| M7.2 Review activation, retention and customer feedback weekly | P2 | Product / Founder | Repeated operator friction gets fixed | M4.5; pilot/paid usage | S to establish | Small dashboard of time-to-first-value, repeat workflow completion, support load and renewal signals; no assumed business impact | Weekly evidence-linked decisions and customer interviews; distinguish small-sample anecdotes from trends |
| M7.3 Maintain security and dependency response cadence | P1 | Security / Engineer | Newly discovered risk is handled promptly | Inventory and incident owner | M to establish | Advisory intake, severity-based response times, patch verification and dependency/license inventory refresh | Exercise sample advisory from discovery through triage/fix/release; verify rollback and customer communication criteria |
| M7.4 Review roadmap and operational cost monthly | P2 | Founder / CTO / Customer Success | Product remains affordable and maintainable | Usage/cost/support evidence | S to establish | Compare customer value, reliability work and founder hours; prune unsupported scope; optimize activation before expanding segments | Monthly decision log with measured costs, churn reasons and next smallest batch |

## Now / Next / Later / Do Not Start Yet

- **Now:** approve a bounded first implementation batch; close seed/MFA blockers, then clinical normalization/healer/scanner/save failures; repair CI and dependency triage. Keep all testing synthetic. Correct public claims before further promotion. Decide single-facility and PHI boundary.
- **Next:** prove the core loop, real administration, atomic clinical data, recoverable setup, backups, mobile/accessibility and supported onboarding. Prepare a restricted beta only after its applicable gates pass.
- **Later:** tune performance and conversion with measurements; expand validated CSV workflows and retention improvements; add integrations only where paid customer demand and maintenance capacity justify them.
- **Do Not Start Yet:** shared multi-tenant SaaS, live PCC/EDI, corporate syndication, plugin marketplace, broad HR/payroll, framework rewrite, clinical AI decisions, public paid launch or live payments. These depend on founder choices, partner access, customer demand and safety/reliability evidence. Do not expand offline write promises until reconciliation is implemented and tested.

## Recommended first implementation batch — pending founder approval

**Customer outcome:** a real installation does not inherit sample credentials, and resident data cannot be accessed before MFA completion. **Technical goal:** M1.2 + M2.1 only; urgent clinical blockers are the next batch and remain release blockers.

Expected files: `server/src/index.ts`, `server/src/db/seed.ts`, `server/src/routes/auth.ts`, `server/src/middleware/requireAuth.ts`, other direct JWT consumers identified by search, focused existing test suites, setup/demo documentation and this roadmap. Inspect test placement and token consumers before committing the exact patch scope. Avoid unrelated schema, billing, provider or UI changes.

Risks: seed gating may change demo bootstrap; token purpose checks may invalidate old sessions. Assess existing installs for seeded users and token/session exposure, with a separate owner-approved remediation procedure; never silently delete records. Prefer reauthentication over weakening validation. Rollback must preserve the seed/MFA protections; do not restore the insecure code path as a convenience. No migration expected, but confirm during implementation.

Acceptance: fresh production DB has no seeded accounts/residents or password logs; explicit demo still works in its isolated context; MFA-pending enrollment and verification tokens fail every access-token endpoint; completed authorized sessions work. Re-run the runtime negative probe and targeted auth/seed regressions, then required `npm run build:demo`, `npm run build:marketing` and `npm test` before any commit, plus server build/lint relevant to the patch. Update evidence, issue status and next batch proposal. The user's request explicitly requires approval before authentication and other major implementation changes; no such changes are authorized by this roadmap.

## Decision Required: Initial facility isolation and data boundary

### Why this matters

The choice determines privacy obligations, recovery responsibilities and whether tenancy is a launch prerequisite. Restricting shared hosting does not remove clinical safety obligations.

### Current evidence

- DATA-01: caller-supplied facility headers and unscoped resident queries do not provide tenant isolation.
- `server/src/db/pool.ts` supports two storage paths with unverified parity; OPS-01 lacks an executed recovery drill.
- Clinical census/diet data exists in the product. Executed hosting agreements, intended production PHI use and deployed environment are unknown.

### Option A — Synthetic internal validation, then an isolated single-facility pilot

- Benefits: smallest operational and isolation surface; fits founder-led support.
- Costs: separate deployment/database administration per pilot; clinical/privacy gates still required before real data.
- Risks: manual operations and mistaken environment sharing.
- Complexity: lower initially; explicit restrictions and restore proof needed.
- Long-term implications: later shared hosting requires a separately approved migration/design.

### Option B — Shared multi-facility SaaS before pilot

- Benefits: centralized operation and eventual onboarding scale.
- Costs: ownership schema, authenticated membership, transactions/scoped queries, jobs/caches/exports, isolation tests and migration work.
- Risks: cross-facility data exposure if boundaries are incomplete.
- Complexity: XL and unsuitable for a quick launch claim.
- Long-term implications: creates a scalable model only after comprehensive isolation proof.

### Recommendation

Choose A for initial validation. Continue synthetic-only testing until safety, privacy, recovery and hosting requirements are reviewed. Select one supported deployment/storage combination for the first pilot and prove it; do not silently remove advertised support for the other path.

### Founder decision needed

Approve isolated single-facility pilots, or require shared tenancy before any pilot? Will the first external pilot use synthetic data only or real resident information, and which deployment/storage target must be supported? Legal seller and billing model decisions are tracked in the GTM plan and M2.6/M4.2.

## Status

- **Current phase:** Audit only.
- **Current objective:** Define a founder-maintainable path to a credible launch.
- **Work completed:** 43 proposed tasks across milestones 0–7; dependencies, acceptance and verification defined.
- **Files inspected or changed:** User request, both evidence appendices and parent audit results; this roadmap added.
- **Verified findings:** Passing local check baseline; MFA-purpose runtime failure; source-backed safety, seed, tenancy and truthfulness defects.
- **Likely findings:** Single-facility dietary workflow is the smallest useful product boundary.
- **Assumptions:** Synthetic first, founder-led onboarding; neither is a confirmed commercial decision.
- **Open risks:** Production state, real customer demand, PostgreSQL parity, privacy/hosting agreements, actual billing and recovery remain unverified.
- **P0 blockers:** Seed credentials, MFA purpose, clinical ingestion/healer/scanner/save truth, simulated admin, CI; tenancy/shared hosting and subscription billing conditional on scope; unsupported public claims before promotion.
- **Founder decisions needed:** First batch approval, target/data/deployment boundary, legal seller and payment model.
- **Checks run:** Parent audit ran builds, lint, disposable SQLite tests, dependency audit and runtime probe; this document introduces no executable changes.
- **Checks passed:** Demo/marketing/server builds, lint, 228 system tests; limited health and unauthenticated probes.
- **Checks failed or not run:** MFA-pending access was accepted; dependency audit flagged 11 packages; deployed/browser/restore/payment/clinical acceptance not established.
- **Recommended next action:** Founder approval of the concrete seed-isolation/MFA batch, followed by clinical fail-closed repairs.
- **Confidence level:** High on cited source defects and local results; moderate on sequencing; low on deployment and commercial outcomes until verified.

## Implementation update — approved security batch 1

The founder approved the proposed first batch. M1.2 (seed isolation) and M2.1 (pending-MFA separation) have implementation and dedicated regression suites; final results are in [SECURITY_BATCH1_IMPLEMENTATION.md](SECURITY_BATCH1_IMPLEMENTATION.md). The first-batch proposal above is retained as historical scope, no longer an unanswered approval request. Clean-owner/refresh UUID and timestamp fixes support SQLite bootstrap/auth acceptance without a schema change. Existing sample accounts/data are not removed.

Next bounded batch remains M1.3/M1.4/M1.5: clinical admission/NPO preservation, removal of automatic unrestricted clinical defaults and fail-closed scanner/save behavior. These remain release blockers. No production deployment is authorized by batch 1 approval.
