import { useEffect, useRef, useState } from 'react'
import { updateSW } from '@/pwa'

// Extend the global Event type for the install prompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export default function PwaBanner() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onNeedRefresh = () => setNeedRefresh(true)
    const onOfflineReady = () => setOfflineReady(true)
    const onInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      deferredPrompt.current = e
      setShowInstall(true)
    }

    window.addEventListener('pwa:need-refresh', onNeedRefresh)
    window.addEventListener('pwa:offline-ready', onOfflineReady)
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', () => {
      deferredPrompt.current = null
      setShowInstall(false)
    })

    return () => {
      window.removeEventListener('pwa:need-refresh', onNeedRefresh)
      window.removeEventListener('pwa:offline-ready', onOfflineReady)
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
    }
  }, [])

  const dismiss = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
    setShowInstall(false)
  }

  const handleInstall = async () => {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    setShowInstall(false)
  }

  const visible = needRefresh || offlineReady || showInstall
  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--bg-card)',
      border: '1px solid var(--color-primary)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 32px rgba(13,27,42,0.25)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 280,
      maxWidth: 'min(460px, calc(100vw - 32px))',
      fontSize: 14,
      color: 'var(--text-primary)',
    }}>
      {/* Icon */}
      <div style={{ flexShrink: 0, color: 'var(--color-primary)' }}>
        {needRefresh
          ? <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          : offlineReady
          ? <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          : <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        }
      </div>

      {/* Message */}
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        {needRefresh && <><strong>Update available.</strong> Reload to get the latest version.</>}
        {offlineReady && !needRefresh && <><strong>Ready to work offline.</strong> Shoreline is installed locally.</>}
        {showInstall && !needRefresh && !offlineReady && <><strong>Install Shoreline</strong> for fast, offline access from your home screen.</>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {needRefresh && (
          <button
            onClick={() => updateSW(true)}
            style={{ padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Reload
          </button>
        )}
        {showInstall && !needRefresh && (
          <button
            onClick={handleInstall}
            style={{ padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
