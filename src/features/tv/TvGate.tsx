/**
 * Wall-display route gate + chrome.
 *
 * TVs authenticate as the reserved display identity (paired in TvSetupPage),
 * not as staff, so these routes stay outside RequireAuth/AuthedLayout. The
 * gate restores the persisted display session, shows a slim header (clock +
 * board tabs), and maps D-pad Left/Right to board switching.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { tvSession } from './tvSession'
import { formatClock, useNow } from './tvData'
import './tv.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const IS_DEV = import.meta.env.DEV

export default function TvGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ready' | 'setup'>('checking')
  const navigate = useNavigate()
  const location = useLocation()
  const frameRef = useRef<HTMLDivElement>(null)
  const now = useNow(1000)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (DEMO_MODE || IS_DEV) {
        if (!cancelled) setState('ready')
        return
      }
      const ok = await tvSession.restore()
      if (!cancelled) setState(ok ? 'ready' : 'setup')
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  // Focus the frame so D-pad keys register without a first click.
  useEffect(() => {
    if (state === 'ready') frameRef.current?.focus({ preventScroll: true })
  }, [state])

  // Persist refresh rotations performed by the shared api client.
  useEffect(() => {
    if (state !== 'ready' || DEMO_MODE || IS_DEV) return
    const id = window.setInterval(() => tvSession.mirrorRefreshToken(), 60000)
    return () => window.clearInterval(id)
  }, [state])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = location.pathname.startsWith('/tv/status') ? '/tv/menu' : '/tv/status'
      e.preventDefault()
      navigate(target)
      // Return focus to the frame so Up/Down keep scrolling the new board
      // instead of sticking on the tab link that was just activated.
      requestAnimationFrame(() => frameRef.current?.focus({ preventScroll: true }))
    },
    [location.pathname, navigate]
  )

  if (state === 'checking') {
    return (
      <div className="tv-root tv-center" role="status" aria-live="polite">
        <p className="tv-kicker">Shoreline wall display</p>
        <p className="tv-loading">Starting board…</p>
      </div>
    )
  }

  if (state === 'setup') {
    return <Navigate to="/tv/setup" replace />
  }

  const onStatus = location.pathname.startsWith('/tv/status')
  return (
    <div ref={frameRef} className="tv-root" onKeyDown={onKeyDown} tabIndex={0}>
      <header className="tv-topbar">
        <div className="tv-brand">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt="Shoreline logo"
            className="tv-logo"
          />
          <span>Shoreline</span>
        </div>
        <nav className="tv-tabs" aria-label="Boards">
          <Link to="/tv/menu" className={onStatus ? 'tv-tab' : 'tv-tab tv-tab-active'} aria-current={onStatus ? undefined : 'page'}>
            Menu board
          </Link>
          <Link to="/tv/status" className={onStatus ? 'tv-tab tv-tab-active' : 'tv-tab'} aria-current={onStatus ? 'page' : undefined}>
            Kitchen status
          </Link>
        </nav>
        <div className="tv-clock" aria-label="Current time">
          {formatClock(now)}
        </div>
      </header>
      {children}
    </div>
  )
}
