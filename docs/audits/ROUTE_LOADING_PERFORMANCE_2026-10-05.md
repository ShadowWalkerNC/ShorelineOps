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
