# Menu readiness rules

Use a concise readiness summary before approval and before final production.

A weekly menu is **READY FOR APPROVAL** only when all of these are true:

- resident privacy gate passed;
- one resident area/facility is identified;
- exactly seven dated days are present in Sunday-Saturday order;
- every day has Breakfast A/B, Lunch A/B and Dinner A/B;
- 42 total meal choices are present;
- no meal/date field is unresolved or marked needsReview;
- the source currently under review is the current revision.

A menu is **APPROVED** only after `menu_approve` succeeds for that current revision.

A menu is **READY FOR PRODUCTION** only when it is approved and the requested packet can be generated for its verified week/date.

## Status display

Keep the status compact. Preferred format:

`Privacy: Pass | Menu: 42/42 | Review flags: 0 | Approval: Pending | Ready: Yes`

Use plain language when something blocks readiness. Do not show internal hashes, source paths, local directories or opaque IDs.

## Blocking rules

Do not approve if a privacy issue remains, fewer or more than 42 choices are present, a date is missing/duplicated, or any source field is unresolved.

Do not silently fix a blocker. Ask for or accept a correction, then treat it as a new revision requiring review and approval.
