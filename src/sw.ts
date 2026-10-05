/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
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
  ({ url }) => /(?:^|\/)auth(?:\/|$)/.test(url.pathname) || /(?:^|\/)token(?:\/|$)/.test(url.pathname),
  new NetworkOnly()
)

// Precache all Vite build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Clinical and account API responses may contain PHI. Keep them out of the
// service-worker cache until an encrypted, reviewed offline data design exists.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
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

// All client routes use this build's precached shell, including routes not
// visited before going offline. API/auth registrations above remain network-only.
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL(`${scopePath}index.html`)
  )
)
