/*
 * Retire the legacy root-scoped app service worker.
 *
 * Older deployments installed the authenticated React shell at `/`, which
 * could keep serving the login screen over the public marketing site. Current
 * app workers are limited to `/app/` and `/demo/`; this worker replaces the
 * old root worker, clears its caches, and unregisters itself.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => ['shoreline-api', 'shoreline-assets', 'shoreline-images', 'shoreline-pages'].includes(name))
        .map((name) => caches.delete(name))
    )
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: 'window' })
    for (const client of windows) client.navigate(client.url)
  })())
})