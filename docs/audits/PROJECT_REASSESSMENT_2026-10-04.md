# Project reassessment and Muse SDK readiness

## Decision

The deployed website/demo/application release works in the tested browser flows. All plans are **not** complete. ShorelineOps remains a one-facility-per-database clinical nutrition system; adding an AI model or gadget SDK does not resolve recovery, clinical provenance, tenant isolation, or physical-device acceptance.

Keep TypeScript/Node and the current deterministic server-side safety and capability boundaries. No measured CPU hotspot justifies Rust migration. If a later device bridge needs Rust, isolate it from the authoritative clinical API and require authenticated device identity, fixed commands and physical acceptance.

## SDK additions

`tools/muse/` is a separate developer package, not a production server or frontend dependency. Spark uses pinned `openai@7.28.0` with Meta's documented `https://api.meta.ai/v1` Responses endpoint and `muse-spark-1.3`. The only provided live probe has fixed synthetic input, bounded output, 15-second timeout, no retries, no tool calls and `store:false`. No `.env` files, records, prompts or project files are loaded. Credential and provider error bodies are not printed. `store:false` is not a statement about all provider retention or healthcare contractual protections.

Gadget preparation is a Linux-only dependency manifest pinned to upstream commit `9f5ab2335b34b7f1017a728aa8beb9d0cf08de8f`. Its source checkout exists locally. No device installation, daemon, Bluetooth pairing, token generation or commercial deployment was performed. Windows is not its Linux device runtime. Current token terms restrict use to personal, non-commercial scenarios. Its generic shell/file commands run with the installed account's permissions, including sudo when available. Keep it outside the clinical server/network/data boundary.

Muse Code SDK drives agent sessions and is separate from the Spark model API. Muse CLI was not executed in this reassessment, following the user's instruction to work without it today.

