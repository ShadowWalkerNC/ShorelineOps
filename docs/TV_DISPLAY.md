# TV Wall Display — Facility Operator Guide

Read-only wall boards for dining rooms, nurse stations, and the kitchen pass:
today's menu (Choice A/B), a meal countdown, production sign-off progress,
today's tray flow as counts, the staff schedule, and meal-count aggregates.
No data entry, no resident data on screen.

- Web UI: `/tv/menu`, `/tv/status`, `/tv/schedule`, `/tv/setup` (`src/features/tv/`)
- Server API: `server/src/routes/tv.ts` (pairing + wall feeds)
- Native shell: `android-tv/` (sideloaded APK, hosts the web UI in a WebView)
- Tests: `server/src/tv-display.test.ts`

## 1. What the wall display shows

| Board | Content | Source |
|---|---|---|
| **Menu board** (`/tv/menu`) | Today's breakfast, lunch and dinner (Choice A/B + dessert), next-meal countdown | Existing `menu.read` endpoints (payloads carry no PHI) |
| **Kitchen status** (`/tv/status`) | Production sheets total / signed-off / pending; today's tray runs, assembled, dispatched, delivered, missed, remade; meal counts (census + diet/texture breakdowns); kitchen crew | `GET /api/tv/ops-today`, `GET /api/tv/meals-today`, `GET /api/tv/crew-today` |
| **Schedule** (`/tv/schedule`) | Today's dietary shifts by Morning / Midday / Evening block with stations; call-out coverage banner | `GET /api/tv/schedule-today` |
| **Setup** (`/tv/setup`) | Pairing, meal times, unpair | TV-local + pairing API |

Boards auto-refresh (menu 60s, status/schedule 30s) and fall back to the
last-good snapshot with an honest stale banner when the server is
unreachable. D-pad Left/Right cycles boards; Up/Down scrolls.

### Counts only — no resident PHI, by construction

- `GET /api/tv/ops-today` returns **aggregate counts only** (`COUNT` /
  `GROUP BY` over status columns):

```json
{
  "date": "2026-10-28",
  "facilityName": "Shoreline",
  "production": { "total": 12, "signedOff": 9, "pending": 3 },
  "trays": {
    "runs": 4, "assembled": 180, "dispatched": 150,
    "delivered": 140, "missed": 2, "remade": 1
  },
  "generatedAt": "2026-10-28T14:00:00.000Z"
}
```

- `GET /api/tv/meals-today` returns the active census plus diet-type and
  texture breakdowns as **numbers only** — no names, rooms, or allergies:
  `{ "census": 54, "diets": { "Regular": 38, "NAS": 9 }, "textures": { "Regular": 47, "Pureed": 4 } }`.
- `GET /api/tv/schedule-today` returns today's shifts (staff names,
  positions, shift blocks, stations) plus call-out **counts** per shift and
  an uncovered total. Call-out reasons, notes, and replacement names stay
  server-side. Shift data lives in the `shifts` table (migration `033`);
  the demo seed posts a rolling 7-day roster.
- The display **never** shows resident names, rooms, diet orders, allergies,
  or tray cards. If a screen ever shows resident-level data, treat it as a
  defect: power off the display and report it.

## 2. Hardware guidance

- **Facility-owned Android TV boxes.** Any maintained Android TV / Google TV
  stick or box with HDMI and Wi-Fi works.
- **One reference device for pilot.** Qualify a single model first, validate
  the full flow below, then buy the same model for remaining walls. Mixed
  fleets are fine later, but pilot on one device.
- The TV needs **line-of-sight to your Shoreline server** (same LAN/VPN as
  the web app). No touchscreen, camera, or microphone is required.
- **Physical-device trust:** mount the box out of reach (behind the panel or
  in a locked media box). The board is public by design, and the box holds a
  revocable display session (see §7).

## 3. Install

1. **Build the APK.** From `android-tv/`, run
   `.\gradlew.bat :app:assembleDebug` (uses the repo-local portable
   toolchain; Android Studio also works — see `android-tv/README.md`).
2. **Sideload.** Enable *Settings → Apps → Install unknown apps* for your
   file manager / `adb`, then `adb install -r app-debug.apk`.
3. **Set the server URL.** First launch opens the native setup screen;
   enter the Shoreline server base URL
   (e.g. `https://meals.yourfacility.local` or `http://192.0.2.10:3001`).
   The shell loads `<server-url>/tv/menu`.
4. The board opens `/tv/setup`: confirm **meal times** (§5), name the wall,
   and pair (§4).

No Play Store listing is needed for facility-owned boxes.

## 4. Pairing steps (TV shows code, manager approves in web app)

Pairing binds the TV to the approving manager's facility with a
display-scoped session. Codes are **single-use** and expire after
**10 minutes**; at most 200 may be pending server-wide. Only the TV that
requested a code can collect its session (claim secret).

1. On the TV (`/tv/setup`), name the wall and choose **Show pairing code**.
   The TV calls `POST /api/tv/pair/request` (rate-limited) and displays a
   code such as `K7Q2ME` with a countdown. The alphabet excludes
   confusable characters (no `I`, `L`, `O`, `0`, `1`).
