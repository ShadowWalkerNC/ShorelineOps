# ShorelineOps companion release 0.12

Purpose: reusable facility meal-operations assistant, usable standalone and as a ShorelineOps companion. First-run facility/area setup replaces Ross-specific defaults; preserve existing saved configuration, menu records, approvals and legacy IDs. Natural flow: facility -> upload -> flags -> confirm -> print/export. No resident data or automatic clinical decisions.

Implementation: generic draft startup and confirmed facility_setup; retain campus configuration/sharing tools. Generic single-area prep quantities; existing Ross three-area layout preserved for that exact preset. Rebrand display/icon/skills/docs, stable package/tool/resource IDs retained for compatibility. ShorelineOps companion reference maps existing workflows and offline transfer constraints; no claims of live writes, integration deployment or unsupported menu format.

Format currently supported: seven Sunday-Saturday dates, breakfast/lunch/dinner with A/B choices. Any facility can configure names/areas; arbitrary one-choice/rotating/clinical menu adapters are not implied. Never fabricate a B choice. Local per-user runtime is not multi-tenant hosting. Sharing/public listing remains distinct from general-purpose package usability.

Validation: fresh arbitrary facility onboarding, no implicit example usage, saved-profile compatibility, unrelated-area refusal, draft vs confirmed configuration, generic Letter prep bounds, full regression, installed runtime and guarded same-plugin publication. No new dependencies, app deployment or clinical/API changes. Existing Shoreline adapter is local/offline, not silently connected. Rollback source/release only; no state migration.

To prevent accidental example output, menu read/review/print/export no longer silently default to week-1-example. Hosts supply the selected actual menu ID; historical demo use is explicit. Legacy tool/resource names and stored data remain compatible, but omitted-menu calls now fail closed.
