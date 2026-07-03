import { useState } from 'react'

type CallOut = {
  id: string
  staffName: string
  date: string
  shift: 'Morning' | 'Midday' | 'Evening'
  reason: string
  coveredBy: string
  status: 'Open' | 'Covered' | 'No Cover'
}

const SHIFT_OPTIONS = ['Morning', 'Midday', 'Evening'] as const
const STATUS_COLORS: Record<CallOut['status'], { bg: string; color: string; border: string }> = {
  Open:       { bg: '#fef3c7', color: '#d97706', border: '#fbbf24' },
  Covered:    { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  'No Cover': { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
}

export default function CallOuts() {
  const [callouts, setCallouts] = useState<CallOut[]>([
    { id: '1', staffName: 'Maria Santos',   date: '2026-07-02', shift: 'Morning', reason: 'Illness',          coveredBy: 'Janice K.',   status: 'Covered' },
    { id: '2', staffName: 'Tom Brecker',    date: '2026-07-03', shift: 'Evening', reason: 'Family emergency', coveredBy: '',            status: 'Open' },
    { id: '3', staffName: 'Denise Fowler',  date: '2026-07-04', shift: 'Midday',  reason: 'Personal day',    coveredBy: '',            status: 'No Cover' },
  ])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staffName: '', date: '', shift: 'Morning' as CallOut['shift'], reason: '', coveredBy: '' })
  const [filter, setFilter] = useState<CallOut['status'] | 'All'>('All')

  function addCallOut() {
    if (!form.staffName.trim() || !form.date) return
    setCallouts(prev => [...prev, {
      id: Date.now().toString(),
      ...form,
      status: form.coveredBy.trim() ? 'Covered' : 'Open',
    }])
    setForm({ staffName: '', date: '', shift: 'Morning', reason: '', coveredBy: '' })
    setShowForm(false)
  }

  function updateStatus(id: string, status: CallOut['status']) {
    setCallouts(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  function remove(id: string) { setCallouts(prev => prev.filter(c => c.id !== id)) }

  const shown = filter === 'All' ? callouts : callouts.filter(c => c.status === filter)

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['All', 'Open', 'Covered', 'No Cover'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? 'var(--color-primary)' : 'var(--bg-app)',
              color: filter === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filter === s ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)', padding: '6px 14px',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{
          background: 'var(--color-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', padding: '8px 18px',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Log Call-Out</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[['Staff Name', 'staffName', 'text', 'e.g. Jane Doe'], ['Date', 'date', 'date', ''], ['Reason', 'reason', 'text', 'e.g. Illness'], ['Covered By', 'coveredBy', 'text', 'Leave blank if open']].map(([label, key, type, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} style={inp} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Shift</label>
            <select style={inp} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value as CallOut['shift'] }))}>
              {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={addCallOut} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {shown.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>No call-outs found.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(c => {
          const sc = STATUS_COLORS[c.status]
          return (
            <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.staffName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.date} · {c.shift} Shift</div>
                {c.reason && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Reason: {c.reason}</div>}
                {c.coveredBy && <div style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 2 }}>Covered by: <b>{c.coveredBy}</b></div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 10, padding: '3px 10px' }}>{c.status}</span>
              <select value={c.status} onChange={e => updateStatus(c.id, e.target.value as CallOut['status'])} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}>
                <option value="Open">Open</option>
                <option value="Covered">Covered</option>
                <option value="No Cover">No Cover</option>
              </select>
              <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
