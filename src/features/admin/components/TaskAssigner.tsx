import { useState } from 'react'

type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'
type TaskStatus = 'Pending' | 'In Progress' | 'Done'
type Task = {
  id: string; title: string; assignedTo: string
  dueDate: string; priority: Priority; status: TaskStatus; notes: string
}

const PRIORITY_COLORS: Record<Priority, { bg: string; color: string; border: string }> = {
  Low:    { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  Medium: { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  High:   { bg: '#fef3c7', color: '#d97706', border: '#fbbf24' },
  Urgent: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
}

const STATUS_COLORS: Record<TaskStatus, { bg: string; color: string; border: string }> = {
  Pending:     { bg: 'var(--bg-app)',  color: 'var(--text-muted)',    border: 'var(--border-color)' },
  'In Progress':{ bg: '#eff6ff',      color: '#2563eb',              border: '#93c5fd' },
  Done:        { bg: '#f0fdf4',       color: '#16a34a',              border: '#86efac' },
}

export default function TaskAssigner() {
  const [tasks, setTasks] = useState<Task[]>([
    { id:'1', title:'Update dietary restriction records', assignedTo:'Dietitian',     dueDate:'2026-07-05', priority:'High',   status:'Pending',     notes:'' },
    { id:'2', title:'Order Ensure for next 2 weeks',       assignedTo:'Kitchen Lead',  dueDate:'2026-07-04', priority:'Urgent', status:'In Progress', notes:'Check par levels first' },
    { id:'3', title:'Train new staff on tray tickets',     assignedTo:'Supervisor',    dueDate:'2026-07-07', priority:'Medium', status:'Pending',     notes:'' },
    { id:'4', title:'Sanitize walk-in cooler shelves',     assignedTo:'Kitchen Staff', dueDate:'2026-07-03', priority:'Low',    status:'Done',        notes:'' },
  ])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', assignedTo: '', dueDate: '', priority: 'Medium' as Priority, notes: '' })
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'All'>('All')

  function add() {
    if (!form.title.trim() || !form.assignedTo.trim()) return
    setTasks(prev => [...prev, { id: Date.now().toString(), ...form, status: 'Pending' }])
    setForm({ title: '', assignedTo: '', dueDate: '', priority: 'Medium', notes: '' })
    setShowForm(false)
  }

  function setStatus(id: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  function remove(id: string) { setTasks(prev => prev.filter(t => t.id !== id)) }

  const shown = filterStatus === 'All' ? tasks : tasks.filter(t => t.status === filterStatus)

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const, width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['Pending', 'In Progress', 'Done'] as TaskStatus[]).map(s => {
          const count = tasks.filter(t => t.status === s).length
          const sc = STATUS_COLORS[s]
          return (
            <div key={s} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 'var(--radius-md)', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: sc.color, fontFamily: 'Outfit, sans-serif' }}>{count}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: sc.color }}>{s}</span>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['All', 'Pending', 'In Progress', 'Done'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              background: filterStatus === s ? 'var(--color-primary)' : 'var(--bg-app)',
              color: filterStatus === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterStatus === s ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)', padding: '6px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Assign Task</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[['Task Title','title','text','e.g. Restock Ensure'],['Assigned To','assignedTo','text','Staff / role'],['Due Date','dueDate','date',''],['Notes','notes','text','Optional']].map(([label,key,type,ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} style={inp} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Priority</label>
            <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
              {(['Low','Medium','High','Urgent'] as Priority[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={add} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(t => {
          const pc = PRIORITY_COLORS[t.priority]
          const sc = STATUS_COLORS[t.status]
          return (
            <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '13px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assigned to: <b style={{ color: 'var(--text-secondary)' }}>{t.assignedTo}</b>{t.dueDate ? ` · Due ${t.dueDate}` : ''}</div>
                {t.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.notes}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, borderRadius: 10, padding: '2px 8px' }}>{t.priority}</span>
              <select value={t.status} onChange={e => setStatus(t.id, e.target.value as TaskStatus)} style={{ border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, borderRadius: 'var(--radius-md)', fontSize: 12, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
          )
        })}
        {shown.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>No tasks found.</p>}
      </div>
    </div>
  )
}
