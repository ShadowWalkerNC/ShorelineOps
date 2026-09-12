# PointClickCare EHR Reconciliation Queue

The `EhrReconciliationQueue` component (`src/features/residents/EhrReconciliationQueue.tsx`) manages real-time HL7/FHIR dietary order updates from PointClickCare.

## Features
- **RD Triage Workstation**: Registered Dietitians review incoming diet texture or allergen modifications.
- **Side-by-Side Diff**: Highlights changes in swallowing capacity or fluid restrictions.
- **One-Click Approval / Rejection**: Applying an update immediately increments the resident profile version, invalidating all older printed tray cards.

## EHR census honesty & access gates (A04/A07)

The queue sits in front of the EHR routes (`server/src/routes/ehr.ts` + `server/src/integrations/pointclickcare.ts`). Wave A hardened what these endpoints do when the EHR is *not* there — the UI and any integrator must treat these states as first-class:

- **No fabricated census.** `GET /api/ehr/census` requires a valid JWT (`requireAuth`) **and** the enterprise tier. If the PointClickCare connector has no credentials configured (`PCC_CLIENT_ID`, `PCC_CLIENT_SECRET`, `PCC_FACILITY_ID`), it refuses with `503` and `code: "EHR_NOT_CONNECTED"` rather than serving invented data.
- **Stubs are labeled.** The built-in connector is a synthetic stub, so any payload it serves carries an explicit `demo: true` flag — the triage UI must never present it as live EHR census.
- **Inbound webhooks are signature-gated.** `POST /api/ehr/webhook` accepts only requests carrying `X-EHR-Signature: sha256=<hex>` — HMAC-SHA256 of the raw request bytes (`req.rawBody`) with `EHR_WEBHOOK_SECRET`. Missing/invalid signature → `401` and the rejection is audit-logged. If the secret is unset, the route refuses all traffic with `503` (fail closed). See [`WEBHOOKS.md`](WEBHOOKS.md) for the full inbound-webhook contract.
- **Role-gated resolution.** Queue items are resolved via `POST /api/ehr/reconciliation-queue/:id/resolve`, gated to `dietitian` / `admin` roles only — anonymous, bad-token, or insufficient-role calls get `403` and are audit-logged. The triage simulation endpoint (`POST /api/ehr/simulate-inbound-triage`) carries the same dietitian-or-admin gate.
