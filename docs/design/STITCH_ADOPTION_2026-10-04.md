# Stitch design adoption — October 4, 2026

The supplied ZIP is a visual reference, not an authorization to change operational rules. Its clinical workspace and Apple HIG brand specification establish the direction: marine teal, pale clinical canvas, restrained white surfaces, readable system typography and large touch targets. Existing marketing content already follows the supplied composition and is reused.

Implementation preserves stores, calculations, authentication/MFA, role gates, routes and demo network isolation. Exported certification, live telemetry, encryption and compliance claims were not added. Mock diet overrides and release bypasses were not implemented. Existing brand assets were preserved.

## Adopted

- Shared clinical tokens and local system fonts; marketing accent palette aligned.
- Solid teal active navigation and 48px navigation/shared button targets.
- Light clinician sign-in, wider card, accessible email/password labels and visible focus treatment; authentication logic unchanged.
- Teal dashboard heading, three-column operational metrics to reduce truncation, and keyboard navigation for metric cards.
- Administration destinations grouped into Operations, Staffing & governance and System infrastructure; all existing panels and authorization remain available.
- Passive offline-ready notice no longer appears by itself over workflow content. Cache notification wording does not claim installation.
- Mobile content padding accounts for the bottom navigation safe area.

## Verification

Frontend typecheck, unified build and marketing build passed. Full test suite passed: 228 system checks and 160 automated tests, zero failures or skips. Browser checks against local generated files at 1440px and 390px covered marketing, demo dashboard, administration and live sign-in: no horizontal page overflow or uncaught page errors; demo reload retained routes and sent no API requests; administration selection worked; a fresh live sign-in session had no seeded demo user.

Screenshots are in [previews](./previews/). This is adoption of the design language within existing functional screens, not a pixel-for-pixel replacement of every exported mockup. Backend-dependent demo panels remain honestly unavailable. No deployment or production verification occurred.

Muse was attempted but returned subscription quota exhausted before editing. Codex performed the bounded implementation and verification directly.

## Commit preparation

Current entry links and deployment documentation are aligned in [URL contract](../URLS.md). Canonical metadata uses PUBLIC_SITE_URL; separate marketing hosts retain configurable PUBLIC_DEMO_URL and PUBLIC_APP_URL. The design is applied to source and regenerated unified build files. Commit authorization was provided by the user; publishing remains pending.

