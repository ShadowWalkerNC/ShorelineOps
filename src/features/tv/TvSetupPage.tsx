/**
 * TV display setup: pairing, meal times, and unpair.
 *
 * Pairing binds this TV to the approving manager's facility. The TV shows a
 * single-use code; a manager approves it in the web app; the TV collects its
 * display session with the claim secret from the pairing request. Meal times
 * stay TV-local so each wall follows its own dining room schedule.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tvApi } from '@/api/tv'
import { tokenManager } from '@/security/tokenManager'
import { tvSession } from './tvSession'
import {
  DEFAULT_TV_MEAL_TIMES,
  loadTvMealTimes,
  saveTvMealTimes,
  useNow,
  type TvMealTimes,
} from './tvData'
import './tv.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const POLL_MS = 2000
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export default function TvSetupPage() {
  const navigate = useNavigate()
  const now = useNow(1000)
  const [label, setLabel] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [times, setTimes] = useState<TvMealTimes>(loadTvMealTimes)
  const [savedTick, setSavedTick] = useState(0)
  const [paired] = useState(() => tokenManager.hasRefreshToken() || tvSession.facilityId() !== null)
  const claimRef = useRef<string | null>(null)

  // Poll for approval while a code is showing.
  useEffect(() => {
    if (!code || !claimRef.current) return
    let cancelled = false
    const poll = async () => {
      try {
        const status = await tvApi.pairStatus(code, claimRef.current as string)
        if (cancelled) return
        if (status.status === 'approved') {
          tvSession.saveDisplayTokens(status.accessToken, status.refreshToken, status.facilityId)
          navigate('/tv/menu', { replace: true })
        }
      } catch {
        if (cancelled) return
        // Most likely expiry (single-use codes die after 10 minutes).
        if (Date.now() >= deadline) {
          setCode(null)
          claimRef.current = null
          setError('Code expired — request a fresh one.')
        }
      }
    }
    const id = window.setInterval(() => void poll(), POLL_MS)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [code, deadline, navigate])

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await tvApi.requestPair(label.trim())
      claimRef.current = res.claimToken
      setCode(res.code)
      setDeadline(Date.now() + res.expiresInSeconds * 1000)
    } catch {
      setError('Could not reach the server — check the connection and retry.')
    } finally {
      setBusy(false)
    }
  }

  const unpair = () => {
    tvSession.clear()
    window.location.reload()
  }

  const saveTimes = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned: TvMealTimes = {
      breakfast: TIME_RE.test(times.breakfast.trim()) ? times.breakfast.trim() : DEFAULT_TV_MEAL_TIMES.breakfast,
      lunch: TIME_RE.test(times.lunch.trim()) ? times.lunch.trim() : DEFAULT_TV_MEAL_TIMES.lunch,
      dinner: TIME_RE.test(times.dinner.trim()) ? times.dinner.trim() : DEFAULT_TV_MEAL_TIMES.dinner,
    }
    setTimes(cleaned)
    saveTvMealTimes(cleaned)
    setSavedTick(t => t + 1)
  }

  const remaining = code ? Math.max(0, Math.ceil((deadline - now.getTime()) / 1000)) : 0

  return (
    <div className="tv-root tv-center" style={{ justifyContent: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: 1400, textAlign: 'left' }}>
        <p className="tv-kicker">Shoreline wall display</p>
        <h1 className="tv-setup-title">Display setup</h1>

        <div className="tv-setup-grid" style={{ marginTop: '2vmin' }}>
          <section className="tv-panel" aria-label="Pairing">
            <h2 className="tv-panel-title">Pairing</h2>
            {DEMO_MODE ? (
              <p className="tv-setup-text">
                Demo preview — pairing is disabled. Boards load sample data.
              </p>
            ) : !code ? (
              <form onSubmit={requestCode}>
                <p className="tv-setup-text">
                  Name this wall, request a code, then ask a <strong>manager</strong> to
                  approve it in the Shoreline web app.
                </p>
                <div className="tv-field">
                  <label htmlFor="tv-label">Display label</label>
                  <input
                    id="tv-label"
                    className="tv-input"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Main Dining"
                    maxLength={64}
                    autoComplete="off"
                  />
                </div>
                <div className="tv-button-row">
                  <button type="submit" className="tv-button" disabled={busy}>
                    {busy ? 'Requesting…' : 'Show pairing code'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p className="tv-setup-text">
                  A manager approves this code in the web app. It expires in{' '}
                  <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong>.
                </p>
                <p className="tv-code" aria-live="polite">{code}</p>
                <p className="tv-note">
                  Approve at {window.location.origin}{import.meta.env.BASE_URL}tv/approve
                </p>
                <div className="tv-button-row">
                  <button
                    type="button"
                    className="tv-button tv-button-secondary"
                    onClick={() => {
                      setCode(null)
                      claimRef.current = null
                      setError(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {error && <p className="tv-error" role="alert">{error}</p>}
            {paired && !DEMO_MODE && (
              <div className="tv-button-row" style={{ marginTop: '2rem' }}>
                <button type="button" className="tv-button tv-button-secondary" onClick={unpair}>
                  Unpair this display
                </button>
              </div>
            )}
          </section>

          <section className="tv-panel" aria-label="Meal times">
            <h2 className="tv-panel-title">Meal times</h2>
            <p className="tv-setup-text">
              TV-local schedule for the countdown and board highlighting. 24-hour HH:MM.
            </p>
            <form onSubmit={saveTimes}>
              <div className="tv-meal-times">
                <div className="tv-field">
                  <label htmlFor="tv-breakfast">Breakfast</label>
                  <input
                    id="tv-breakfast"
                    className="tv-input"
                    value={times.breakfast}
                    onChange={e => setTimes(t => ({ ...t, breakfast: e.target.value }))}
                    placeholder="07:30"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="tv-field">
                  <label htmlFor="tv-lunch">Lunch</label>
                  <input
                    id="tv-lunch"
                    className="tv-input"
                    value={times.lunch}
                    onChange={e => setTimes(t => ({ ...t, lunch: e.target.value }))}
                    placeholder="12:00"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="tv-field">
                  <label htmlFor="tv-dinner">Dinner</label>
                  <input
                    id="tv-dinner"
                    className="tv-input"
                    value={times.dinner}
                    onChange={e => setTimes(t => ({ ...t, dinner: e.target.value }))}
                    placeholder="17:30"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="tv-button-row">
                <button type="submit" className="tv-button">Save meal times</button>
              </div>
              {savedTick > 0 && <p className="tv-saved">Saved.</p>}
            </form>
            <p className="tv-note">Server: {window.location.origin}</p>
          </section>
        </div>

        <footer className="tv-foot">
          <Link to="/tv/menu" className="tv-setup-link" style={{ marginLeft: 0 }}>← Back to boards</Link>
        </footer>
      </div>
    </div>
  )
}
