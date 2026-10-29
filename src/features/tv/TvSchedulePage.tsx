/**
 * TV staff-schedule board: today's dietary shifts grouped by shift block,
 * with a call-out coverage banner. Names + positions + stations only —
 * call-out reasons and replacements never leave the server.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tvApi, type ScheduleToday, type ShiftEntry } from '@/api/tv'
import {
  ageLabel,
  formatToday,
  loadSnapshot,
  saveSnapshot,
  useNow,
} from './tvData'
import './tv.css'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const SNAPSHOT_KEY = 'shoreline:tv-schedule-snapshot'
const REFRESH_MS = 30000

const SHIFT_ORDER = ['Morning', 'Midday', 'Evening']

const DEMO_SHIFTS: ShiftEntry[] = [
  { name: 'Marcus Vance', position: 'Executive Chef', shift: 'Morning', station: 'Lead' },
  { name: 'Carlos Mendez', position: 'Lead Cook', shift: 'Morning', station: 'Hot line' },
  { name: 'Jordan Ellis', position: 'Dietary Aide', shift: 'Morning', station: 'Tray assembly' },
  { name: 'Priya Nair', position: 'Cook', shift: 'Midday', station: 'Cold prep' },
  { name: 'Sam Okafor', position: 'Dietary Aide', shift: 'Midday', station: 'Dish' },
  { name: 'Tom Baker', position: 'Prep Cook', shift: 'Evening', station: 'Prep' },
]

function groupShifts(shifts: ShiftEntry[]): Array<{ shift: string; members: ShiftEntry[] }> {
  const groups = new Map<string, ShiftEntry[]>()
  for (const entry of shifts) {
    const key = entry.shift || 'Unassigned'
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = SHIFT_ORDER.indexOf(a)
      const bi = SHIFT_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([shift, members]) => ({ shift, members }))
}

export default function TvSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleToday | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const now = useNow(1000)

  const load = useCallback(async () => {
    if (DEMO_MODE) {
      setSchedule({
        date: new Date().toISOString().slice(0, 10),
        shifts: DEMO_SHIFTS,
        coverage: { callOuts: 2, uncovered: 1, byShift: { Morning: 1, Midday: 1 } },
        generatedAt: new Date().toISOString(),
      })
      setFetchedAt(new Date().toISOString())
      setStale(false)
      setFatal(null)
      return
    }
    try {
      const data = await tvApi.scheduleToday()
      saveSnapshot(SNAPSHOT_KEY, data)
      setSchedule(data)
      setFetchedAt(new Date().toISOString())
      setStale(false)
      setFatal(null)
    } catch {
      const cached = loadSnapshot<ScheduleToday>(SNAPSHOT_KEY)
      if (cached) {
        setSchedule(cached.data)
        setFetchedAt(cached.fetchedAt)
        setStale(true)
        setFatal(null)
      } else {
        setFatal('Schedule unavailable — check the server connection, then re-pair from Setup if needed.')
      }
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

  const groups = schedule ? groupShifts(schedule.shifts) : []
  const coverage = schedule?.coverage

  return (
    <div onKeyDown={onKeyDown}>
      <div className="tv-headline-row">
        <h1 className="tv-date">{formatToday(now)}</h1>
        {schedule && <span className="tv-week">Staff schedule</span>}
      </div>

      {fatal && (
        <div className="tv-panel" role="alert">
          <p className="tv-panel-title">Schedule unavailable</p>
          <p className="tv-note">{fatal}</p>
        </div>
      )}

      {!fatal && schedule && coverage && coverage.uncovered > 0 && (
        <div className="tv-panel tv-alert" role="alert">
          <p className="tv-panel-title">Coverage needed</p>
          <p className="tv-note">
            {coverage.uncovered} of {coverage.callOuts} call-out{coverage.callOuts === 1 ? '' : 's'} uncovered
            {Object.entries(coverage.byShift).map(([shift, n]) => ` · ${shift}: ${n}`).join('')}
          </p>
        </div>
      )}

      {!fatal && schedule && groups.length === 0 && (
        <div className="tv-panel">
          <p className="tv-empty">No shifts posted for today.</p>
        </div>
      )}

      {!fatal && schedule && groups.length > 0 && (
        <div className="tv-status-grid">
          {groups.map(group => (
            <section key={group.shift} className="tv-panel" aria-label={`${group.shift} shift`}>
              <h2 className="tv-panel-title">
                {group.shift}
                <span className="tv-shift-count">{group.members.length}</span>
              </h2>
              <div className="tv-crew-list">
                {group.members.map(member => (
                  <div key={member.name} className="tv-crew-member">
                    <span className="tv-crew-name">{member.name}</span>
                    <span className="tv-crew-role">
                      {member.station ? `${member.position} · ${member.station}` : member.position}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="tv-foot">
        {stale && <span className="tv-stale">Offline — last update {fetchedAt ? ageLabel(fetchedAt, now.getTime()) : ''}</span>}
        {!stale && fetchedAt && <span>Updated {ageLabel(fetchedAt, now.getTime())}</span>}
        {DEMO_MODE && <span className="tv-note">Demo preview — live shifts come from the facility server.</span>}
        <Link to="/tv/setup" className="tv-setup-link">Display setup</Link>
      </footer>
    </div>
  )
}
