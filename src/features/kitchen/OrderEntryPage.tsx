import { useState, useEffect, useCallback, useRef } from 'react'

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MEALS = ['Lunch','Supper']

function getMostRecentSunday(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(sunday: string) {
  const d = new Date(sunday + 'T12:00:00')
  const sat = new Date(d); sat.setDate(sat.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${d.toLocaleDateString('en-US', opts)} – ${sat.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function getChoiceClass(choice: number | null, isAlt: boolean, isDeclined: boolean) {
  if (isAlt)      return 'is-alt'
  if (isDeclined) return 'is-declined'
  if (choice === 1) return 'is-c1'
  if (choice === 2) return 'is-c2'
  return ''
}

interface ToastItem {
  id: number
  msg: string
  type: 'success' | 'error'
}

function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' ? '✓' : '!'} {t.msg}
        </div>
      ))}
    </div>
  )
}

interface OrderCellProps {
  order: any
  residentId: string
  weekStart: string
  day: string
  meal: string
  onSave: (payload: any) => Promise<void>
}

function OrderCell({ order, residentId, weekStart, day, meal, onSave }: OrderCellProps) {
  const choice     = order?.choice_selected ?? 1
  const modifier   = order?.modifier_text   ?? ''
  const isAlt      = !!(order?.is_alternative)
  const isDeclined = !!(order?.is_declined)

  const [localChoice,   setLocalChoice]   = useState(isAlt ? 'alt' : isDeclined ? 'declined' : String(choice))
  const [localModifier, setLocalModifier] = useState(modifier)
  const saveTimer = useRef<any>(null)

  useEffect(() => {
    setLocalChoice(
      order?.is_alternative ? 'alt' :
      order?.is_declined    ? 'declined' :
      String(order?.choice_selected ?? 1)
    )
    setLocalModifier(order?.modifier_text ?? '')
  }, [order])

  function scheduleSave(newChoice: string, newModifier: string) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const payload = {
        resident_id:     residentId,
        week_start_date: weekStart,
        day_of_week:     day,
        meal_type:       meal,
        choice_selected: newChoice === 'alt' || newChoice === 'declined' ? null : parseInt(newChoice),
        modifier_text:   newModifier,
        is_alternative:  newChoice === 'alt'      ? 1 : 0,
        is_declined:     newChoice === 'declined' ? 1 : 0,
      }
      onSave(payload)
    }, 600)
  }

  function handleChoice(e: React.ChangeEvent<HTMLSelectElement>) {
    setLocalChoice(e.target.value)
    scheduleSave(e.target.value, localModifier)
  }

  function handleModifier(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalModifier(e.target.value)
    scheduleSave(localChoice, e.target.value)
  }

  const selClass = getChoiceClass(
    parseInt(localChoice),
    localChoice === 'alt',
    localChoice === 'declined'
  )

  return (
    <div className="order-cell-inner" style={{ padding: '8px 12px' }}>
      <select
        className={`order-select ${selClass}`}
        value={localChoice}
        onChange={handleChoice}
        aria-label={`${day} ${meal} order`}
        style={{ fontSize: '0.9rem', padding: '6px 8px', fontWeight: 'bold' }}
      >
        <option value="1">Choice 1</option>
        <option value="2">Choice 2</option>
        <option value="alt">Alternative</option>
        <option value="declined">Declined</option>
      </select>
      <input
        type="text"
        className="order-modifier"
        placeholder="add modifier..."
        value={localModifier}
        onChange={handleModifier}
        maxLength={80}
        aria-label={`${day} ${meal} modifier`}
        style={{
          fontSize: '0.85rem',
          padding: '4px 6px',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-input)',
          marginTop: '4px',
          borderRadius: '4px'
        }}
      />
    </div>
  )
}

function WeekNav({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  function shift(days: number) {
    const d = new Date(week + 'T12:00:00')
    d.setDate(d.getDate() + days)
    onChange(d.toISOString().slice(0, 10))
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => shift(-7)} aria-label="Previous week">‹</button>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', minWidth: 200, textAlign: 'center' }}>
        {formatWeekLabel(week)}
      </span>
      <button className="btn btn-secondary btn-sm" onClick={() => shift(7)} aria-label="Next week">›</button>
      <button className="btn btn-secondary btn-sm" onClick={() => onChange(getMostRecentSunday())} title="Jump to current week">
        Today
      </button>
    </div>
  )
}

