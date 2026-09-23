# Public Claim-to-Evidence Register (F12)

Each public claim below links to its current evidence or states its limit.
Narrow the copy when the evidence column cannot support the claim.

| Public claim | Evidence / status |
|---|---|
| Local operation on the facility network | Supported when the deployment runs a facility server; OfflinePage documents the boundary. See `docs/OFFLINE_AND_ISOLATION.md`. |
| Access controls and approval workflows | EHR reconciliation is dietitian/admin-gated and atomic; purchasing lines are draft-bound with manager approval. Covered by `system.test` and route-level role checks. |
| Facility data separation | Single facility per database, enforced in `tenantContext` (`403` on mismatch/switching). Covered by `facility-scope.test.ts`. Multi-facility shared databases are not supported. |
| Catalog price comparison | Compares desk-confirmed equivalents in compatible units with current prices. Fuzzy matches are labeled "name similarity" and need review. |
| Managed hosting, backups, compliance | Defined per service agreement, not by the software alone; the facility owns access policy, clinical procedure, and privacy obligations. |
| Accessibility of decision controls | Dialog behavior, associated labels, and 44px+ targets on shared components. Full keyboard/screen-reader matrix is acceptance work, not a certified result. |
| TypeSafe / AI assistance | No live model integration ships. Any future use is suggestions-only behind deterministic blocks, after a measured shadow evaluation. |