2. A staff member with the **manager role or above** opens **`/tv/approve`**
   in the web app (e.g. `http://server:3001/app/tv/approve` — the TV shows
   the exact URL under its code) and enters the code. This calls
   `POST /api/tv/pair/approve`. **Approve only codes physically shown on
   a facility TV** — never a code relayed by message.
3. The TV polls `GET /api/tv/pair/status` until it receives its session,
   then opens the menu board.
4. Each approval is written to the audit log (`TV_PAIR_APPROVE` with the
   approver, display label, and facility).

**If the code expires:** request a fresh code on the TV. Old codes can never
be reused.

## 5. Meal-time configuration (TV-local settings)

Countdowns and board highlighting run off **TV-local settings** stored on
the box (`/tv/setup`), so each wall matches its dining room without a
server round-trip.

| Meal | Default |
|---|---|
| Breakfast | 07:30 |
| Lunch | 12:00 |
| Dinner | 17:30 |

Format is 24-hour `HH:MM`; changes take effect immediately. Keep the box on
automatic date/time — a wrong clock shows the wrong countdown but never
affects server data.

## 6. Revoking a display

Display sessions belong to the reserved `TV Display` user
(`tv-display+<facility-slug>@shoreline.local`, role `readonly`):

1. **Revoke one wall:** choose **Unpair this display** in `/tv/setup`
   (clears tokens on the device), or
2. **Revoke all walls at a facility:** in Admin → user accounts,
   **disable** the `TV Display` user, or **bump its `auth_version`** to
   invalidate outstanding tokens at once.

Disabling is sticky: pairing refuses while the identity is disabled, so
re-enable the user before re-pairing replacements. Revoked boxes fall back
to the pairing screen.

## 7. Security notes

- **Display-scoped sessions.** TVs authenticate as the facility's
  `TV Display` user (random unguessable password) with a signed `display`
  claim. The server denies display tokens on every route except the TV
  allowlist (auth refresh, menu/production/trayrun reads, the ops feed) —
  resident, clinical, and write routes all return 403, so a stolen box
  yields at most the non-PHI boards. Display sessions refresh normally and
  keep working while MFA is enforced facility-wide (trust inherits from
  the manager approval, which passed auth+MFA).
- **No PHI on the wire to the TV.** The ops feed is counts-only; menu
  payloads carry no PHI. The committed suite asserts the exact payload
  shape and scans for resident-level fields.
- **Pairing abuse notes.** Labels are sanitized before a manager sees
  them; concurrent approvals of one code serialize to a single session;
  always verify the code on the physical TV before approving.
- **Physical-device trust.** Serve the API over HTTPS in production and
  use the facility's trusted LAN/VPN. Mount boxes securely (§2).
- Standard platform safeguards still apply: JWT sessions bound to
  persisted refresh tokens + `auth_version`, bcrypt password hashing, and
  Row-Level Security tenant isolation (see `ARCHITECTURE.md` §5).

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Stale data** (counts/menu not updating) | Box offline, server unreachable, or session revoked | Check Wi-Fi/LAN and the server URL; a revoked session drops to the pairing screen (§4). The footer shows the last-update age. |
| **Blank / distorted rendering** | Outdated System WebView | Update *Android System WebView* via the Play Store, then reboot the box. |
| **D-pad can't reach a button** | Focus lost after a content refresh | Press Back once to return focus to the board frame; all TV actions are D-pad reachable with visible focus rings. |
| **"Invalid or expired code"** | 10-minute TTL elapsed or code already used | Request a fresh code on the TV and approve promptly. |
| **"Too many pending pairings"** | >200 unapproved codes server-wide | Wait a few minutes (codes expire automatically) and retry. |
| **"TV Display identity is disabled"** | Facility revoked all walls (§6) | Re-enable the `TV Display` user in Admin, then re-pair. |

## 9. Tier note (licensing)

- **Default: Community-open.** The wall display ships as Community Core —
  no license key required, consistent with single-facility operational
  tools in `LICENSING.md`.
- **If commercialized later,** gate it exactly like other SaaS modules:
  - Client: wrap the `/tv/*` routes in
    `<FeatureGate requiredTier="enterprise">` (see
    `src/components/FeatureGate.tsx` + `src/security/license.ts`).
  - Server: add `requireTier('enterprise')` to the TV router
    (`server/src/middleware/requireTier.ts`), returning
    `402 LICENSE_TIER_REQUIRED` without an active entitlement.
  - Suggested mapping: Community = one wall display; Pro/Enterprise =
    unlimited walls + multi-facility boards. No tier change alters the
    counts-only / no-PHI guarantee.

## 10. Quick reference (API contract)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/tv/pair/request` | none (rate-limited) | TV requests a code → `{ code, claimToken, expiresInSeconds: 600 }` |
| `GET /api/tv/pair/status?code=&claim=` | claim secret | TV polls → `pending` (+TTL) or `approved` (+tokens) |
| `POST /api/tv/pair/approve` | manager+ | Manager approves code → binds facility display identity, audit-logged |
| `GET /api/tv/ops-today` | display-admitted read roles | Counts-only ops feed + facility name + `generatedAt` |
| `GET /api/tv/crew-today` | display-admitted read roles | Active dietary crew names + positions (no phone/email/notes) |
