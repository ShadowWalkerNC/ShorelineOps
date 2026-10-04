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

## Whole-site extension

The shared application foundation is `src/styles/stitch-system.css`, imported after the existing design tokens. It covers calm surfaces, readable page headings, frosted navigation, keyboard focus, reduced motion, standalone screens, print layouts and mobile forms. shadcn buttons, inputs, selects and dialogs and the existing Apple component adapters share the same interaction language. Operational composition lives in `src/features/kitchen/stitch-operations.css`.

Menu, recipes, production, meal selection, cook sheets, tray cards, dispatch, inventory, purchasing, distributor, reporting, staff/profile, timecards, settings and tasks use the shared hierarchy. Resident profiles, setup, offline, legal and missing-page states also use it. The seven public pages share the marketing header, system typography, readable content surfaces, responsive navigation and keyboard focus in `marketing/src/styles/global.css` and `marketing/src/layouts/BaseLayout.astro`.

The scope preserves routes, event handlers, calculations, clinical guards, capabilities and enterprise gates. Unsupported recipe-test completion and production-variance displays were removed. Menu catalog count does not certify recipe verification. Broader existing marketing compliance and service-level claims were not certified by this presentation pass.

Acceptance uses all 29 static public/application route entries at 320, 390, 834 and 1440 pixels, plus interactive navigation, filtering and drawers. Route evidence and representative phone/desktop previews are in `site-previews/`. Dynamic profile routes receive a separate check. The pricing comparison has a focusable horizontal scroll region, and its badge row wraps on phones. Reporting warnings remain visible below its heading and controls. Final typecheck, unified build, standalone marketing build and the 160-test suite are required before publishing.

Live URLs remain separate: public site `https://shorelineops.up.railway.app`, demo `https://shoreline-demo-production.up.railway.app` (root-based routes such as `/menu`), and staff application `https://shoreline-api-production.up.railway.app/app/login`. Unified local builds use `/demo/` and `/app/`. Verify deployed screens independently of local previews.

Final whole-site validation passed: 116 route/width combinations with zero page/main horizontal overflow and zero uncaught browser errors; resident profile/back, recipe filtering, item library, mobile navigation/Escape, marketing menu/Escape, keyboard table scrolling and protected staff redirect passed. Demo interactions issued zero API requests. Frontend typecheck, unified demo/app build, standalone marketing build and all 160 regression tests passed with zero skips. These checks use synthetic local demo records and an unavailable API fixture; they do not certify provider integrations or real facility data.

