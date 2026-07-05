import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTimecardStore } from '@/state/timecardStore'
import { useAuth } from '@/security/AuthContext'

// ─── helpers ────────────────────────────────────────────────
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const KIOSK_ID = 'Main Terminal'

// ─── Keypad ─────────────────────────────────────────────────
function Keypad({ onPress }: { onPress: (v: string) => void }) {
  const btnStyle = (color?: string): React.CSSProperties => ({
    padding: '15px 0',
    fontSize: 18,
    fontWeight: 700,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: color ?? 'var(--text-primary)',
    cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
    transition: 'border-color 0.15s',
  })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
      {['1','2','3','4','5','6','7','8','9'].map(v => (
        <button key={v} style={btnStyle()} onClick={() => onPress(v)}>{v}</button>
      ))}
      <button style={btnStyle('#dc2626')} onClick={() => onPress('CLEAR')}>CLR</button>
      <button style={btnStyle()} onClick={() => onPress('0')}>0</button>
      <button style={btnStyle('var(--text-muted)')} onClick={() => onPress('BACK')}>⌫</button>
    </div>
  )
}

// ─── Kiosk Terminal Tab ─────────────────────────────────────
function KioskTab() {
  const punch       = useTimecardStore(s => s.punch)
  const isPunching  = useTimecardStore(s => s.isPunching)
  const punchSuccess = useTimecardStore(s => s.punchSuccess)
  const punchError  = useTimecardStore(s => s.punchError)
  const clearMessages = useTimecardStore(s => s.clearMessages)
  const getStatusForBadge = useTimecardStore(s => s.getStatusForBadge)
  const fetchAll    = useTimecardStore(s => s.fetchAll)

  const [badgeId, setBadgeId] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    fetchAll()
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [fetchAll])

  const status = badgeId.length >= 3 ? getStatusForBadge(badgeId) : 'unknown'
  const nextAction: 'In' | 'Out' | null =
    badgeId.length < 3 ? null
    : status === 'in'  ? 'Out'
    : 'In'

  const handleKeypad = useCallback((v: string) => {
    clearMessages()
    if (v === 'CLEAR')    setBadgeId('')
    else if (v === 'BACK') setBadgeId(p => p.slice(0, -1))
    else if (badgeId.length < 10) setBadgeId(p => p + v)
  }, [badgeId, clearMessages])

  const handlePunch = () => punch(badgeId, KIOSK_ID)

  useEffect(() => {
    if (punchSuccess) {
      setBadgeId('')
      const t = setTimeout(() => clearMessages(), 4000)
      return () => clearTimeout(t)
    }
  }, [punchSuccess, clearMessages])

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: '24px 22px',
      }}>
        {/* Clock */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)', letterSpacing: 1 }}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Badge display */}
        <div style={{
          background: 'var(--bg-app)',
          border: `2px solid ${
            badgeId.length === 0 ? 'var(--border-color)'
            : status === 'in'  ? '#059669'
            : status === 'out' ? 'var(--color-primary)'
            : 'var(--border-color)'
          }`,
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          textAlign: 'center',
          fontSize: 24,
          fontWeight: 800,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: 5,
          color: badgeId ? 'var(--text-primary)' : 'var(--text-muted)',
          marginBottom: 6,
        }}>
          {badgeId || 'ENTER BADGE'}
        </div>

        {/* Status hint */}
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, marginBottom: 14,
          color: status === 'in' ? '#059669' : status === 'out' ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {status === 'in'  ? '🟢 Currently clocked IN — press to clock OUT'
           : status === 'out' ? '🔵 Currently clocked OUT — press to clock IN'
           : badgeId.length >= 3 ? '⚪ First punch for this badge'
           : 'Enter badge ID'}
        </div>

        {/* Message */}
        {(punchSuccess || punchError) && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13,
            fontWeight: 600, textAlign: 'center', marginBottom: 14,
            background: punchSuccess ? '#f0fdf4' : '#fef2f2',
            color:      punchSuccess ? '#059669' : '#dc2626',
            border:     `1px solid ${punchSuccess ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {punchSuccess ?? punchError}
          </div>
        )}

        {/* Keypad */}
        <div style={{ marginBottom: 16 }}>
          <Keypad onPress={handleKeypad} />
        </div>

        {/* Punch button */}
        <button
          disabled={isPunching || badgeId.length < 3}
          onClick={handlePunch}
          style={{
            width: '100%', padding: '15px 0', fontSize: 16, fontWeight: 800,
            borderRadius: 'var(--radius-md)', border: 'none', cursor: badgeId.length < 3 ? 'not-allowed' : 'pointer',
            fontFamily: 'Outfit, sans-serif', letterSpacing: 1, transition: 'opacity 0.15s',
            opacity: badgeId.length < 3 ? 0.45 : 1,
            background: nextAction === 'Out' ? '#059669' : 'var(--color-primary)',
            color: '#fff',
          }}
        >
          {isPunching ? 'Processing…'
           : nextAction === 'Out' ? '🟢 CLOCK OUT'
           : '🔵 CLOCK IN'}
        </button>
      </div>
    </div>
  )
}

// ─── Manager History Tab ─────────────────────────────────────
function HistoryTab() {
  const { atLeast } = useAuth()
  const fetchAll        = useTimecardStore(s => s.fetchAll)
  const punches         = useTimecardStore(s => s.punches)
  const isLoading       = useTimecardStore(s => s.isLoading)
  const error           = useTimecardStore(s => s.error)
  const getShiftSummaries = useTimecardStore(s => s.getShiftSummaries)

  const [view, setView] = useState<'summary' | 'detail'>('summary')
  const [filterBadge, setFilterBadge] = useState('')
  const [filterDays, setFilterDays]   = useState<7 | 14 | 30 | 0>(7)

  useEffect(() => { fetchAll() }, [fetchAll])

  const isManager = atLeast('manager')

  const cutoff = useMemo(() => {
    if (filterDays === 0) return null
    const d = new Date()
    d.setDate(d.getDate() - filterDays)
    return d
  }, [filterDays])

  const filteredPunches = useMemo(() => {
    return punches.filter(p => {
      const matchBadge = !filterBadge || p.badge_id.toLowerCase().includes(filterBadge.toLowerCase())
      const matchDate  = !cutoff || new Date(p.punched_at) >= cutoff
      return matchBadge && matchDate
    })
  }, [punches, filterBadge, cutoff])

  const summaries = useMemo(() => {
    const all = getShiftSummaries()
    return filterBadge ? all.filter(s => s.badgeId.toLowerCase().includes(filterBadge.toLowerCase())) : all
  }, [getShiftSummaries, filterBadge])

  const inputStyle: React.CSSProperties = {
    padding: '9px 13px', background: 'var(--bg-card)',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
    fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'Outfit, sans-serif',
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="Filter by Badge ID…"
          value={filterBadge}
          onChange={e => setFilterBadge(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 180px', minWidth: 120 }}
        />
        <select
          value={filterDays}
          onChange={e => setFilterDays(Number(e.target.value) as 7|14|30|0)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={0}>All time</option>
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['summary', 'detail'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '9px 16px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              background: view === v ? 'var(--color-primary)' : 'var(--bg-card)',
              color: view === v ? '#fff' : 'var(--text-secondary)',
            }}>
              {v === 'summary' ? '📊 Summary' : '📋 All Punches'}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchAll()}
          disabled={isLoading}
          style={{ ...inputStyle, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          {isLoading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* SUMMARY VIEW */}
      {view === 'summary' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {summaries.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {isLoading ? 'Loading…' : 'No punch records found.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Badge ID', 'Status', 'Shifts', 'Total Hours', 'Overtime', 'Last Punch'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={s.badgeId} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-app)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
                      #{s.badgeId}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: s.currentlyIn ? '#f0fdf4' : 'var(--bg-app)',
                        color: s.currentlyIn ? '#059669' : 'var(--text-muted)',
                        border: `1px solid ${s.currentlyIn ? '#bbf7d0' : 'var(--border-color)'}`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.currentlyIn ? '#059669' : 'var(--text-muted)', flexShrink: 0 }} />
                        {s.currentlyIn ? 'Clocked In' : 'Clocked Out'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.shiftCount}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMins(s.totalMinutes)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {s.overtimeMinutes > 0 ? (
                        <span style={{ color: '#d97706', fontWeight: 700 }}>⚠ {fmtMins(s.overtimeMinutes)}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.lastPunchAt ? fmtDateTime(s.lastPunchAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {filteredPunches.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {isLoading ? 'Loading…' : 'No punch records match this filter.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Badge ID', 'Action', 'Kiosk', 'Date & Time', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPunches.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-app)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>#{p.badge_id}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: p.operation === 'In' ? 'var(--color-primary-light)' : '#fef2f2',
                        color: p.operation === 'In' ? 'var(--color-primary)' : '#dc2626',
                        border: `1px solid ${p.operation === 'In' ? 'var(--color-primary)' : '#fecaca'}`,
                      }}>
                        {p.operation === 'In' ? '🔵 IN' : '🟠 OUT'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{p.kiosk_id}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(p.punched_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{fmtTime(p.punched_at)}</strong>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{p.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!isManager && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
          Full shift summaries and overtime flags are visible to managers and above.
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────
export default function TimecardPage() {
  const [tab, setTab] = useState<'terminal' | 'history'>('terminal')

  const tabBtn = (id: typeof tab, label: string): React.CSSProperties => ({
    padding: '10px 18px', background: 'none', border: 'none',
    borderBottom: tab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: tab === id ? 'var(--color-primary)' : 'var(--text-secondary)',
    fontWeight: tab === id ? 700 : 500, fontSize: 14,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
  })

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.4px', margin: 0 }}>
          ⏱ Time Clock
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          Staff clock in and out by entering their badge ID on the kiosk keypad.
        </p>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24, gap: 4 }}>
        <button style={tabBtn('terminal', '')} onClick={() => setTab('terminal')}>⌨️ Kiosk Terminal</button>
        <button style={tabBtn('history', '')} onClick={() => setTab('history')}>📊 Punch History</button>
      </div>

      {tab === 'terminal' && <KioskTab />}
      {tab === 'history'  && <HistoryTab />}
    </div>
  )
}
