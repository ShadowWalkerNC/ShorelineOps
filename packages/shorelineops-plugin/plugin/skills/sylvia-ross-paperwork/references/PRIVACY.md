# Resident privacy boundary

This plugin is a menu and aggregate kitchen-paperwork system. It is not a resident record system.

## Never persist or autofill

Do not persist, copy into plugin storage, or autofill any resident-specific information, including:

- resident names or initials used as identifiers
- room or apartment numbers tied to an individual
- date of birth, age, address, phone, email, photographs, signatures, IDs or account numbers
- diagnoses, medications, medical history, care-plan details or notes
- allergies, diet orders, texture/liquid consistency orders, swallowing status, feeding assistance or other clinical/nutrition instructions tied to a resident
- identifiable resident meal selections, preferences, refusals or attendance history
- any roster linking a person to a room, diet, meal, restriction or selection

Aggregate counts that cannot reasonably identify an individual are allowed when supported by the workflow.

## Pre-import privacy gate

Before calling menu_import, inspect the attachment, pasted text and filename for resident-identifying or resident-specific clinical information. If any is present:

1. Do not call menu_import.
2. Do not quote or restate the sensitive details in the response.
3. Tell the user the source needs to be redacted before it can be stored by this plugin.
4. Continue only from a redacted menu source containing facility/area, week/date, meal names and non-resident operational information.

If a source has already been imported and is later discovered to contain resident information, do not reuse, approve, generate from, or expose that source. State that the local stored copy may require removal outside this workflow unless a supported deletion tool is available.

## Generated paperwork

Resident Name, Room # and similar resident-identifying fields must remain blank. Never generate prefilled resident copies. Staff may complete blank printed forms offline under facility procedures.

Do not put resident-specific diet, allergy, texture, medical or care-plan information into notes, specials, filenames, packet IDs, menu IDs or PDF metadata.

## Data exposure

Do not expose source file paths, raw stored source files, local data directories, hashes, internal IDs or technical storage details unless the user explicitly needs them for troubleshooting. Prefer the generated PDF resource and human-readable menu summary.

This policy does not change how the ChatGPT product itself handles files uploaded into a conversation; it restricts what this plugin accepts for persistence and generation.

## Authorized anonymous selection scans (0.10)

Fully redacted selection sheets may supply anonymous A/B marks for aggregate counting and missing-choice flags, as explicitly requested by the user. Remove all identifiers and resident-specific clinical/diet/allergy/texture notes first. No resident roster, stable pseudonym or per-person history is created. See SCANS.md. Source-cell sheet indexes are temporary scan locators, not identities.
