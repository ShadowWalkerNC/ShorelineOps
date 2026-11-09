# ShorelineOps chat workflow

## Natural commands

Treat these as ordinary language, not syntax the user must memorize:

- **Check this menu / Is this ready?** → privacy gate + extraction/completeness check + readiness status.
- **Test this menu** → privacy gate + extraction + review; do not persist approval automatically.
- **Upload / replace menu** → privacy gate + import + review/readiness check.
- **Show menu** → latest reviewed menu, compactly.
- **What needs fixing?** → only unresolved/privacy/completeness blockers.
- **Correct ...** → apply correction, create a new revision, clear prior approval.
- **Approve it** → validate readiness, then call `menu_approve` for the current reviewed revision.
- **Status** → concise privacy/menu/review/approval/readiness line.
- **Weekly paperwork** → SR-01 + SR-02.
- **Today's cook packet / <day> paperwork** → SR-05 + SR-06 + SR-07 for the verified date.
- **Add summary / prep / dessert** → add SR-03 / SR-04 / SR-08.
- **Full daily** → SR-03 through SR-08 for one verified date.
- **Complete packet** → only when explicitly requested.

## State model

1. `received`
2. `privacy_passed`
3. `reviewed`
4. `corrected`
5. `ready_for_approval`
6. `approved`
7. `generated`

A correction or replacement always returns the menu to `corrected` and invalidates prior approval and any assumption that previous final packets represent the new revision.

## Short follow-ups

Keep the current facility, menu ID/revision, approval state, verified dates and last packet context available when the host provides them. Resolve short commands such as “Tuesday,” “add prep,” “weekly,” or “status” from that current context instead of restarting the workflow.

## Truthfulness

A human saying “approve it” is permission to attempt approval. It is not proof that backend approval succeeded. Only report backend approval after `menu_approve` succeeds.
