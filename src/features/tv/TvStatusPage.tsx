/**
 * TV kitchen-status board: production sign-off progress and today's tray
 * flow as counts only. Resident-level detail never leaves the server.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tvApi, type CrewToday, type OpsToday } from '@/api/tv'
import {
  ageLabel,
  formatToday,
  loadSnapshot,
  saveSnapshot,
  useNow,
} from './tvData'
import './tv.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const SNAPSHOT_KEY = 'shoreline:tv-ops-snapshot'
const CREW_SNAPSHOT_KEY = 'shoreline:tv-crew-snapshot'
const REFRESH_MS = 30000

export default function TvStatusPage() {
  const [ops, setOps] = useState<OpsToday | null>(null)
  const [crew, setCrew] = useState<CrewToday | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const now = useNow(1000)

  const load = useCallback(async () => {
    if (DEMO_MODE) {
      const { SEED_PRODUCTION_SHEETS, isDemoSeedAllowed } = await import('@/demo/seed')
      if (!isDemoSeedAllowed()) {
        setFatal('Demo data is unavailable in this build.')
        return
      }
      const total = SEED_PRODUCTION_SHEETS.length
      const signedOff = SEED_PRODUCTION_SHEETS.filter(s => s.signedOffAt).length
      setOps({
        date: new Date().toISOString().slice(0, 10),
        facilityName: 'Shoreline Care Center',
        production: { total, signedOff, pending: total - signedOff },
        trays: { runs: 0, assembled: 0, dispatched: 0, delivered: 0, missed: 0, remade: 0 },
        generatedAt: new Date().toISOString(),
      })
      setFetchedAt(new Date().toISOString())
      setStale(false)
      setFatal(null)
      return
    }
    try {
      const data = await tvApi.opsToday()
      saveSnapshot(SNAPSHOT_KEY, data)
      setOps(data)
      setFetchedAt(new Date().toISOString())
      setStale(false)
      setFatal(null)
    } catch {
      const cached = loadSnapshot<OpsToday>(SNAPSHOT_KEY)
      if (cached) {
        setOps(cached.data)
        setFetchedAt(cached.fetchedAt)
        setStale(true)
        setFatal(null)
      } else {
        setFatal('Status unavailable — check the server connection, then re-pair from Setup if needed.')
      }
    }
    // Crew loads independently: a crew failure must not blank the ops board.
    try {
      const data = await tvApi.crewToday()
      saveSnapshot(CREW_SNAPSHOT_KEY, data)
      setCrew(data)
    } catch {
      const cached = loadSnapshot<CrewToday>(CREW_SNAPSHOT_KEY)
      if (cached) setCrew(cached.data)
    }
  }, [])

  useEffect(() => {
    void load()
    if (DEMO_MODE) return
    const id = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') window.scrollBy({ top: 420, behavior: 'smooth' })
    else if (e.key === 'ArrowUp') window.scrollBy({ top: -420, behavior: 'smooth' })
  }, [])

  const pct = ops && ops.production.total > 0
    ? Math.round((ops.production.signedOff / ops.production.total) * 100)
    : 0

  return (
    <div onKeyDown={onKeyDown}>
      <div className="tv-headline-row">
        <h1 className="tv-date">{formatToday(now)}</h1>
        {ops && <span className="tv-week">{ops.facilityName}</span>}
      </div>

      {fatal && (
        <div className="tv-panel" role="alert">
          <p className="tv-panel-title">Status unavailable</p>
          <p className="tv-note">{fatal}</p>
        </div>
      )}

      {!fatal && ops && (
        <div className="tv-status-grid">
          <section className="tv-panel" aria-label="Production sign-off">
            <h2 className="tv-panel-title">Production sign-off</h2>
            <div className="tv-big-stats">
              <div className="tv-stat tv-stat-good">
                <span className="tv-stat-value">{ops.production.signedOff}</span>
                <span className="tv-stat-label">Signed off</span>
              </div>
              <div className={ops.production.pending > 0 ? 'tv-stat tv-stat-warn' : 'tv-stat'}>
                <span className="tv-stat-value">{ops.production.pending}</span>
                <span className="tv-stat-label">Pending</span>
              </div>
              <div className="tv-stat">
                <span className="tv-stat-value">{ops.production.total}</span>
                <span className="tv-stat-label">Sheets</span>
              </div>
            </div>
            <div className="tv-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Sign-off progress">
              <div className="tv-meter-fill" style={{ width: `${pct}%` }} />
            </div>
          </section>

          <section className="tv-panel" aria-label="Tray flow">
            <h2 className="tv-panel-title">Today&apos;s trays</h2>
            <div className="tv-flow">
              <div className="tv-flow-step">
                <span className="tv-stat-value">{ops.trays.assembled}</span>
                <span className="tv-stat-label">Assembled</span>
              </div>
              <span className="tv-flow-arrow" aria-hidden="true">→</span>
              <div className="tv-flow-step">
                <span className="tv-stat-value">{ops.trays.dispatched}</span>
                <span className="tv-stat-label">Dispatched</span>
              </div>
              <span className="tv-flow-arrow" aria-hidden="true">→</span>
              <div className="tv-flow-step">
                <span className="tv-stat-value">{ops.trays.delivered}</span>
                <span className="tv-stat-label">Delivered</span>
              </div>
            </div>
            <div className="tv-big-stats" style={{ marginTop: '1.6vmin' }}>
              <div className={ops.trays.missed > 0 ? 'tv-stat tv-stat-bad' : 'tv-stat'}>
                <span className="tv-stat-value">{ops.trays.missed}</span>
                <span className="tv-stat-label">Missed</span>
              </div>
              <div className={ops.trays.remade > 0 ? 'tv-stat tv-stat-warn' : 'tv-stat'}>
                <span className="tv-stat-value">{ops.trays.remade}</span>
                <span className="tv-stat-label">Remade</span>
              </div>
              <div className="tv-stat">
                <span className="tv-stat-value">{ops.trays.runs}</span>
                <span className="tv-stat-label">Runs</span>
              </div>
            </div>
            {DEMO_MODE && (
              <p className="tv-note">Demo preview — live tray counts come from the facility server.</p>
            )}
          </section>

          {crew && crew.crew.length > 0 && (
            <section className="tv-panel tv-span-all" aria-label="Kitchen crew">
              <h2 className="tv-panel-title">Kitchen crew</h2>
              <div className="tv-crew-list">
                {crew.crew.map(member => (
                  <div key={member.name} className="tv-crew-member">
                    <span className="tv-crew-name">{member.name}</span>
                    <span className="tv-crew-role">{member.position}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="tv-foot">
        {stale && <span className="tv-stale">Offline — last update {fetchedAt ? ageLabel(fetchedAt, now.getTime()) : ''}</span>}
        {!stale && fetchedAt && <span>Updated {ageLabel(fetchedAt, now.getTime())}</span>}
        <Link to="/tv/setup" className="tv-setup-link">Display setup</Link>
      </footer>
    </div>
  )
}
