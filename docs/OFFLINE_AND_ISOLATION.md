# Offline Contract & Facility Isolation

## Offline behavior by deployment

ShorelineOps has two distinct connectivity stories. They are not the same,
and the UI must never present one as the other.

| Situation | What works | What does not | Required UI state |
|---|---|---|---|
| Device connected to the facility LAN server, no internet | Current records, saves, tray verification against the local server | Anything requiring the public internet | Normal operation; the offline page explains local-server operation |
| Device disconnected from any server | Cached app shell and static assets only | Loading current records, saving work, verifying trays | Offline page: reconnect to the facility server before acting; hold unverified trays |
| Reconnect after an outage | Recorded outcomes must be re-checked before retrying | Assuming a queued tap was saved | Downtime procedure + `npm run drill:failure` |

API responses are intentionally excluded from the service-worker cache
(`src/sw.ts`, `NetworkOnly`): clinical and account payloads may contain
PHI, and serving them stale would present outdated safety decisions as
current. There is no disconnected-mutation queue: any control that cannot
reach the server reports pending/unknown rather than success.

## Facility isolation

This release supports **one facility per database** (`SHORELINE_FACILITY_ID`):

- Credentials issued for another facility are rejected with `403 FACILITY_SCOPE_MISMATCH`.
- `X-Facility-Id` switching is rejected with `403 FACILITY_SWITCH_DISABLED`.
- Covered by `server/src/facility-scope.test.ts`.
- Migrating or splitting a mixed multi-facility database is out of scope;
  shared-database multi-tenancy must not be assumed.