export default function OrderEntryPage() {
  const [week,        setWeek]        = useState(getMostRecentSunday())
  const [viewMode,    setViewMode]    = useState<'weekly' | 'day'>('day')
  const [activeDay,   setActiveDay]   = useState(DAYS[new Date().getDay()])
  const [residents,   setResidents]   = useState<any[]>([])
  const [orderMap,    setOrderMap]    = useState<any>({})
  const [loading,     setLoading]     = useState(true)
  const [toasts,      setToasts]      = useState<ToastItem[]>([])
  const [saving,      setSaving]      = useState(false)
  const [initBusy,    setInitBusy]    = useState(false)
  const toastId = useRef(0)

  const token = localStorage.getItem('token') // Fetch auth token from localStorage if required

  function addToast(msg: string, type: 'success' | 'error' = 'success') {
    const id = ++toastId.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  const loadWeek = useCallback(async (w: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kitchen/orders?week=${w}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResidents(data.residents || [])
      setOrderMap(data.orderMap   || {})
    } catch (err) {
      addToast('Failed to load orders', 'error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadWeek(week) }, [week, loadWeek])

  async function handleSave(payload: any) {
    setSaving(true)
    try {
      const res = await fetch('/api/kitchen/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
    } catch {
      addToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function initWeek() {
    if (!confirm(`Initialize all orders for week of ${formatWeekLabel(week)}?\n\nThis will create default rows for every resident. Existing data will NOT be overwritten.`)) return
    setInitBusy(true)
    try {
      const res = await fetch(`/api/kitchen/orders/initialize-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ week })
      })
      if (!res.ok) throw new Error()
      await loadWeek(week)
      addToast('Week initialized — standing alternatives applied automatically')
    } catch {
      addToast('Initialization failed', 'error')
    } finally {
      setInitBusy(false)
    }
  }

  const hasOrders = residents.some(r => orderMap[r.id])

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dietary Tally Entry</h1>
          <p className="page-subtitle">Configure resident meals — update choices on screen</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {saving && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Saving…</span>}
          <button
            id="btn-init-week"
            className="btn btn-primary"
            onClick={initWeek}
            disabled={initBusy}
          >
            {initBusy ? '…' : '⚡'} Initialize Week
          </button>
        </div>
      </div>

      <div className="controls-bar" style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%', flexWrap: 'wrap', marginBottom: 20 }}>
        <WeekNav week={week} onChange={setWeek} />
        
        {/* Toggle Mode button */}
        <div style={{ display: 'inline-flex', background: 'var(--border-subtle)', padding: 4, borderRadius: 'var(--radius-md)' }}>
          <button
            className="btn btn-sm"
            style={{
              background: viewMode === 'day' ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === 'day' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              boxShadow: viewMode === 'day' ? 'var(--shadow-sm)' : 'none'
            }}
            onClick={() => setViewMode('day')}
          >
            📅 Day View
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: viewMode === 'weekly' ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === 'weekly' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              boxShadow: viewMode === 'weekly' ? 'var(--shadow-sm)' : 'none'
            }}
            onClick={() => setViewMode('weekly')}
          >
            🗓️ Weekly Grid
          </button>
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
          Total Residents: {residents.length}
        </span>
      </div>

      {viewMode === 'day' && (
        <div className="card" style={{ display: 'flex', gap: 8, padding: 12, marginBottom: 16, overflowX: 'auto' }}>
          {DAYS.map(day => (
            <button
              key={day}
              className={`btn btn-sm ${activeDay === day ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveDay(day)}
            >
              {day}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading orders…</span>
        </div>
      ) : residents.length === 0 ? (
        <div className="empty-state">
          <span className="icon">👥</span>
          <strong>No residents found</strong>
          <span>Add residents first via the Residents page.</span>
        </div>
      ) : !hasOrders ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: 'rgba(26,86,219,0.06)',
            border: '1.5px solid var(--c1-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              No orders found for this week. Click <strong style={{ color: 'var(--brand-primary)' }}>⚡ Initialize Week</strong> to pre-apply all standing alternative options.
            </span>
          </div>
        </div>
      ) : null}

      {!loading && residents.length > 0 && (
        <div className="order-grid-wrap" style={{ background: '#ffffff', borderRadius: 8 }}>
          <table className="order-grid" role="grid" aria-label="Weekly meal order grid">
            <thead>
              {viewMode === 'weekly' ? (
                <>
                  <tr>
                    <th className="resident-header" rowSpan={2} style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Resident</th>
                    {DAYS.map(day => (
                      <th key={day} className="day-header" colSpan={MEALS.length} style={{ fontSize: '0.85rem' }}>
                        {day}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {DAYS.map(day =>
                      MEALS.map(meal => (
                        <th key={`${day}-${meal}`}>{meal}</th>
                      ))
                    )}
                  </tr>
                </>
              ) : (
                <tr>
                  <th className="resident-header" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Resident</th>
                  <th style={{ fontSize: '0.9rem' }}>{activeDay} Lunch</th>
                  <th style={{ fontSize: '0.9rem' }}>{activeDay} Supper</th>
                </tr>
              )}
            </thead>

            <tbody>
              {residents.map(r => (
                <tr key={r.id}>
                  <td className="resident-cell" style={{ background: '#ffffff', padding: '12px 16px' }}>
                    <div className="resident-name" style={{ fontSize: '0.95rem' }}>{r.name}</div>
                    <div className="resident-room" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Room {r.room}</div>
                    {r.has_standing_alternative === 1 && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-alt" title={r.alternative_description} style={{ fontSize: '0.7rem' }}>ALT: {r.alternative_description}</span>
                      </div>
                    )}
                  </td>
                  
                  {viewMode === 'weekly' ? (
                    DAYS.map(day =>
                      MEALS.map(meal => {
                        const order = orderMap[r.id]?.[day]?.[meal]
                        return (
                          <td key={`${day}-${meal}`} style={{ padding: 0 }}>
                            <OrderCell
                              order={order}
                              residentId={r.id}
                              weekStart={week}
                              day={day}
                              meal={meal}
                              onSave={handleSave}
                            />
                          </td>
                        )
                      })
                    )
                  ) : (
                    MEALS.map(meal => {
                      const order = orderMap[r.id]?.[activeDay]?.[meal]
                      return (
                        <td key={`${activeDay}-${meal}`} style={{ padding: 0 }}>
                          <OrderCell
                            order={order}
                            residentId={r.id}
                            weekStart={week}
                            day={activeDay}
                            meal={meal}
                            onSave={handleSave}
                          />
                        </td>
                      )
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast toasts={toasts} />
    </>
  )
}
