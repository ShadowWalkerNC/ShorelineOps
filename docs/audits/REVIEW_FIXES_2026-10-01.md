# Remediation review fixes — 2026-10-01

Implementation review checklist, not acceptance evidence. No deployment is authorized. Preserve unrelated work and deterministic clinical controls.

## Security

- Protect idempotency JSON capture from Express `res.json` calling `res.send`: cache one logical response, preserve object/array/string response type and 204 semantics. Real HTTP replay must deep-equal its original object. Replayed JSON strings must remain strings without double serialization.
- `/kitchen/traycards-generated` signs cards: require kitchen execution/printing capability, excluding readonly and activities, even though its method is GET.
- Clinical CSV import writes diet, texture, NPO and allergies. Restrict `residents.import` to dietitian/manager. An admin role must not acquire clinical-write authority through import.
- Legacy hardware tray printing must not default unknown fluid consistency to Thin, print NPO/inactive residents as serviceable, or replay an obsolete clinical job. Prefer disabling this endpoint with an explicit unavailable response until it shares the validated signed tray contract; retain the canonical kitchen tray generator. Do not silently fabricate safe recipe/clinical fields.
- Complete all reporting budget/clinical permissions; no vendor PHI. Current JWT claims do not establish immediate account/session revocation; document any remaining token-expiry limitation accurately.

## Deployment and backup

- Reject duplicate `host` query parameters or derive the exact installed pg parser target. `?host=localhost&host=` is remote under pg parsing but was local under the draft helper.
- A globally routed IPv6 address ending in private IPv4 notation is not local. Only recognize genuine IPv4-mapped addresses in the mapping branch; test `2001:db8::10.0.0.1` is rejected for plaintext.
- PowerShell ACL strings need `${OwnerSid}` and `${AdminsSid}` braces. `"*$OwnerSid:F"` incorrectly references the variable `OwnerSid:F`. Restrict temporary artifacts before writing; synthetic successful and failed dumps must exercise real ACL handling.
- Require explicit backup database user/name matching deployment; do not use silently mismatched defaults. Protect temporary files, validate nonempty uncompressed dumps, do not use TTY, publish only successful output and never rotate on failure.
- Make external DATABASE_URL override actually available if documentation promises it; otherwise document the exact override-file procedure. URL-safe raw DB credentials and encoded URL credentials must not be confused.
- Optional nginx must be disabled by default unless configured, proxy the unified application instead of serving an unmounted static directory, use the correct nginx config mount, and not advertise unconfigured HTTPS.
- Include Render readiness and backup exclusions in Git/image context. YAML structure and pg ConnectionParameters tests must inspect effective behavior, not source keywords.

## SQLite portability

- Preserve numbered binding: translate `$n` to SQLite `?n`, not anonymous `?`. A synthetic in-memory probe reproduced repeated/reordered parameter corruption.
- Add disposable-database tests through pool for repeated/reordered parameters, resident search and report date filters. Keep PostgreSQL behavior untouched; remove unsupported casts from portable reporting queries rather than broadly rewriting SQL semantics.

## Completion

Run typecheck, demo build, marketing build, and the full isolated test runner after edits. Run independent read-only review of changed work. Document remaining live PostgreSQL concurrency, encrypted restore, device, accessibility, load, desktop packaging and production acceptance as NOT RUN unless actually exercised.
