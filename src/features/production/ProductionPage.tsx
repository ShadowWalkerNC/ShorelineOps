import { useEffect, useState } from 'react'
import { useMenuStore } from '../../state/menuStore'
import { useResidentsStore } from '../../state/residentsStore'

// ── Types ───────────────────────────────────────────────────────────────────────────
type MealSlot   = 'breakfast' | 'lunch' | 'dinner'
type ServiceTab = 'worksheet' | 'traytickets' | 'preplist' | 'ensure' | 'shiftchecklists' | 'inventory'

const SERVICE_TABS: { id: ServiceTab; label: string; icon: string }[] = [
  { id: 'worksheet',       label: 'Worksheet',      icon: '📋' },
  { id: 'traytickets',     label: 'Tray Tickets',   icon: '🍽️' },
  { id: 'preplist',        label: 'Prep List',      icon: '👨‍🍳' },
  { id: 'ensure',          label: 'Ensure',         icon: '🥛' },
  { id: 'shiftchecklists', label: 'Shift Checks',   icon: '✅' },
  { id: 'inventory',       label: 'Inventory',      icon: '📦' },
]

const MEAL_SLOTS:  MealSlot[]                   = ['breakfast', 'lunch', 'dinner']
const MEAL_LABELS: Record<MealSlot, string>     = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

// ── Tally helper ────────────────────────────────────────────────────────────────────
type DietTally = {
  diabetic: number; cutUp: number; minced: number; pureed: number
  glutenFree: number; nutFree: number; dairyFree: number; ensure: number
}
function emptyTally(): DietTally {
  return { diabetic:0, cutUp:0, minced:0, pureed:0, glutenFree:0, nutFree:0, dairyFree:0, ensure:0 }
}

function TallyBadges({ t }: { t: DietTally }) {
  const items: [string, number][] = [
    ['Diabetic', t.diabetic], ['Cut-Up', t.cutUp], ['Minced', t.minced],
    ['Puréed', t.pureed], ['Gluten-Free', t.glutenFree],
    ['Nut-Free', t.nutFree], ['Dairy-Free', t.dairyFree], ['Ensure', t.ensure],
  ]
  return (
    <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:'10px 24px' }}>
      {items.map(([label, val]) => (
        <span key={label} style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>
          {label}: <b style={{ color:'var(--text-primary)' }}>{val}</b>
        </span>
      ))}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="sl-stat-card">
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color, lineHeight:1 }}>{value}</div>
    </div>
  )
}

