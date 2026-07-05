/**
 * Slim install-to-homescreen banner.
 * Appears only when the browser fires beforeinstallprompt (Chrome / Edge / Android).
 * Dismissed state stored in sessionStorage so it doesn't re-appear mid-session.
 */
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('pwa-banner-dismissed') === '1'
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function handleInstall() {
    await prompt!.prompt()
    const { outcome } = await prompt!.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  function handleDismiss() {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(13,27,42,0.25)',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
          Add Shoreline to your home screen
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Works offline and opens like an app
        </p>
      </div>
      <button
        onClick={handleInstall}
        style={{
          padding: '8px 16px', background: 'var(--color-primary)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          padding: '8px 10px', background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Not now
      </button>
    </div>
  )
}
