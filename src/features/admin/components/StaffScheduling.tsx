import { useState } from 'react'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const SHIFTS = ['Morning (6am-2pm)','Midday (10am-6pm)','Evening (2pm-10pm)']

type Assignment = { id: string; staff: string; day: string; shift: string; hours: number }

const INIT: Assignment[] = [
  { id:'1', staff:'Maria G.',  day:'Mon', shift:'Morning (6am-2pm)',  hours:8 },
  { id:'2', staff:'James T.',  day:'Mon', shift:'Evening (2pm-10pm)', hours:8 },
  { id:'3', staff:'Linda S.',  day:'Tue', shift:'Morning (6am-2pm)',  hours:8 },
  { id:'4', staff:'Carlos R.', day:'Wed', shift:'Midday (10am-6pm)',  hours:8 },
  { id:'5', staff:'Maria G.',  day:'Thu', shift:'Morning (6am-2pm)',  hours:8 },
  { id:'6', staff:'James T.',  day:'Fri', shift:'Evening (2pm-10pm)', hours:8 },
]

export default function StaffScheduling() {
  const [assignments, setAssignments] = useState<Assignment[]>(INIT)
  const [form, setForm] = useState({ staff:'', day:'Mon', shift:SHIFTS[0], hours:8 })
  const [showForm, setShowForm] = useState(false)

  // Group by day
  const byDay: Record<string, Assignment[]> = {}
  DAYS.forEach(d => { byDay[d] = assignments.filter(a => a.day === d) })

  const totalHours = assignments.reduce((s,a) => s+a.hours, 0)
  const staffSet = [...new Set(assignments.map(a => a.staff))]

  function add() {
    if (!form.staff.trim()) return
    setAssignments(prev => [...prev, { id: Date.now().toString(), ...form, staff: form.staff.trim() }])
    setForm(f => ({ ...f, staff:'' }))
    setShowForm(false)
  }

  function remove(id: string) { setAssignments(prev => prev.filter(a => a.id !== id)) }

  const inputStyle = { padding:'8px 12px', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:13, width:'100%', boxSizing:'border-box' as const }
  const label = (text: string) => <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.5px', color:'var(--text-muted)', display:'block', marginBottom:4 }}>{text}</label>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Weekly tallies */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
        <div style={{ background:'var(--color-primary-light)', border:'1px solid var(--color-primary)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--color-primary)', marginBottom:4 }}>Weekly Hours</div>
          <div style={{ fontSize:28, fontWeight:800, color:'var(--color-primary)', fontFamily:'Outfit,sans-serif' }}>{totalHours}</div>
        </div>
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginBottom:4 }}>Staff Scheduled</div>
          <div style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', fontFamily:'Outfit,sans-serif' }}>{staffSet.length}</div>
        </div>
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', marginBottom:4 }}>Shifts This Week</div>
          <div style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', fontFamily:'Outfit,sans-serif' }}>{assignments.length}</div>
        </div>
      </div>

      {/* Add shift button */}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => setShowForm(v => !v)} style={{ background:'var(--color-primary)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 20px', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Add Shift Assignment</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:16, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end' }}>
          <div style={{ flex:'2 1 160px' }}>{label('Staff Name')}<input style={inputStyle} value={form.staff} onChange={e => setForm(f=>({...f,staff:e.target.value}))} placeholder="e.g. Maria G." /></div>
          <div style={{ flex:'1 1 100px' }}>{label('Day')}<select style={inputStyle} value={form.day} onChange={e => setForm(f=>({...f,day:e.target.value}))}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div style={{ flex:'2 1 180px' }}>{label('Shift')}<select style={inputStyle} value={form.shift} onChange={e => setForm(f=>({...f,shift:e.target.value}))}>{SHIFTS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{ flex:'1 1 80px' }}>{label('Hours')}<input type="number" min={1} max={12} style={inputStyle} value={form.hours} onChange={e => setForm(f=>({...f,hours:+e.target.value}))} /></div>
          <button onClick={add} style={{ background:'var(--color-primary)', color:'white', border:'none', borderRadius:'var(--radius-md)', padding:'9px 20px', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0 }}>Save</button>
          <button onClick={() => setShowForm(false)} style={{ background:'none', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'9px 16px', fontSize:13, cursor:'pointer', color:'var(--text-secondary)', flexShrink:0 }}>Cancel</button>
        </div>
      )}

      {/* Weekly grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {DAYS.map(day => (
          <div key={day}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)', textAlign:'center', marginBottom:6 }}>{day}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, minHeight:60 }}>
              {byDay[day].length === 0 && (
                <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', padding:'8px 0' }}>—</div>
              )}
              {byDay[day].map(a => (
                <div key={a.id} style={{
                  background:'var(--color-primary-light)', border:'1px solid var(--color-primary)',
                  borderRadius:6, padding:'5px 8px', fontSize:11,
                  display:'flex', flexDirection:'column', gap:2, position:'relative',
                }}>
                  <b style={{ color:'var(--color-primary)', lineHeight:1.2 }}>{a.staff}</b>
                  <span style={{ color:'var(--text-muted)', fontSize:10 }}>{a.shift.split(' ')[0]}</span>
                  <span style={{ color:'var(--text-secondary)', fontSize:10 }}>{a.hours}h</span>
                  <button onClick={() => remove(a.id)} style={{ position:'absolute', top:2, right:4, background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
