# ShorelineOps iOS App (`xtool` + Swift 6.1)

Native iOS companion application for **Shoreline Care OS v5.0**, built with Swift 6.1 and `xtool` (`v1.22.2`) for cross-compilation, code signing, and direct iPhone/iPad deployment from Windows (via WSL2 Ubuntu) or Linux without macOS/Xcode.

---

## Architecture & Clinical Safety Parity

The iOS app follows **Jakob's Law for Mobile Development** and Apple Human Interface Guidelines (HIG) with $\ge 44\text{pt}$ touch targets and a 5-tab thumb-zone bottom bar:

1. **Dashboard (`DashboardTabView`)**: Active census, NPO exclusion banners, $/CPD cost gauges, PointClickCare EHR triage alerts, and IDDSI 2.0 food/liquid distribution.
2. **Residents (`ResidentsTabView`)**: Searchable resident roster with IDDSI Food Levels (L3–L7 + `-1` Unassigned hold), IDDSI Liquid Consistency Levels (L0–L4), daily fluid restriction mL tracking, Big 9 allergen badges, and 1-tap PointClickCare EHR triage approval (`dietOrderVersion` atomic increment).
3. **Menu (`MenuTabView`)**: Standardized cycle menu slots (Choice A / Choice B) with therapeutic texture/liquid pairings, calorie/sodium counts, and allergen declarations.
4. **Kitchen (`KitchenTabView`)**:
   - **Deterministic Signed Tray Safety Verifier (`DeterministicTraySafetyEngine`)**: Non-overridable checks for `NPO_HARD_BLOCK`, `IDDSI_UNASSIGNED_HOLD`, `PENDING_EHR_RECONCILIATION`, `STALE_DIET_ORDER_VERSION`, `ALLERGEN_COLLISION_*`, `IDDSI_FOOD_TEXTURE_MISMATCH`, `IDDSI_LIQUID_CONSISTENCY_MISMATCH`, and `FLUID_RESTRICTION_EXCEEDED`.
   - **HACCP CCP Temperature Logger**: Enforces $\ge 165^\circ\text{F}$ cook hold, $\ge 140^\circ\text{F}$ hot line hold, and $\le 41^\circ\text{F}$ cold hold with mandatory corrective action documentation on out-of-range readings.
5. **More (`MoreTabView`)**: Facility profile, ShorelineOps REST API URL configuration (`http://127.0.0.1:3001/api`), live `/api/health` connectivity probe, and offline sandbox fallback.

---

## Quickstart Commands (Windows PowerShell / WSL2)

### 1. Run Swift 6 Clinical Safety Unit Tests (No Darwin SDK Required)
```powershell
cd ios/ShorelineOps
wsl -d Ubuntu -- bash -lc "swift test"
```

### 2. First-Time Darwin SDK & Apple Developer Setup (`xtool`)
Before building the signed iOS `.ipa` bundle for a physical iPhone or iPad:
```powershell
cd ios/ShorelineOps
xtool sdk install <path-to-Xcode.xip-or-darwin.xtoolsdk>
xtool auth
```

### 3. Build & Deploy to Connected iOS Device
Connect your iPhone/iPad via USB (with `usbmuxd` running in WSL2) and run:
```powershell
cd ios/ShorelineOps
xtool devices
xtool dev
```
