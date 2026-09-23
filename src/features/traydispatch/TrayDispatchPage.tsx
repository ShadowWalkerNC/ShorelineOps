import { useCallback, useEffect, useState } from 'react'
import { Bell, Truck, CheckCircle2, AlertTriangle, RotateCcw, Plus } from 'lucide-react'
import { tokenManager } from '../../security/tokenManager'

/**
 * B12 — Tray dispatch checklist (aide phone/tablet view).
 *
 * Per meal service + wing/route: shows every tray line with its latest event,
 * one-tap buttons to advance the lifecycle (assembled → dispatched →
 * delivered / missed / remade), and a missed-tray SLA banner (in-app only —
 * no SMS/push). All touch targets are ≥48px.
 */

interface TrayRun {
  id: string
  mealSlot: string
  serviceDate: string
  wing: string
  notes: string
  createdAt: string
}

interface ChecklistLine {
  key: string
  residentId: string | null
  residentName: string | null
  room: string | null
  dietType: string | null
  isNpo: boolean
  ticketId: string
  latestEvent: 'assembled' | 'dispatched' | 'delivered' | 'missed' | 'remade'
  latestAt: string
  latestNote: string
  isTerminal: boolean
  allowedNext: string[]
  isOverdue: boolean
  history: { id: string; event: string; at: string; by: string | null; note: string; ticketId: string }[]
}

interface MissedTray {
  key: string
  kind: 'overdue' | 'missed'
  minutesOverdue: number | null
  residentName: string | null
  room: string | null
  ticketId: string
  mealSlot: string
  wing: string
}

interface ChecklistResponse {
  run: TrayRun
  slaMinutes: number
  summary: { total: number; assembled: number; dispatched: number; delivered: number; missed: number; remade: number; overdue: number }
  lines: ChecklistLine[]
  missed: MissedTray[]
}

const MEAL_SLOTS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'] as const

const EVENT_LABEL: Record<string, string> = {
  assembled: 'Assembled',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  missed: 'Missed',
  remade: 'Remade',
}

const EVENT_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  assembled:  { bg: '#fffbeb', fg: '#92400e', border: '#fcd34d' },
  dispatched: { bg: '#eff6ff', fg: '#1d4ed8', border: '#93c5fd' },
  delivered:  { bg: '#f0fdf4', fg: '#15803d', border: '#86efac' },
  missed:     { bg: '#fef2f2', fg: '#b91c1c', border: '#fca5a5' },
  remade:     { bg: '#faf5ff', fg: '#7e22ce', border: '#c4b5fd' },
}

