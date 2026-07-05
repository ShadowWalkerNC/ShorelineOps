import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker and fires custom window events so any
 * component can listen without coupling directly to virtual:pwa-register.
 *
 * updateSW(true)  → skip waiting and reload
 * updateSW(false) → skip waiting without reloading
 */
export const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:need-refresh'))
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'))
  },
  onRegisteredSW(swUrl, r) {
    // Poll for updates every 60 minutes while the app is open
    if (r) {
      setInterval(async () => {
        if (!(!r.installing && navigator.onLine)) return
        try {
          const resp = await fetch(swUrl, { cache: 'no-store', headers: { cache: 'no-store', 'cache-control': 'no-cache' } })
          if (resp?.status === 200) await r.update()
        } catch { /* offline — ignore */ }
      }, 60 * 60 * 1000)
    }
  },
})