// ── Check Row (shared by Ensure + Shift Checklists) ──────────────────────────────────
function CheckRow({ done, onChange, children }: { done: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onChange} style={{
      background: done ? 'var(--color-success-light, #f0fdf4)' : 'var(--bg-card)',
      border: `1px solid ${done ? '#86efac' : 'var(--border-color)'}`,
      borderRadius:'var(--radius-md)', padding:'12px 16px',
      display:'flex', alignItems:'center', gap:'var(--space-3)', cursor:'pointer',
      transition:'all 0.15s',
    }}>
      <div style={{
        width:20, height:20, borderRadius:'50%', flexShrink:0,
        border:`2px solid ${done ? '#22c55e' : 'var(--border-color)'}`,
        background: done ? '#22c55e' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'white', fontSize:12, fontWeight:700,
      }}>{done ? '✓' : ''}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

// ── Production Worksheet ───────────────────────────────────────────────────────────
function WorksheetTab() {
  const { residents } = useResidentsStore()
  const { weeks }     = useMenuStore()
  const activeWeek    = weeks.find(w => w.active) ?? weeks[0] ?? null

  const tally = emptyTally()
  residents.forEach(r => {
    if (r.dietType === 'Diabetic')                                tally.diabetic++
    if (r.texture === 'Cut-Up')                                   tally.cutUp++
    if (r.texture === 'Minced' || r.texture === 'Minced & Moist') tally.minced++
    if (r.texture === 'Pureed')                                   tally.pureed++
    if (r.allergies.includes('Gluten'))                           tally.glutenFree++
    if (r.allergies.includes('Nuts'))                             tally.nutFree++
    if (r.allergies.includes('Dairy'))                            tally.dairyFree++
    if (r.ensurePerDay > 0)                                       tally.ensure++
  })

  const active      = residents.filter(r => r.status === 'Active')
  const total       = active.length
  const diningRoom  = active.filter(r => r.servingLocation === 'Dining Room').length
  const roomService = active.filter(r => r.servingLocation === 'Room').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>
      {/* Census stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'var(--space-3)' }}>
        <StatCard label="Total Census" value={total}        color="var(--color-primary)" />
        <StatCard label="Dining Room"  value={diningRoom}  color="#059669" />
        <StatCard label="Room Service" value={roomService} color="#d97706" />
        <StatCard label="Ensure"       value={tally.ensure} color="#7c3aed" />
      </div>

      {/* Per-meal sections */}
      {MEAL_SLOTS.map(slot => (
        <div key={slot} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-5)', boxShadow:'var(--shadow-sm)' }}>
          <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>
            {MEAL_LABELS[slot]} Service
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-3)', marginBottom:'var(--space-4)' }}>
            {(['Option A', 'Option B'] as const).map((opt, oi) => (
              <div key={opt} style={{ background:'var(--bg-app)', borderRadius:'var(--radius-md)', padding:'10px 14px', border:'1px solid var(--border-color)' }}>
                <div style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-muted)', marginBottom:2 }}>
                  {opt} <span style={{ fontWeight:400 }}>(Planned: {oi === 0 ? total : 0} portions)</span>
                </div>
                <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>
                  {activeWeek
                    ? (slot === 'breakfast' ? 'Omelet / Toast' : slot === 'lunch' ? 'Soup / Sandwich' : 'Entrée / Side')
                    : '— / — / —'}
                </div>
              </div>
            ))}
          </div>
          <TallyBadges t={tally} />
        </div>
      ))}

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => window.print()} className="btn btn-primary">
          🖸 Print Worksheet
        </button>
      </div>
    </div>
  )
}