Primary references: [Meta quickstart](https://dev.meta.ai/docs/quickstart), [Gadget source](https://github.com/facebookincubator/muse-gadget-sdk), [Gadget token terms](https://gadgets.muse.ai/sdk-terms).

## Severity and completion criteria

Additional onboarding finding: first-time setup previously committed facility initialization before owner creation and audit insertion, and could overwrite a matching existing account. Those writes now share a locked transaction and owner insertion cannot replace an existing account. Local production-mode tests passed audit-failure rollback, four-way initialization with one winner and usable-owner login; PostgreSQL setup-race acceptance remains pending. The wizard also prepopulates facility details and preaccepts a purported BAA. That is an unresolved P1 readiness issue: replace the purported agreement with explicit deployment acknowledgment and an actual approved contract process before clinical onboarding; preserve historical agreement records.

Severity describes consequence if a gap is ignored, not proof of an exploitable production vulnerability.

| Priority | Current evidence / issue | Proposed solution and completion gate |
|---|---|---|
| P0 / critical before clinical expansion | Canonical allergen equivalence, restricted diets, fluid restrictions and physical texture verification remain acceptance gaps. Existing gates intentionally hold uncertain trays. | Dietitian-reviewed canonical ingredients/recipes and restricted-diet fixtures; test NPO, allergy, stale-order and ambiguous-recipe rejection with independent clinical approval. Keep hard blocks. |
| P0 / high before Gadget commercial use | Token terms restrict commercial use; generic host commands/files would expand the trust boundary. | Obtain a suitable written commercial arrangement or use an alternative supported device protocol. Dedicated isolated non-sudo lab account; no application DB/secrets or resident data; no automatic shell daemon on clinical hosts. |
| P1 / high | Scheduled backups now require a restricted key file and authenticated AES-GCM artifacts; synthetic failure/tamper cases pass. Off-host retrieval, full database restore and measured RPO/RTO remain unproven. | Provision and escrow keys separately from artifacts, retrieve off-host backups and restore into isolated staging; verify completeness, signing/key recovery and measured downtime/data loss. Never reset live data. See `docs/ENCRYPTED_BACKUP_RECOVERY.md`. |
| P1 / high | SQLite regression success does not prove PostgreSQL race/locking behavior. The guarded command passed against PostgreSQL 16 in CI; coverage is currently migrations, stale tray rejection and simultaneous EHR decisions. | Run `npm run test:postgres` against an empty loopback database named `shoreline_acceptance`; the command accepts only explicit `SHORELINE_TEST_POSTGRES_URL`, rejects URL overrides and nonempty databases, and never falls back to SQLite. Current coverage is migrations, stale tray rejection and simultaneous EHR decisions; order/audit rollback and scan/update races still need PostgreSQL evidence. |
| P1 / high before scaling | One facility per DB is supported; idempotency uses process-local Maps. | Maintain separate facility DBs. Prove authorization scope, durable idempotency and job leasing before multiple API replicas/shared-database tenancy. Load-test meal-rush concurrency and shared-IP rate limits. |
| P1 / high, source fix locally verified | Protected requests now validate active persisted users and sessions, exact role/facility/platform claims and authentication version. Password/security changes atomically revoke sessions; logout deletes the session; refresh rotation has one winner. | Migration 029 is additive. Legacy access tokens require refresh/relogin; legacy MFA sessions without persisted proof require login. SQLite tests cover revocation, permission downgrade, refresh races and audit rollback. PostgreSQL auth races and hosted release acceptance still require verification. |
| P1 / high before Spark production data | API SDK imports and mocked transport work; no `MODEL_API_KEY` configured in this execution environment. Healthcare provider/data-processing suitability not assessed. | First run the fixed synthetic probe with authorized credentials. Any real advisory feature needs an explicit non-PHI schema, approved retention/contract boundary, server-only secrets, role checks, audit, bounded quotas/timeouts, and human review. AI cannot authorize clinical or purchasing actions. |
| P1 / medium | Real PCC/vendor/USDA/provider acceptance, camera/scanner, printer and physical mobile/PWA coverage remain unverified. | Vendor-authorized synthetic sandboxes and physical-device tests including duplicates, outages, denied permissions, print fidelity, recovery and reconciliation. Do not treat simulated data as live integration proof. |
| P1 / medium | Electron now launches the compiled production backend on loopback and serves `/app/login`; real Node and Electron subprocess tests pass. Signed packaged desktop acceptance is incomplete. | Verify Windows/macOS/Linux installers independently, including native dependencies, secure signing-key provisioning, per-user data protection and hardware permissions. See `desktop/README.md`. |
| P2 / medium | Application emits a large single-bundle warning; no measured meal-rush or low-end tablet performance baseline. | Measure cold/warm load, JS execution, long tasks and API tail latency on target tablets/network; then route-level code splitting and query/index work based on measurements. |
| P2 / medium | Public compliance/SLA/BAA/backup/export promises were qualified to current evidence; historical milestone headings still need interpretation as feature history. | Version roadmap entries as source/local/live/device evidence rather than blanket completed labels; obtain actual clinical/contractual acceptance before asserting guarantees. |

## Plan reconciliation

| Plan family | Disposition |
|---|---|
| Stitch/HIG whole-site rollout | Implemented and live at `43aa0e4`; prior whole-site 116 responsive checks and 14 representative live pages at two widths passed. This reassessment rechecked deployed services and public routes. Physical screen-reader/device acceptance remains separate. |
| September decision workflow implementation | Implemented locally; deterministic regression coverage passes. PostgreSQL, canonical clinical source evidence and physical devices remain open. |
| September/October security and infrastructure remediation | Bounded fixes implemented and tested. Encrypted recovery, shared-database tenancy, multi-replica durability and packaged desktop remain open. |
| Historical V1–V9 milestones | Historical feature/source milestones, not blanket production certification. Current handoffs and acceptance gates take precedence over old completed headings and route names. |
| Muse Spark integration | Isolated developer SDK and mocked transport tests added. Live connectivity NOT RUN because credentials are absent. No production AI endpoint exists. |
| Muse Gadget integration | Pinned Linux lab dependency preparation added. Runtime/device acceptance NOT RUN; commercial token use BLOCKED by current published terms. |

## Verification for this reassessment

### Readiness remediation follow-up

- PASS: `npm test`: 228 system checks, 164 regression tests and 3 compiled desktop subprocess tests, zero failures/skips.
- PASS: `npm run build:demo` and `npm run build:marketing` after public copy corrections.
- PASS: real installed Electron executable passed the same three desktop subprocess tests; this verifies current-machine backend/native SQLite compatibility, not a signed installer or rendered Electron UI.
- PASS: actual HTTP upgrade rejection, backup encryption/wrong-key/tamper/empty/output-preservation and synthetic Bash/Windows dump failure checks.
- PASS: isolated PostgreSQL 16 CI job at `b039d22`, run `37245532094`: all 28 migrations, 45-table schema integrity, stale signed tray rejection and simultaneous EHR decision acceptance (2 tests, no failures). This closes that bounded database proof; PO/audit rollback, true scan/update races and load remain separate.
- Removed: unused unauthenticated non-protocol kitchen streaming placeholder; existing HTTP workflows remain authoritative.
- PASS: real encrypted PostgreSQL 16 logical backup/restore at `14a7560`, CI run `37246671632`: all 45 tables and schema fingerprints, two residents, NPO/allergen/decision/tray invariants and append-only audit protection preserved. Restore took 854ms for the tiny synthetic fixture; this is not facility RPO/RTO.
- NOT RUN: off-host/key escrow retrieval, facility-sized recovery, real model/provider/device and cross-platform packaged acceptance.
- PASS: `b039d22` Railway marketing/demo/API deployments succeeded; 14 representative live routes at phone/desktop widths, recipe filtering, reporting reload and API readiness passed.
- Follow-up required: clean Linux CI revealed redundant workspace installs pruning frontend dependencies, outdated Node 20 tooling and patched dependency advisories. Corrected install/runtime configuration and dependency remediation are undergoing fresh validation; do not treat the initial full CI run as green.
- PASS: compatible patched dependency install, required demo/marketing builds, 228 system + 164 regression + 3 Node desktop checks, and all 3 desktop checks with installed Electron 43.7.7. Production dependency audits are zero; five development entries from the unpatched braces advisory remain documented in `DEPENDENCY_REMEDIATION_2026-10-04.md`.

The following initial SDK reassessment results precede these follow-up source changes:

- PASS: frontend typecheck and existing suite: 228 system checks plus 160 regression tests, zero failed/skipped. Counts describe different runners, not new independent certification.
- PASS: three SDK boundary tests: absent credentials never request; fixed synthetic request goes only to the official host without tools/storage; incomplete/unexpected responses cannot claim success.
- PASS: offline SDK check imports the installed Spark client; confirms no key configured and no production integration.
- PASS: OpenAPI documentation matches all 190 handlers.
- PASS: current Railway marketing, demo and API deployments are successful at `43aa0e4`; public homepage, demo `/login`, and API `/ready` return HTTP 200.
- NOT RUN: Spark real API, Gadget installation/pairing/hardware, clinical/provider/backup/PostgreSQL/load/platform acceptance listed above.

This audit uses source, synthetic local checks and limited read-only public health checks. It neither accesses real resident records nor changes production credentials, databases or hardware.

## Follow-up verification — 2026-10-05

- PASS: required demo and marketing builds, frontend typecheck, 228 system checks, 177 regression tests and 3 Node desktop subprocess tests after session revocation changes.
- Fixed the account-update PostgreSQL-only cast exposed by real SQLite admin-route tests. Audit-failure tests now exercise transaction rollback after a successful update rather than failing before the audit write.
- Clean Linux CI at 14a7560 passed production audits, Spark boundaries and real PostgreSQL restore, but failed the full test job due to missing generated SDK output and container readiness due to a libc-incompatible SQLite prebuild. Test startup now compiles the SDK; Docker builds SQLite against its runtime base. These fixes need a new hosted CI run before acceptance.
- SDK documentation now describes access JWT authentication accurately, uses the actual API host and distinguishes recorded API operations from device/provider/compliance acceptance.
- PASS: `8e7e83b` deployed successfully to all three Railway services. Live checks covered 14 representative public/demo/login routes at widths 390 and 1440, recipe filtering, reporting reload and API readiness; no resident records were accessed.
- PASS: Linux container readiness, isolated PostgreSQL decisions/restore and Spark SDK boundaries at `8e7e83b`, CI run `37294905208`. The main Linux job failed because Windows-only backup fixtures discovered Linux PowerShell. Those fixtures now select Windows explicitly, and CI includes a Windows build/test job so native ACL and batch execution acceptance remains required. New CI acceptance is pending.
- PASS: Linux full verification, PostgreSQL restore and Spark jobs at `c62bc78`, run `37295808850`. Windows and container acceptance were still running at this checkpoint.
- Logout follow-up: an expired bearer no longer prevents deletion of a possessed valid refresh credential. Authentication-service outages still fail closed. Required local builds and tests passed: 228 system checks, 178 regression tests and 3 desktop checks. New hosted verification remains required for this follow-up.
- Windows CI run `37295808850` timed out in the regression suite after its builds passed. Shell selection now explicitly uses Git Bash for Windows synthetic Bash fixtures, avoiding ambiguous PATH/WSL resolution; this is a candidate timeout fix pending hosted evidence, not a confirmed root cause.
- The guarded database acceptance suite now also exercises real authentication routes: four-way refresh rotation, stable session identity, downgrade revocation, denied clinical writes and expired-bearer logout. Local SQLite execution passed; PostgreSQL execution of this new case remains pending the next CI release.
- Railway marketing/demo/API deployments succeeded at `581f510`; deployment success does not itself prove real provider, device, clinical or recovery acceptance.
- PASS: PostgreSQL 16 authentication acceptance at `255af19`, run `37296622642`, job `111719245428`: four simultaneous refresh attempts had one winner; stable session identity, downgrade revocation, denied clinical writes and expired-bearer logout passed. All three database acceptance cases passed. Real encrypted restoration preserved all 45 tables, six audit records and the clinical invariants (851ms for the tiny CI fixture).
- PASS: Linux full verification, container readiness and Spark boundaries at the same release. Live representative routes/recipe filtering/reporting reload passed at 390 and 1440 widths, and the API deployment succeeded. Windows acceptance was still running when observed; it remains a required gate. A streamed single-process backup diagnostic step and bounded synthetic ACL setup will make any further stall attributable.
- At `f74d519`, Windows standalone backup diagnostics passed all 43 checks, but the full credential-free runner timed out again. The diagnostic now runs through `scripts/run-tests.mjs --backup-diagnostics` with exactly the same stripped environment and disposable working directory as the full suite. This diagnostic passed 43/43 locally. Hosted root cause and full Windows acceptance remain unresolved; no timeout increase or passing claim is substituted for them.
- At `4f35050`, the isolated backup diagnostic timed out on Windows too, reproducing the environment-dependent failure. The runner now preserves an explicit allowlist of Windows OS/home paths and command-discovery variables needed by native tools. Database, provider and application credentials remain excluded. This candidate fix requires hosted diagnostic and full-suite acceptance; local success alone does not close the issue.
