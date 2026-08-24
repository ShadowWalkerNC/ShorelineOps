# PointClickCare EHR Reconciliation Queue

The `EhrReconciliationQueue` component (`src/features/residents/EhrReconciliationQueue.tsx`) manages real-time HL7/FHIR dietary order updates from PointClickCare.

## Features
- **RD Triage Workstation**: Registered Dietitians review incoming diet texture or allergen modifications.
- **Side-by-Side Diff**: Highlights changes in swallowing capacity or fluid restrictions.
- **One-Click Approval / Rejection**: Applying an update immediately increments the resident profile version, invalidating all older printed tray cards.
