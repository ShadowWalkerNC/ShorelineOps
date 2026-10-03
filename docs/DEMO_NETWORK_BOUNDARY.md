# Demo network boundary (raw `fetch`)

Public demo builds (`VITE_DEMO_MODE=true`) install a page-scope `fetch` guard
before React/AuthProvider mount (see `src/main.tsx`). Blocked API requests
reject with `code: DEMO_API_UNAVAILABLE`
("backend workflow unavailable in public demo") and never resolve synthetic
clinical data.

- Blocks: same-origin `/api` exact/prefix + the configured `VITE_API_URL`
  target (remote API-base root blocks its whole origin, covering token
  refresh). Handles string, `URL`, and `Request` inputs with queries.
- Allows: assets, fonts, service worker, navigation, `/apiary`, marketing.
- Live builds: gate eliminated at compile time; behavior untouched.

Why a global guard: ~30 raw `fetch` call sites across kitchen/admin/setup/
scanners bypass the shared Axios client; one choke point closes them all
(including future ones) before any headers transmit. Axios runs over XHR, so
it is blocked separately by the api/client.ts owner — not here. Install is
idempotent; `isDemoApiRequest`/`installDemoNetworkBoundary` take injected
scope/fetch/env config for testing.

Tests: `server/src/demo-network-boundary.test.ts` (loads the real client
module from source; no network/secrets). Owner boundaries: this workstream
owns only `src/main.tsx`, `src/demo/networkBoundary.ts`, that test, and this
note; server routing/vercel belong to the api/server owner, `render.yaml` to
the deploy owner.