// ── Tray Tickets ─────────────────────────────────────────────────────────────────────
function TrayTicketsTab() {
  const { residents } = useResidentsStore()
  const roomResidents = residents.filter(r => r.servingLocation === 'Room' && r.status === 'Active')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'var(--space-3)' }}>
        <p style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>
          Room-service tray tickets for <b>{roomResidents.length}</b> residents.
        </p>
        <button onClick={() => window.print()} className="btn btn-primary btn-sm">
          🖸 Print All Tray Tickets
        </button>
      </div>

      {roomResidents.length === 0 && (
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>🍽️</div>
          <div className="sl-empty-title">No room-service residents found.</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'var(--space-4)' }}>
        {roomResidents.map(r => (
          <div key={r.id} style={{ background:'var(--bg-card)', border:'2px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-3)' }}>
              <div>
                <div style={{ fontSize:'var(--text-lg)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', fontFamily:'var(--font-display)' }}>{r.name}</div>
                <div className="sl-eyebrow" style={{ marginTop:2 }}>Room {r.room} · Table {r.tableAssignment || '—'}</div>
              </div>
              <span className="sl-badge sl-badge-primary">{r.portionSize}</span>
            </div>
            <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', display:'flex', flexDirection:'column', gap:'var(--space-1)' }}>
              <span>Diet: <b>{r.dietType}</b></span>
              <span>Texture: <b>{r.texture}</b></span>
              {r.allergies.length > 0 && <span style={{ color:'#dc2626', fontWeight:'var(--weight-semi)' }}>⚠ Allergies: {r.allergies.join(', ')}</span>}
              {r.beverages.length > 0 && <span>Beverages: {r.beverages.join(', ')}</span>}
              {r.specialInstructions && <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>{r.specialInstructions}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Culinary Prep List ─────────────────────────────────────────────────────────────────
type PrepItem = { id: string; task: string; assignedTo: string; meal: MealSlot; done: boolean }

function CulinaryPrepTab() {
  const [items, setItems] = useState<PrepItem[]>([
    { id:'1', task:'Thaw proteins for dinner service', assignedTo:'Kitchen Staff', meal:'breakfast', done:false },
    { id:'2', task:'Prep soup base',                  assignedTo:'Cook',          meal:'lunch',     done:false },
    { id:'3', task:'Slice vegetables',                assignedTo:'Kitchen Staff', meal:'lunch',     done:false },
    { id:'4', task:'Set up dessert station',          assignedTo:'Cook',          meal:'dinner',    done:false },
  ])
  const [newTask,    setNewTask]    = useState('')
  const [newAssignee,setNewAssignee]= useState('')
  const [newMeal,    setNewMeal]    = useState<MealSlot>('breakfast')

  function toggle(id: string) { setItems(p => p.map(i => i.id === id ? { ...i, done:!i.done } : i)) }
  function remove(id: string) { setItems(p => p.filter(i => i.id !== id)) }
  function add() {
    if (!newTask.trim()) return
    setItems(p => [...p, { id:Date.now().toString(), task:newTask.trim(), assignedTo:newAssignee||'Unassigned', meal:newMeal, done:false }])
    setNewTask(''); setNewAssignee('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      {/* Add form */}
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)', alignItems:'flex-end' }}>
        <div style={{ flex:'2 1 200px' }}>
          <label>Task</label>
          <input className="sl-input" value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g. Prep salad bar" />
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label>Assigned To</label>
          <input className="sl-input" value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="Staff name" />
        </div>
        <div style={{ flex:'1 1 120px' }}>
          <label>Meal</label>
          <select className="sl-select" value={newMeal} onChange={e => setNewMeal(e.target.value as MealSlot)}>
            {MEAL_SLOTS.map(s => <option key={s} value={s}>{MEAL_LABELS[s]}</option>)}
          </select>
        </div>
        <button onClick={add} className="btn btn-primary" style={{ flexShrink:0, alignSelf:'flex-end' }}>+ Add</button>
      </div>

      {/* Per-meal groups */}
      {MEAL_SLOTS.map(slot => {
        const slotItems = items.filter(i => i.meal === slot)
        if (!slotItems.length) return null
        return (
          <div key={slot}>
            <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-2)' }}>{MEAL_LABELS[slot]}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
              {slotItems.map(item => (
                <div key={item.id} style={{
                  background:'var(--bg-card)', border:'1px solid var(--border-color)',
                  borderRadius:'var(--radius-md)', padding:'10px 14px',
                  display:'flex', alignItems:'center', gap:'var(--space-3)',
                  opacity: item.done ? 0.5 : 1,
                }}>
                  <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                    style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--color-primary)' }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-medium)', color:'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.task}</span>
                    <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', marginLeft:'var(--space-2)' }}>— {item.assignedTo}</span>
                  </div>
                  <button onClick={() => remove(item.id)} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:16, padding:'0 4px' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Ensure Checklist ───────────────────────────────────────────────────────────────────
function EnsureTab() {
  const { residents }   = useResidentsStore()
  const ensureResidents = residents.filter(r => r.ensurePerDay > 0 && r.status === 'Active')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'var(--space-3)' }}>
        <p style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>
          <b>{checked.size}</b> of <b>{ensureResidents.length}</b> Ensure supplements delivered today.
        </p>
        <button onClick={() => setChecked(new Set(ensureResidents.map(r => r.id)))} className="btn btn-primary btn-sm">
          Mark All Delivered
        </button>
      </div>

      {ensureResidents.length === 0 && (
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>✅</div>
          <div className="sl-empty-title">No residents currently on Ensure supplements.</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {ensureResidents.map(r => (
          <CheckRow key={r.id} done={checked.has(r.id)} onChange={() => toggle(r.id)}>
            <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{r.name}</div>
            <div className="sl-eyebrow" style={{ marginTop:2 }}>Room {r.room} · {r.ensurePerDay} can{r.ensurePerDay !== 1 ? 's' : ''} / day</div>
            {checked.has(r.id) && <span style={{ fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', color:'#16a34a' }}>Delivered</span>}
          </CheckRow>
        ))}
      </div>
    </div>
  )
}

// ── Shift Checklists ─────────────────────────────────────────────────────────────────
type ShiftType = 'morning' | 'midday' | 'evening'
const SHIFT_TASKS: Record<ShiftType, string[]> = {
  morning: [
    'Set up breakfast service line',
    'Check fridge & freezer temps (log)',
    'Prep juice, coffee, and milk station',
    'Pull & thaw next-day proteins',
    'Stock condiment carts',
  ],
  midday: [
    'Clear breakfast, reset dining room',
    'Set up lunch service line',
    'Deliver room-service trays',
    'Check Ensure fridge stock',
    'Restock paper goods',
  ],
  evening: [
    'Set up dinner service line',
    'Label and date all stored items',
    'Sanitize prep surfaces & equipment',
    'Complete temperature logs',
    'Secure walk-in cooler & freezer',
  ],
}

function ShiftChecklistsTab() {
  const [shift,   setShift]   = useState<ShiftType>('morning')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(task: string) {
    setChecked(p => { const s = new Set(p); s.has(task) ? s.delete(task) : s.add(task); return s })
  }

  const tasks = SHIFT_TASKS[shift]
  const done  = tasks.filter(t => checked.has(`${shift}:${t}`)).length
  const pct   = Math.round((done / tasks.length) * 100)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      {/* Shift selector — global sl-pills */}
      <div className="sl-pills">
        {(['morning', 'midday', 'evening'] as ShiftType[]).map(s => (
          <button key={s} onClick={() => setShift(s)}
            className={shift === s ? 'sl-pill active' : 'sl-pill'}
            style={{ textTransform:'capitalize' }}
          >{s} Shift</button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
        <div style={{ flex:1, height:8, background:'var(--bg-app)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-color)' }}>
          <div style={{ height:'100%', width:`${pct}%`, background: done === tasks.length ? '#22c55e' : 'var(--color-primary)', borderRadius:4, transition:'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{done}/{tasks.length} done</span>
      </div>

      {/* Task list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {tasks.map(task => {
          const key   = `${shift}:${task}`
          const isDone = checked.has(key)
          return (
            <CheckRow key={key} done={isDone} onChange={() => toggle(key)}>
              <span style={{ fontSize:'var(--text-base)', color:'var(--text-primary)', fontWeight:'var(--weight-medium)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>
                {task}
              </span>
            </CheckRow>
          )
        })}
      </div>
    </div>
  )
}

// ── Dietary Inventory ──────────────────────────────────────────────────────────────────
type InventoryItem = { id: string; item: string; qty: number; unit: string; min: number }

function InventoryTab() {
  const [items, setItems] = useState<InventoryItem[]>([
    { id:'1', item:'Ensure Original (vanilla)', qty:24, unit:'cans',    min:12 },
    { id:'2', item:'Ensure Plus (chocolate)',   qty: 6, unit:'cans',    min:12 },
    { id:'3', item:'Thickener (Simply Thick)',  qty: 2, unit:'bottles', min: 3 },
    { id:'4', item:'Gluten-Free bread',         qty: 1, unit:'loaves',  min: 2 },
    { id:'5', item:'Lactose-Free milk',         qty:12, unit:'cartons', min: 6 },
    { id:'6', item:'Sugar-Free syrup',          qty: 3, unit:'bottles', min: 2 },
  ])
  const [editing, setEditing] = useState<string | null>(null)
  const [tempQty, setTempQty] = useState(0)

  function saveEdit(id: string) {
    setItems(p => p.map(i => i.id === id ? { ...i, qty:tempQty } : i))
    setEditing(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
      <p style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>Items highlighted in amber are below minimum par levels.</p>
      {items.map(item => {
        const low = item.qty < item.min
        return (
          <div key={item.id} style={{
            background: low ? '#fffbeb' : 'var(--bg-card)',
            border: `1px solid ${low ? '#fbbf24' : 'var(--border-color)'}`,
            borderRadius:'var(--radius-md)', padding:'12px 16px',
            display:'flex', alignItems:'center', gap:'var(--space-3)', flexWrap:'wrap',
          }}>
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{item.item}</div>
              <div className="sl-eyebrow" style={{ marginTop:2 }}>Min Par: {item.min} {item.unit}</div>
            </div>

            {editing === item.id ? (
              <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center' }}>
                <input type="number" value={tempQty} onChange={e => setTempQty(+e.target.value)}
                  className="sl-input" style={{ width:70 }} />
                <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>{item.unit}</span>
                <button onClick={() => saveEdit(item.id)} className="btn btn-primary btn-sm">Save</button>
                <button onClick={() => setEditing(null)}  className="btn btn-outline btn-sm">Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:'var(--space-3)', alignItems:'center' }}>
                <span style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-black)', color: low ? '#d97706' : 'var(--text-primary)', fontFamily:'var(--font-display)' }}>{item.qty}</span>
                <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>{item.unit}</span>
                {low && <span className="sl-badge" style={{ background:'#fef3c7', color:'#d97706', border:'1px solid #fbbf24' }}>LOW</span>}
                <button onClick={() => { setEditing(item.id); setTempQty(item.qty) }} className="btn btn-outline btn-sm">Edit</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────────────
export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>('worksheet')
  const { fetch: fetchResidents } = useResidentsStore()
  const { fetchWeeks }            = useMenuStore()

  useEffect(() => { fetchResidents(); fetchWeeks() }, []) // eslint-disable-line

  const activeTabMeta = SERVICE_TABS.find(t => t.id === activeTab)!

  return (
    <div className="sl-page fade-in">

      {/* PAGE HEADER */}
      <div className="sl-page-header">
        <h1 className="sl-page-title">Production &amp; Service</h1>
        <p className="sl-page-subtitle">Worksheets, tray tickets, prep lists, checklists, and dietary inventory.</p>
      </div>

      {/* TAB STRIP — icon + short label pills, horizontal scroll on mobile */}
      <div className="sl-pills" style={{ marginBottom:'var(--space-6)' }}>
        {SERVICE_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={activeTab === t.id ? 'sl-pill active' : 'sl-pill'}
          >
            <span style={{ marginRight:'var(--space-1)' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* CONTENT CARD */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-6)', boxShadow:'var(--shadow-sm)' }}>
        {/* Active tab heading */}
        <h2 className="sl-section-title" style={{ marginBottom:'var(--space-5)' }}>
          {activeTabMeta.icon} {activeTabMeta.label === 'Worksheet' ? 'Production Worksheet & Census Tallies'
            : activeTabMeta.label === 'Tray Tickets' ? 'Tray Tickets & Diet Spreadsheets'
            : activeTabMeta.label === 'Prep List'    ? 'Culinary Prep List'
            : activeTabMeta.label === 'Ensure'       ? 'Ensure Supplement Checklist'
            : activeTabMeta.label === 'Shift Checks' ? 'Shift Checklists'
            : 'Dietary Inventory'}
        </h2>

        {activeTab === 'worksheet'       && <WorksheetTab />}
        {activeTab === 'traytickets'     && <TrayTicketsTab />}
        {activeTab === 'preplist'        && <CulinaryPrepTab />}
        {activeTab === 'ensure'          && <EnsureTab />}
        {activeTab === 'shiftchecklists' && <ShiftChecklistsTab />}
        {activeTab === 'inventory'       && <InventoryTab />}
      </div>
    </div>
  )
}
