# Route loading performance — 2026-10-05

Baseline measured on public demo `/menu` and staff `/app/login` at source release 2d504c7. Chromium viewport 820x1180, 4x CPU throttling, 100ms network latency, 200 KB/s download, service workers disabled. One cold and one warm sample per page; these are lab observations, not statistical estimates or physical tablet acceptance. No authenticated resident data was accessed.

| Page/cache | DOMContentLoaded ms | Resource transfer bytes | Long-task total ms | Largest long task ms |
|---|---:|---:|---:|---:|
| Demo/cold | 4967 | 322410 | 609 | 319 |
| Demo/warm | 340 | 1200 | 255 | 107 |
| Login/cold | 2156 | 312916 | 223 | 148 |
| Login/warm | 323 | 1500 | 0 | 0 |

The route imports in `src/App.tsx` were eager. They now use React lazy imports with an accessible Suspense status and the existing application error boundary. Auth and role guards remain in place. Compiled production entry JavaScript fell from approximately 1154 KB (293 KB gzip) to 323 KB (102 KB gzip); login has a separate 7 KB chunk. Shared imports still contribute startup work. These build sizes do not establish runtime improvement.

Service-worker precache includes all route assets (89 production entries, approximately 2.56 MB). Code splitting reduces initial evaluation, not total offline asset storage/download. Physical offline navigation, update recovery, actual tablet measurements, and meal-rush API latency remain separate acceptance gates. Hosted before/after timings and route navigation must pass after deployment before closing the performance gate.

Local validation: frontend typecheck, both required builds, 228 system checks, 181 regression tests, three desktop checks and onboarding browser flow at widths 390/1440 passed.

## Hosted route split and offline follow-up

All five CI jobs and security audit passed at ab49d62 (verification run 37303808560). API/demo deployments succeeded. A repeat of the same single-sample throttled lab measured:

| Page/cache | DOMContentLoaded ms | Resource transfer bytes | Long-task total ms | Largest long task ms |
|---|---:|---:|---:|---:|
| Demo/cold | 1228 | 190422 | 392 | 124 |
| Demo/warm | 369 | 6600 | 159 | 108 |
| Login/cold | 1277 | 157167 | 129 | 71 |
| Login/warm | 336 | 3000 | 0 | 0 |

Cold-load observations improved; warm samples are broadly comparable and do not establish a speed guarantee. Measurement timing includes variable hosted/network conditions.

Acceptance uncovered two offline problems: navigation cached individual route HTML instead of falling back to the precached shell; the authentication matcher treated the tokenManager JavaScript filename as a token endpoint. Navigation now uses the precached shell for its registered scope, and auth/token rules match complete path segments. APIs remain network-only.

Local compiled-backend browser acceptance passed Back, reload, offline recipe reload and first offline visit to reporting. Cache inspection found no `/api/` entries. Both builds and 228 system / 181 regression / 3 desktop checks passed. Hosted offline acceptance of the service-worker follow-up remains pending. The representative route test now waits for reporting to render after reload instead of immediately counting elements during lazy loading.
