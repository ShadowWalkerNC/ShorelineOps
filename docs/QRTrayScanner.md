# Digital QR Tray Line Scanner

The `TrayAssemblyScanner` UI component (`src/features/kitchen/components/TrayAssemblyScanner.tsx`) integrates with the backend verification endpoint `POST /api/kitchen/verify-tray-scan`.

## Verification Flow
1. Kitchen printer outputs tray cards stamped with an HMAC-signed token:
   `TKT-<residentId>:<profileVersion>:<securityHash>`
2. At the plating line, the cook scans the card with a Bluetooth laser scanner or tablet camera.
3. The server compares `<profileVersion>` in the QR token with the live database record.
4. If a physician updated the diet order in the EHR 2 minutes ago, the scan is rejected with status `SUPERSEDED`.
5. Web Audio synthesizes an instant alert tone and the tablet vibrates, preventing delivery of the stale tray.