function authHeaders(): Record<string, string> {
  const token = tokenManager.getAccessToken() ?? localStorage.getItem('shoreline_auth_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

const btnBase: React.CSSProperties = {
  minHeight: 48,
  minWidth: 48,
  padding: '12px 18px',
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
}

export default function TrayDispatchPage() {
  const [runs, setRuns] = useState<TrayRun[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New-run form
  const [newMealSlot, setNewMealSlot] = useState<string>('lunch')
  const [newWing, setNewWing] = useState('')

  // Add-tray form
  const [residentQuery, setResidentQuery] = useState('')
  const [residentResults, setResidentResults] = useState<any[]>([])
  const [selectedResident, setSelectedResident] = useState<any | null>(null)
  const [newTicketId, setNewTicketId] = useState('')

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/trayruns?serviceDate=${todayString()}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`Failed to load runs (${res.status})`)
      const data: TrayRun[] = await res.json()
      setRuns(data)
      setActiveRunId((prev) => prev ?? data[0]?.id ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChecklist = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/trayruns/${runId}/checklist`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`Failed to load checklist (${res.status})`)
      setChecklist(await res.json())
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  useEffect(() => {
    if (!activeRunId) { setChecklist(null); return }
    loadChecklist(activeRunId)
    const t = setInterval(() => loadChecklist(activeRunId), 30000)
    return () => clearInterval(t)
  }, [activeRunId, loadChecklist])

  const createRun = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/trayruns', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ mealSlot: newMealSlot, serviceDate: todayString(), wing: newWing.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create run')
      setRuns((prev) => [data, ...prev])
      setActiveRunId(data.id)
      setNewWing('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const postEvent = async (line: ChecklistLine, event: string) => {
    let note = ''
    let newTicket = ''
    if (event === 'missed') {
      const reason = window.prompt(`Why was ${line.residentName ?? line.ticketId}'s tray missed?`, '')
      if (reason == null) return
      if (!reason.trim()) { setError('A reason is required for missed trays'); return }
      note = reason.trim()
    }
    if (event === 'remade') {
      const reason = window.prompt(`Why is ${line.residentName ?? line.ticketId}'s tray being remade?`, '')
      if (reason == null) return
      const ticket = window.prompt('New tray ticket id (from the reprinted tray card):', '')
      if (ticket == null) return
      if (!ticket.trim()) { setError('The new ticket id is required for remakes'); return }
      note = reason.trim()
      newTicket = ticket.trim()
    }
    if (event === 'dispatched' && !window.confirm(`Dispatch tray for ${line.residentName ?? line.ticketId} (Room ${line.room ?? '—'})?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/trayruns/${activeRunId}/events`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          residentId: line.residentId,
          ticketId: line.ticketId,
          event,
          note,
          ...(newTicket ? { newTicketId: newTicket } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Failed to record ${event}`)
      if (activeRunId) await loadChecklist(activeRunId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const searchResidents = async (q: string) => {
    setResidentQuery(q)
    setSelectedResident(null)
    if (q.trim().length < 2) { setResidentResults([]); return }
    try {
      const res = await fetch(`/api/residents?q=${encodeURIComponent(q.trim())}`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setResidentResults(Array.isArray(data) ? data.slice(0, 8) : [])
    } catch { /* non-fatal */ }
  }

  const addTray = async () => {
    if (!selectedResident) { setError('Select a resident first'); return }
    if (!newTicketId.trim()) { setError('Scan or paste the complete signed tray QR code'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/trayruns/${activeRunId}/events`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          residentId: selectedResident.id,
          rawQrPayload: newTicketId.trim(),
          event: 'assembled',
          note: 'Assembly recorded using signed tray card',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to record assembled')
      setSelectedResident(null)
      setResidentQuery('')
      setResidentResults([])
      setNewTicketId('')
      if (activeRunId) await loadChecklist(activeRunId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const summary = checklist?.summary

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell className="w-6 h-6 text-teal-600" />
        <span>Tray Dispatch</span>
      </h1>
      <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: 14 }}>
        Track every tray from assembly to the bedside. Today: {todayString()}
      </p>

      {error && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 8, minHeight: 44, padding: '0 12px' }}>Dismiss</button>
        </div>
      )}

      {/* Run picker / creator */}
      <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRunId(r.id)}
              style={{
                ...btnBase,
                background: r.id === activeRunId ? '#0d9488' : '#f1f5f9',
                color: r.id === activeRunId ? '#fff' : '#0f172a',
                fontSize: 14,
              }}
            >
              {r.mealSlot}{r.wing ? ` · ${r.wing}` : ''}
            </button>
          ))}
          {runs.length === 0 && !loading && <span style={{ color: '#64748b', fontSize: 14 }}>No runs yet today — create one below.</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select value={newMealSlot} onChange={(e) => setNewMealSlot(e.target.value)}
            style={{ ...btnBase, background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: 14 }}>
            {MEAL_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={newWing} onChange={(e) => setNewWing(e.target.value)} placeholder="Wing / route (e.g. West Wing)"
            style={{ ...btnBase, background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: 14, flex: '1 1 160px' }} />
          <button onClick={createRun} disabled={busy}
            style={{ ...btnBase, background: '#0d9488', color: '#fff', fontSize: 14, opacity: busy ? 0.6 : 1 }}>
            + New run
          </button>
        </div>
      </div>

      {!activeRunId && !loading && (
        <p style={{ color: '#64748b' }}>Create a tray run above to start tracking this meal's trays.</p>
      )}

      {/* Missed-tray SLA alert (in-app surface) */}
      {checklist && checklist.missed.length > 0 && (
        <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{checklist.missed.length} tray{checklist.missed.length > 1 ? 's' : ''} need{checklist.missed.length === 1 ? 's' : ''} attention (SLA {checklist.slaMinutes} min)</span>
          </div>
          {checklist.missed.map((m) => (
            <div key={m.key} style={{ padding: '8px 0', borderTop: '1px solid #fecaca', fontSize: 15, color: '#7f1d1d' }}>
              <strong>{m.residentName ?? m.ticketId}</strong>{m.room ? ` — Room ${m.room}` : ''}
              {' · '}
              {m.kind === 'overdue'
                ? `dispatched ${m.minutesOverdue} min past SLA`
                : 'marked missed'}
            </div>
          ))}
        </div>
      )}

      {/* Summary chips */}
      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {(['assembled', 'dispatched', 'delivered', 'missed', 'remade'] as const).map((ev) => (
            <span key={ev} style={{
              ...EVENT_COLOR[ev], border: `1px solid ${EVENT_COLOR[ev].border}`,
              borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700,
              background: EVENT_COLOR[ev].bg, color: EVENT_COLOR[ev].fg,
            }}>
              {EVENT_LABEL[ev]}: {summary[ev]}
            </span>
          ))}
        </div>
      )}

      {/* Checklist */}
      {checklist && checklist.lines.length === 0 && (
        <p style={{ color: '#64748b' }}>
          No trays on this run yet. Scan tray cards at the assembly station (they auto-attach),
          or scan the complete signed QR code below.
        </p>
      )}
      {checklist?.lines.map((line) => {
        const chip = EVENT_COLOR[line.latestEvent]
        return (
          <div key={line.key} style={{
            background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)',
            borderLeft: line.isOverdue ? '6px solid #ef4444' : `6px solid ${chip.border}`,
            borderRadius: 12, padding: 12, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>
                  {line.residentName ?? 'Unknown resident'}
                  {line.room && <span style={{ fontWeight: 400, color: '#64748b' }}> — Room {line.room}</span>}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {line.ticketId}{line.dietType ? ` · ${line.dietType}` : ''}
                  {line.isNpo && <span style={{ color: '#b91c1c', fontWeight: 800 }}> · NPO</span>}
                </div>
              </div>
              <span style={{
                background: chip.bg, color: chip.fg, border: `1px solid ${chip.border}`,
                borderRadius: 999, padding: '8px 14px', fontSize: 14, fontWeight: 800,
              }}>
                {EVENT_LABEL[line.latestEvent]}{line.isOverdue && line.latestEvent === 'dispatched' ? ' — OVERDUE' : ''}
              </span>
            </div>
            {line.latestNote && (
              <div style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{line.latestNote}</div>
            )}
            {!line.isTerminal && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {line.allowedNext.includes('dispatched') && (
                  <button onClick={() => postEvent(line, 'dispatched')} disabled={busy}
                    style={{ ...btnBase, background: '#2563eb', color: '#fff', flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Truck className="w-4 h-4" />
                    <span>Mark dispatched</span>
                  </button>
                )}
                {line.allowedNext.includes('delivered') && (
                  <button onClick={() => postEvent(line, 'delivered')} disabled={busy}
                    style={{ ...btnBase, background: '#16a34a', color: '#fff', flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark delivered</span>
                  </button>
                )}
                {line.allowedNext.includes('missed') && (
                  <button onClick={() => postEvent(line, 'missed')} disabled={busy}
                    style={{ ...btnBase, background: '#dc2626', color: '#fff', flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <AlertTriangle className="w-4 h-4" />
                    <span>Missed…</span>
                  </button>
                )}
                {line.allowedNext.includes('remade') && (
                  <button onClick={() => postEvent(line, 'remade')} disabled={busy}
                    style={{ ...btnBase, background: '#7c3aed', color: '#fff', flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <RotateCcw className="w-4 h-4" />
                    <span>Remake…</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Manual add-tray */}
      {activeRunId && (
        <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 12, marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus className="w-4 h-4 text-teal-600" />
            <span>Add tray to run</span>
          </div>
          <label htmlFor="tray-resident-search">Resident</label>
          <input id="tray-resident-search" value={residentQuery} onChange={(e) => searchResidents(e.target.value)}
            placeholder="Search resident by name or room…"
            style={{ ...btnBase, width: '100%', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: 15, marginBottom: 8 }} />
          {residentResults.map((r) => (
            <button key={r.id} onClick={() => { setSelectedResident(r); setResidentResults([]); setResidentQuery(`${r.name} — Room ${r.room}`) }}
              style={{ ...btnBase, width: '100%', textAlign: 'left', background: '#f1f5f9', fontSize: 15, marginBottom: 6, fontWeight: 500 }}>
              {r.name} — Room {r.room}{r.is_npo ? ' (NPO)' : ''}
            </button>
          ))}
          <label htmlFor="tray-signed-code">Complete signed tray QR code</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input id="tray-signed-code" value={newTicketId} onChange={(e) => setNewTicketId(e.target.value)}
              placeholder="Scan or paste the full QR code"
              style={{ ...btnBase, background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: 15, flex: '1 1 160px' }} />
            <button onClick={addTray} disabled={busy || !selectedResident}
              style={{ ...btnBase, background: '#0d9488', color: '#fff', fontSize: 15, opacity: busy || !selectedResident ? 0.6 : 1 }}>
              Verify and record assembly
            </button>
          </div>
          {selectedResident?.is_npo && (
            <div style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
              NPO: this resident cannot receive a tray.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
