/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

clientsClaim()
self.skipWaiting()

// Precache all Vite build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Supabase / API calls — network first, 5 s fallback to stale ────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/'),
  new NetworkFirst({
    cacheName: 'shoreline-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
)

// ── Static build assets — cache first ──────────────────────────────────────
registerRoute(
  ({ request }) =>
    ['style', 'script', 'worker', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'shoreline-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// ── Images — cache first ───────────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'shoreline-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
)

// ── App-shell navigation — network first, fall back to cached shell ─────────
// When offline and the shell isn't cached yet, the browser shows the
// built-in offline page; we add a NavigationRoute so at minimum the
// cached shell serves repeated visits.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'shoreline-pages',
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    })
  )
)

// ── Auth-related requests — always network only (never cache tokens) ────────
registerRoute(
  ({ url }) =>
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/token'),
  new NetworkOnly()
)
