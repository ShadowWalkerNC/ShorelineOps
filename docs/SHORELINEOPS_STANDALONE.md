# ShorelineOps standalone release

The first product is a free, open-source Rust desktop application for a single healthcare facility. The facility owns its data, access and backups. A host installation will include the desktop client, facility service, a versioned API, a bundled database engine and the files needed for offline setup. Additional workstations will connect to that facility host over its LAN. Windows and Ubuntu x64 are the first package targets.

The existing Electron and Node installers are the earlier release baseline. The Rust worklist, reconciliation library and facility host are being validated separately. See [native build instructions](../native-desktop/README.md) and the [native rebuild plan](NATIVE_REBUILD_PLAN.md).

The local operator can initialize a blank facility by name and query its setup status on loopback. This records the facility identity before staff onboarding. See [facility host setup](../native-desktop/facility-host/README.md#initialize-a-facility).

## One facility and one source of truth

- The host owns the database, schema upgrades, audit trail and current versions of diet orders, menus, recipes, tickets and reviews. On one computer, the client uses the loopback API. Additional workstations use the same API after the facility enables authenticated TLS and enrolls the devices. Workstations do not open database files over shared storage.
- An administrator sets up the facility, units, printers, staff accounts and backups. The host enforces role, unit scope and device status on each operation. An administrator role does not by itself grant clinical approval.
- Assigned staff record what the guest marked on paper. A dietitian or facility-authorized reviewer verifies it against current diet orders and approved recipe versions. Kitchen staff see reviewed quantities and authorized prep information. Purchasing and financial views use aggregate counts and scoped costing data.
- The host must validate the session, device, mutation and source revisions together. Orders changing between preparation and confirmation must trigger the existing safety checks again. Print and production counts are separately authorized operations.
- SaaS on Railway is a later deployment of the facility API contract. Licensing, cloud account provisioning and optional CulinaryOS adapters have separate deployment and acceptance paths. Local menu, paper, production and costing workflows must work without those services.

## From final menu to kitchen prep

| Step | What staff do | What the application must retain |
| --- | --- | --- |
| Finalize a menu | Review recipes, portions and applicable dietary variants for the meal and service area. | Menu, recipe and choice versions with who approved them and when. Establish the expected ticket roster. |
| Print a packet | Preview and print dated tickets with room for marks and notes. | Opaque ticket identifiers, printed revisions, operator, generation time and reprint history. A retry reprints the same version while it remains current. |
| Record returns | Enter what was circled or written. Flag ambiguous or missing tickets for review. | Separate transcription and unresolved states. Preserve the paper or scanned image per facility policy. Deduplicate repeated entry. |
| Review and confirm | Check marked choices against the active diet order, allergies, texture, liquid consistency and available nutrition information. Resolve exceptions and record the disposition. | Staff identity, review time, decision and reference to the order, menu and recipe versions. A stale printed ticket requires reprint or reconciliation on the current version. |
| Release kitchen counts | Generate a production sheet for the meal and service area after the required reviews. | Counts per exact recipe version, portion and texture. Show excluded tickets and reconcile expected, returned and reviewed counts. Changes supersede the prior tally and its printouts. |

The Rust core reconciles an expected packet against current revisions and verified dispositions. It rejects missing, duplicate, unknown and stale tickets. It requires a reviewer and counts only choices present on the printed revision. The API will construct those dispositions server-side after authorization and clinical checks. A kitchen tally is for preparation. Individual tray verification and order-change checks still run at service.

Printing needs tests at each pilot site using actual paper sizes and printers. Confirm readability, space to mark choices, print cancellation, printer outage, duplicate returns and order changes after paper leaves the printer. During an outage use facility-approved downtime procedures. When service returns, reconcile the paper against current versions before publishing a new tally.

## Food cost and nutrition

- The core multiplies verified portion counts by costs for the exact recipe, portion and texture version. It reports the known subtotal and the number of portions with missing costs. When any portion cost is unknown, it withholds the average. The denominator is the number of verified meals, excluding explicit no-meal dispositions. A verified meal can contain several portions.
- Preserve purchase date, pack size, yield, portion units and ingredient cost provenance when porting the existing costing engine. Keep planned cost, food cost per verified meal and raw food cost per resident-day as separate measures.
- Preserve nutrient source, serving units, conversion and missing-value status. The clinical engine must explicitly enforce applicable restrictions, including NPO and allergen blocks, when it calculates eligible choices and when the tray is verified. Preserve the legacy trajectory and parity fixtures in [the rebuild plan](NATIVE_REBUILD_PLAN.md). Facility staff validate recipes and physical texture against their approved process. [IDDSI framework](https://www.iddsi.org/standards/framework)

## Design and market references

Start with the checked-in [design guide](DESIGN.md) and [Stitch adoption record](design/STITCH_LAYOUT_ADOPTION.md). The native workflow should use familiar task names such as **Print tickets**, **Enter returns**, **Review selections** and **Kitchen counts**. Express hold and review states in text as well as color. Keep keyboard focus visible, allow enlarged text, and verify the full keyboard and screen-reader path. The web design files provide visual and interaction guidance. Native release acceptance still requires native device testing.

MealSuite documents printable per-person tickets and production sheets that distinguish projected and actual orders. Computrition describes staff review, correction, tallying and tray printing. MatrixCare describes cost analysis and production planning. These establish capabilities to test against. The product direction here combines the paper workflow with a facility-owned Rust installation that keeps operating on its LAN without a cloud account. [MealSuite tickets](https://support.mealsuite.com/hc/en-us/articles/53702990342163-Tray-Menu-Tickets-People-for-Non-Select-Advance-Ordering-November-2026-Functionality) · [MealSuite production sheet](https://support.mealsuite.com/hc/en-us/articles/4410403126163-The-Service-Delivery-Production-Sheet-in-the-Touch-App) · [Computrition diet office](https://www.computrition.com/wp-content/uploads/Computrition-TouchPoint-Dining-spec-sheet.pdf) · [MatrixCare nutrition management](https://www.matrixcare.com/nutrition-management/)

During the pilot, measure the share of printed tickets accounted for, discrepancies caught before release, agreement between independently counted selections and published totals, and time from completed return packet to kitchen counts. Report cost and nutrition coverage alongside any averages. Nutrition source records need a dataset version and provenance because USDA FoodData Central includes both laboratory-analyzed and label-derived data. [USDA FoodData Central documentation](https://fdc.nal.usda.gov/data-documentation/)

Use site-specific order authority, review and retention procedures. Federal nursing facility and hospital dietary service requirements have distinct scopes. Assisted-living requirements depend on the applicable jurisdiction and facility license. [Nursing facilities, 42 CFR 483.60](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-483/subpart-B/section-483.60) · [Hospitals, 42 CFR 482.28](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-482/subpart-C/section-482.28) · [Maine assisted housing licensing](https://www.maine.gov/dhhs/dlc/licensing-certification/assisted-housing)

## Release acceptance

1. Install on clean Windows and Ubuntu machines. Confirm that the installer brings up the local host, supports empty-facility setup and restarts without losing its data.
2. Connect two workstations over an approved LAN. Verify TLS, enrollment, revocation, and cross-role and cross-unit denials. Exercise a backup restore and a failed-upgrade rollback.
3. Run a synthetic full meal service before any live-data pilot. Verify audit entries, reprints, stale copies, unreadable returns, NPO and allergen denials, dietitian confirmation, accurate prep counts, and incomplete-cost behavior.
4. Rehearse a service and an outage with the first participating facility teams. Include actual printers, screen readers, large text and keyboard-only operation. Obtain site acceptance before clinical use.
5. Publish reproducible installers, checksums, release notes, access and backup guides, source and dependency notices, and an authoritative license scope. The root LICENSE and existing licensing documentation describe different terms. Resolve scope before advertising the distribution license.

For facility privacy and policy review, refer to the primary [HHS Security Rule overview](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html) and applicable [CMS nursing facility guidance](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/som107ap_pp_guidelines_ltcf.pdf).
