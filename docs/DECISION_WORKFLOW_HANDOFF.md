# Decision workflow handoff — September 24, 2026

## Implemented

This follow-up preserves Muse's remediation commits through `826bb8b` and finishes the decision-boundary fixes.

- EHR decisions lock the queue and resident, apply supported changes, increment the profile version, and record before/after evidence atomically. Audit failure rolls back the decision. The UI uses the authenticated API client, shows the current profile, sends its reviewed version, and refreshes uncertain outcomes before another decision.
- Tray cards carry HMAC-signed resident/profile, menu, meal and date claims. Both scan verification and event persistence use `server/src/engine/traySafety.ts`. A successful scan alone cannot authorize a later write; the transaction checks current safety again and records an audit event. Legacy unsigned cards require reprinting.
- Purchase approval and line changes lock the parent order. Generic updates cannot set status; approved content is frozen, and vendor status changes require a submitted order. Only managers/admins confirm catalog matches. Current pack size and price are converted to the canonical unit for ranking; unknown or incompatible units are excluded.
- Clinical review panels expose missing evaluations. Shift operations contains navigation, not invented task completion. Shared labels and Radix dialogs provide associated controls and standard focus handling.
- `npm test` builds the server and runs system plus discovered regression tests in disposable local databases. It does not use deployment database credentials.

## Verified locally

- `npm test`: 228 system checks and 28 additional tests passing.
- `npm run typecheck`: passing.
- `npm run build:demo`: passing (marketing, demo, and application bundles).
- `npm run build:marketing`: passing.
- Regression coverage includes malformed and unsupported EHR payloads, stale review, role denial, duplicate approvals, audit rollback, signed tray tampering, changed clinical state at dispatch, missing safety tables, purchasing bypass routes, parent-scoped lines, and canonical price conversion.

## Operational limits and next acceptance work

- One facility per database remains the supported boundary. This is not shared-database tenant isolation. See [offline and isolation](OFFLINE_AND_ISOLATION.md).
- Tray verification intentionally holds residents with allergies until canonical allergen equivalence is available. Restricted diets, fluid restrictions, non-water beverages, missing/ambiguous recipes and unknown textures also hold. Matching a recipe's declared texture does not verify physical batch preparation. Restore service only through verified source data and facility procedures, never an override of the safety gate.
- Configure a stable `TRAY_SIGNING_SECRET` or use the existing `JWT_SECRET` fallback. Rotating the signing key invalidates outstanding tray cards; reprint them. Development without either uses a process-local key.
- EHR admission/discharge payloads remain unsupported for approval and stay pending. Rejection records a decision without applying a resident change.
- PostgreSQL locking paths compile but were not exercised against a live PostgreSQL server. Validate concurrent approval/edit and scan/clinical-update scenarios there before release.
- Browser/device, keyboard/screen-reader, camera/scanner hardware, real EHR/vendor integrations, and production deployment were not validated in this follow-up. Builds and synthetic local tests are not certification.
- No live TypeSafe/Jev integration was added. Future model output must remain advisory and cannot authorize clinical or purchasing actions.
