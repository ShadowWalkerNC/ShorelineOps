# Demo and application separation — October 2, 2026

## Confirmed defects

- **High:** Demo API failures triggered live token refresh and a hard login redirect. Before the fix, opening `/demo/reporting` in Chromium navigated to `/demo/login` and then `/demo`, losing the requested page.
- **High:** Static hosting configuration used a marketing fallback for application deep links. Render now has scoped exact and nested demo/application rewrites; Vercel now handles both shells, including their exact base paths. Express uses a shared shell resolver and returns 503 for missing application bundles.
- **High:** Production application builds could inherit development behavior from environment settings. Browser reproduction found a demo administrator session and a login/dashboard loop under `/app`. The unified builder now pins child-process `NODE_ENV` and `VITE_USER_NODE_ENV` to production and explicitly selects production mode.

## Implemented boundaries

- Marketing remains at `/`; the public sandbox is `/demo`; authenticated operations are `/app`.
- Demo Axios calls fail locally with an explicit unavailable error, without reading credentials, refreshing tokens, clearing a live session, or redirecting.
- The demo installs a fetch boundary before mounting React. It rejects backend requests; it does not simulate successful clinical or administrative writes. Token refresh has its own demo guard.
- Live refresh behavior remains active. A failed retried request propagates its own error without incorrectly logging out a successfully refreshed session.
- Render's configured API URL includes the `/api` prefix expected by the client.

## Verification performed

- Frontend typecheck passed.
- `npm run build:demo` passed and generated the unified marketing, demo and application site.
- `npm run build:marketing` passed.
- `npm test` passed: 228 system checks and 153 automated tests, zero failures or skips.
- Actual headless Chromium against the generated site: reporting, menu, residents, recipes, production and settings retained their paths after reload at desktop width 1280 and phone width 390. No page errors or demo API requests were observed in these checks.
- Clicking from residents to menu, browser Back, and reload returned to and retained residents.
- A fresh application session opening `/app/residents` settled at `/app/login`, with no seeded demo user. The marketing root displayed the marketing page.
- Real HTTP requests through Express static middleware and the compiled shared routing resolver returned the correct shells for exact and nested demo/application paths. Missing demo/application assets and an unknown API path returned 404.
- `git diff --check` passed. Existing work and `public/brand/` were preserved. The owned local browser fixture was stopped.

## Limits and next release step

These are local build, browser and test results. No commit, push, deployment, production account access or real clinical-data access occurred. The user's affected public URL was not supplied, so the hosted symptom and deployed version remain unverified.

Backend-dependent sandbox workflows display unavailable states rather than becoming real application operations. This fix establishes routing and network boundaries; it does not certify every demo workflow as fully simulated.

Express returns 404 for missing assets. Static-host wildcard rewrites can still return shell HTML for a missing asset; that hosting-specific edge case has not been eliminated or verified live. Root `/login` compatibility is Express-specific; static-host entry links should use `/app/login`.

Publish the reviewed unified build and hosting configuration through the normal authorized release process, then repeat direct-open, click, Back and reload checks on the affected public URL.
