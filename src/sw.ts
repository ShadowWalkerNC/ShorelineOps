/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

clientsClaim()
self.skipWaiting()
const scopePath = new URL(self.registration.scope).pathname
const scopeName = scopePath.replace(/^\/+|\/+$/g, '') || 'root'
const cacheName = (kind: string) => `shoreline-${scopeName}-${kind}`

// Auth requests must be registered before the general API route because the
// first matching Workbox route wins.
registerRoute(
  ({ url }) => url.pathname.includes('/auth/') || url.pathname.includes('/token'),
  new NetworkOnly()
)

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
    cacheName: cacheName('api'),
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
    cacheName: cacheName('assets'),
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
)

// ── Images — cache first ───────────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: cacheName('images'),
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
      cacheName: cacheName('pages'),
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    })
  )
)
