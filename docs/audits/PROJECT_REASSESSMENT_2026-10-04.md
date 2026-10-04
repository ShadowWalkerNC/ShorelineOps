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

Severity describes consequence if a gap is ignored, not proof of an exploitable production vulnerability.

| Priority | Current evidence / issue | Proposed solution and completion gate |
|---|---|---|
| P0 / critical before clinical expansion | Canonical allergen equivalence, restricted diets, fluid restrictions and physical texture verification remain acceptance gaps. Existing gates intentionally hold uncertain trays. | Dietitian-reviewed canonical ingredients/recipes and restricted-diet fixtures; test NPO, allergy, stale-order and ambiguous-recipe rejection with independent clinical approval. Keep hard blocks. |
| P0 / high before Gadget commercial use | Token terms restrict commercial use; generic host commands/files would expand the trust boundary. | Obtain a suitable written commercial arrangement or use an alternative supported device protocol. Dedicated isolated non-sudo lab account; no application DB/secrets or resident data; no automatic shell daemon on clinical hosts. |
| P1 / high | Backup scripts produce plaintext artifacts; encrypted restore and measured RPO/RTO are unproven. Partial row restore correctly remains disabled. | Encrypt protected off-host backups with separate keys; restore into isolated staging; verify completeness, signing/key recovery and measured downtime/data loss. Perform a supervised drill, never reset live data. |
| P1 / high | SQLite regression success does not prove PostgreSQL race/locking behavior. | Disposable PostgreSQL tests for concurrent EHR decisions, order approvals/edits and tray scan versus clinical update; prove atomic audit rollback and migration compatibility. |
| P1 / high before scaling | One facility per DB is supported; idempotency uses process-local Maps. | Maintain separate facility DBs. Prove authorization scope, durable idempotency and job leasing before multiple API replicas/shared-database tenancy. Load-test meal-rush concurrency and shared-IP rate limits. |
| P1 / high before Spark production data | API SDK imports and mocked transport work; no `MODEL_API_KEY` configured in this execution environment. Healthcare provider/data-processing suitability not assessed. | First run the fixed synthetic probe with authorized credentials. Any real advisory feature needs an explicit non-PHI schema, approved retention/contract boundary, server-only secrets, role checks, audit, bounded quotas/timeouts, and human review. AI cannot authorize clinical or purchasing actions. |
| P1 / medium | Real PCC/vendor/USDA/provider acceptance, camera/scanner, printer and physical mobile/PWA coverage remain unverified. | Vendor-authorized synthetic sandboxes and physical-device tests including duplicates, outages, denied permissions, print fidelity, recovery and reconciliation. Do not treat simulated data as live integration proof. |
| P1 / medium | Electron currently starts the development backend using `npm run dev`; packaged desktop acceptance is incomplete. | Launch compiled production backend with explicit port/lifecycle, packaged assets and recovery; verify Windows/macOS/Linux installers independently. |
| P2 / medium | Application emits a large single-bundle warning; no measured meal-rush or low-end tablet performance baseline. | Measure cold/warm load, JS execution, long tasks and API tail latency on target tablets/network; then route-level code splitting and query/index work based on measurements. |
| P2 / medium | Historical milestone and marketing compliance/SLA/integration claims exceed current acceptance evidence. | Reconcile claims to evidence and qualified contractual/clinical review. Version roadmap entries as source/local/live/device evidence rather than blanket completed labels. |

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

- PASS: frontend typecheck and existing suite: 228 system checks plus 160 regression tests, zero failed/skipped. Counts describe different runners, not new independent certification.
- PASS: three SDK boundary tests: absent credentials never request; fixed synthetic request goes only to the official host without tools/storage; incomplete/unexpected responses cannot claim success.
- PASS: offline SDK check imports the installed Spark client; confirms no key configured and no production integration.
- PASS: OpenAPI documentation matches all 190 handlers.
- PASS: current Railway marketing, demo and API deployments are successful at `43aa0e4`; public homepage, demo `/login`, and API `/ready` return HTTP 200.
- NOT RUN: Spark real API, Gadget installation/pairing/hardware, clinical/provider/backup/PostgreSQL/load/platform acceptance listed above.

This audit uses source, synthetic local checks and limited read-only public health checks. It neither accesses real resident records nor changes production credentials, databases or hardware.
