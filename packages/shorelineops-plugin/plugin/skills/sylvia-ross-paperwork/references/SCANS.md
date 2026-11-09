# Menu, tally and anonymous-choice intake

Everyday flow: upload -> identify area/week/type -> show only flags and a compact count table -> user corrects -> explicit confirmation -> choose one area or selected-area combined PDF. Keep normal replies short. Users never prepare schemas, IDs or JSON. Host vision interprets the attachment; deterministic tools validate/store/calculate/print. No additional OCR/AI provider is part of this release.

## Privacy and selection sheets

The user explicitly authorized aggregate tallies and fully redacted anonymous A/B selection sheets. Before intake check the whole source, filename and transcription. Resident names, room links, identifiers, signatures and all resident-linked clinical/diet/allergy/texture/feeding information must be covered or removed. Only anonymous dates and A/B marks may enter selection batches. Do not create resident records, stable pseudonyms, rosters, preference profiles or per-person history. Sheet indexes are source-cell locators within that scan only. Reject an unsafe source and ask for redaction without repeating private content.

## Intake tools

For weekly menu images, host vision extracts all7 dates/42 choices then uses menu_import. Never have the renderer read images. For a replacement for the same area's same week, explicitly provide replaces_menu_id; this marks the old menu stale. Use menu_correct for user-provided field corrections. Do not call an unrelated future week a replacement.

For count scans use count_scan_import, selecting tally or selections and day/week scope. In a day scan include all3 meals; unreadable/missing tally A or B is null with originalText such as blank/unclear. A visible0 is0. Unmarked selections use missing; both marks, uncertain marks or unreadable marks use ambiguous. Every numeric/choice field retains originalText, confidence (null if unavailable), needsReview and source cell. Confidence below0.9 forces a review flag at intake; that is a policy threshold, not a calibrated accuracy guarantee. Never fill absent days/meals by guessing; ask for the correct scope or represent the missing entries explicitly.

Aggregate fields a/b are required. Optional staff/extra counts remain unallocated, and unknown optional counts remain blank. Expected resident-choice total is optional and must come from the source or explicit human input, never census inference. A+B mismatch with an explicit expected total blocks confirmation. Without expected totals, aggregate scans cannot prove every resident selected; anonymous selection scans can identify missing/both marks directly.

Use count_scan_review (full only when needed) to inspect source evidence and issues. Show a compact human-readable count table before confirmation. Use count_scan_correct with the reported field paths and user-verified integer/choice corrections; original text/confidence remains intact, and the result is a new unconfirmed revision. Required unknown A/B remains blocking. Use count_scan_confirm only on explicit user count confirmation. This does not approve foods or grant dietary authority.

Never add independent scan batches automatically. Duplicate source intake for an active area is refused. Repeated or overlapping pages may require human review; anonymous data cannot reliably establish whether different photographs show the same resident sheet. A new scan after a menu revision is a fresh review, not automatic reuse of old counts. If private data is discovered later, count_scan_block stops future use and linked packet access; stored-source removal and prior downloads remain separate.

## Output and alerts

packet_generate can take a confirmed current scan_id. It fills SR-03 A/B/staff/extra counts and cook A/B headers; item quantities, units, portion rules, pull dates and dietary decisions remain blank/manual. Without a scan, blank-count packets still work. A day scan cannot populate another day or a full week's counts.

campus_packet_generate compiles explicitly selected independent areas with their own menus and optional scans into one PDF. Each area appears once and must use the same menu week; its identity, food facts and counts remain separate. Do not pool matching food names or infer area-to-kitchen assignments. Existing configured kitchen/station structure remains subject to human confirmation. Do not invent unavailable Ross/Engel menus from Sylvia's menu.

workflow_status reports selected or recent count/menu issues during the conversation. Menu changes supersede old menus, invalidate new final use of old counts/packets and call for review/reprinting. Scan corrections supersede old scans and invalidate linked packet resources. Tell the user what needs action before generating production paperwork. Printable drafts remain clearly REVIEW ONLY. No background monitor, push/email/SMS or automatic reprint is provided. Previously downloaded or printed paperwork cannot be recalled.

Good short reply: “Sylvia • Thursday • 2 entries need review: lunch A is unclear; dinner has both options marked. Confirm those, then I can prepare the cook packet.” Never expose internal hashes or field paths in the normal reply.

For an explicit request to review existing counts after a same-area/same-week menu change, count_scan_for_menu prepares a fresh unconfirmed draft from the latest safe scan. It does not allocate portions or carry approval. Explain that A/B food meanings may have changed; show the counts again, accept corrections and require explicit reconfirmation. Blocked or superseded scan sources and unrelated weeks cannot be carried forward.

## ShorelineOps counts transfer (0.11)

For an explicit ShorelineOps export, menu_export optionally accepts the current confirmed scan_id for the menu's native area. It includes the redacted scan source and extracted evidence in the same .srmenu file (version2); it never pools scan batches or exports reviewer identity. Without scan_id, existing version1 menu-only transfers remain compatible. Files exceeding900KB are refused with image-reduction guidance; evidence is never silently dropped.

ShorelineOps shows source/counts and requires a fresh count confirmation separately from menu approval. Count confirmations never carry between apps. Counts fill summary/cook headers only, not component quantities or the blank weekly tally. A day scan cannot populate another day/full week. Fully redacted anonymous choices follow the same transfer checks.

Transfers are offline snapshots. Plugin changes block future access to linked transfer resources, but cannot update/revoke a file already downloaded or imported into ShorelineOps. After ANY menu/count change explicitly re-export and re-import, then review/confirm again. Do not describe this as live synchronization or automatic cross-app stale-data detection. No background push added.
