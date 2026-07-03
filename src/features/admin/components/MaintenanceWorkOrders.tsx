import { useState } from 'react'

type Priority = 'Low' | 'Medium' | 'High' | 'Emergency'
type OrderStatus = 'Active' | 'In Progress' | 'Completed' | 'Cancelled'

type WorkOrder = {
  id: string
  refId: string
  date: string
  equipment: string
  location: string
  priority: Priority
  submittedBy: string
  description: string
  status: OrderStatus
}

const PRIORITY_COLORS: Record<Priority, { bg: string; color: string; border: string }> = {
  Low:       { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  Medium:    { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  High:      { bg: '#fef3c7', color: '#d97706', border: '#fbbf24' },
  Emergency: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
}

const STATUS_COLORS: Record<OrderStatus, { bg: string; color: string; border: string }> = {
  Active:      { bg: '#fef3c7', color: '#d97706', border: '#fbbf24' },
  'In Progress':{ bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  Completed:   { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  Cancelled:   { bg: 'var(--bg-app)', color: 'var(--text-muted)', border: 'var(--border-color)' },
}

function genRefId() {
  return 'WO-' + Date.now().toString().slice(-6)
}

export default function MaintenanceWorkOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'All'>('All')
  const [form, setForm] = useState({
    equipment: '', location: '', priority: 'Medium' as Priority,
    submittedBy: '', description: '',
    date: new Date().toISOString().slice(0, 10),
  })

  function add() {
    if (!form.equipment.trim() || !form.submittedBy.trim()) return
    setOrders(prev => [{
      id: Date.now().toString(),
      refId: genRefId(),
      date: form.date,
      equipment: form.equipment.trim(),
      location: form.location.trim(),
      priority: form.priority,
      submittedBy: form.submittedBy.trim(),
      description: form.description.trim(),
      status: 'Active',
    }, ...prev])
    setForm({ equipment: '', location: '', priority: 'Medium', submittedBy: '', description: '', date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
  }

  function updateStatus(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  function remove(id: string) { setOrders(prev => prev.filter(o => o.id !== id)) }

  const shown = filterStatus === 'All' ? orders : orders.filter(o => o.status === filterStatus)

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Description */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
        Submit work requests for kitchen appliances, cooling systems, or general dining area repairs. Generate printable maintenance tickets.
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['All', 'Active', 'In Progress', 'Completed', 'Cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              background: filterStatus === s ? 'var(--color-primary)' : 'var(--bg-app)',
              color: filterStatus === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterStatus === s ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)', padding: '6px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Create Work Order</button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {[
            ['Equipment / Item', 'equipment', 'text', 'e.g. Walk-in Cooler'],
            ['Location',         'location',  'text', 'e.g. Main Kitchen'],
            ['Submitted By',     'submittedBy','text', 'Your name'],
            ['Date',             'date',       'date', ''],
          ].map(([label,key,type,ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} style={inp} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Priority</label>
            <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
              {(['Low','Medium','High','Emergency'] as Priority[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description of Issue</label>
            <textarea rows={3} placeholder="Describe the issue in detail..." style={{ ...inp, resize: 'vertical' as const }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={add} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Submit Order</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Active Maintenance Requests table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>Active Maintenance Requests</div>

        {shown.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
            No active maintenance orders found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 110px 1fr 90px 130px 110px 40px', gap: 0, background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
              {['DATE', 'REF ID', 'EQUIPMENT / LOCATION', 'PRIORITY', 'SUBMITTED BY', 'STATUS', ''].map((h, i) => (
                <div key={i} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {shown.map(o => {
              const pc = PRIORITY_COLORS[o.priority]
              const sc = STATUS_COLORS[o.status]
              return (
                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '100px 110px 1fr 90px 130px 110px 40px', gap: 0, borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{o.date}</div>
                  <div style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif' }}>{o.refId}</div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.equipment}</div>
                    {o.location && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.location}</div>}
                    {o.description && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{o.description}</div>}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, borderRadius: 10, padding: '2px 8px' }}>{o.priority}</span>
                  </div>
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{o.submittedBy}</div>
                  <div style={{ padding: '12px 14px' }}>
                    <select value={o.status} onChange={e => updateStatus(o.id, e.target.value as OrderStatus)} style={{ border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, borderRadius: 'var(--radius-md)', fontSize: 11, padding: '3px 6px', cursor: 'pointer', fontWeight: 600 }}>
                      <option value="Active">Active</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div style={{ padding: '12px 8px' }}>
                    <button onClick={() => remove(o.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
