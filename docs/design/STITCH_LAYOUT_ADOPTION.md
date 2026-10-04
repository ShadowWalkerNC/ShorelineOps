# Stitch layout adoption

The supplied `stitch_ui_ux_design_specification.zip` is the visual reference. Its screenshot/HTML pairs describe presentation; unsupported mock clinical state, security claims and actions are not operational requirements.

## Scope

The first adoption changed accents and some spacing but left the resident roster substantially unchanged. This pass changes the screen compositions themselves:

- Residents: clinical header, concise census metrics, actual-data safety priority and readable census rows/mobile cards. The ZIP has no standalone Residents export; apply its clinical list language while retaining search, filters, detail, import and permitted mutations.
- Dashboard: greeting/actions, early actual-data clinical safety context, readable census and procurement/reporting sections, responsive operational content.
- Shared shell: larger monochrome clinical navigation, quiet header, full destination access and standard mobile tabs. Existing site/demo/app routing remains intact.
- Sign-in: match the spacious workstation/mobile composition while preserving actual login/MFA flows; no invented SSO or compliance claims.
- Administration: framed header and grouped operations/governance/infrastructure controls, actual identity and honest unavailable states. Preserve all existing panels.

Reuse the current brand assets and existing stores/components. No clinical policy changes, fake telemetry, dependency additions or remote fonts. Keep zoom available and verify keyboard/touch access.

## Acceptance

Capture before/after Residents and current dashboard, sign-in and administration at desktop and phone widths. Inspect screenshot composition against the ZIP, rather than using test counts as visual evidence. Verify search/filter/detail and admin navigation; reload/back retains routes; production sign-in does not become demo. Check narrow phone, phone, tablet and desktop for overflow. Run frontend typecheck, unified build, marketing build and the full clinical regression suite.

Work is split into independent Residents, dashboard and shell/sign-in ownership; root owns shared tokens, administration and integration/browser verification. Muse was attempted and returned quota exhaustion before editing; direct agents implement within the same boundaries. Preserve the unrelated ForgeSatchel alignment document.

## Verified locally

Frontend typecheck, unified demo/app build, standalone marketing build and all 160 regression tests passed. Browser checks at 320, 390, 834 and 1440 pixels verified resident search, expandable chart details, reload and no horizontal page overflow. Desktop and phone previews are stored in layout-previews; roster previews show the independently scrolling workspace. Public-site links use the separate marketing origin. Clinical guards and role checks remain in the existing handlers. Live acceptance is a separate deployment check.

