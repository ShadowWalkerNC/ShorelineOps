import { useEffect, useState } from 'react'
import { useMenuStore } from '../../state/menuStore'
import { useResidentsStore } from '../../state/residentsStore'

// ── Types ──────────────────────────────────────────────────────────────────────
type MealSlot = 'breakfast' | 'lunch' | 'dinner'
type ServiceTab = 'worksheet' | 'traytickets' | 'preplist' | 'ensure' | 'shiftchecklists' | 'inventory'

const SERVICE_TABS: { id: ServiceTab; label: string }[] = [
  { id: 'worksheet',       label: 'Production Worksheet & Census Tallies' },
  { id: 'traytickets',     label: 'Tray Tickets & Diet Spreadsheets' },
  { id: 'preplist',        label: 'Culinary Prep List' },
  { id: 'ensure',          label: 'Ensure Checklist' },
  { id: 'shiftchecklists', label: 'Shift Checklists' },
  { id: 'inventory',       label: 'Dietary Inventory' },
]

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']
const MEAL_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

// ── Tally helper ───────────────────────────────────────────────────────────────
type DietTally = {
  diabetic: number; cutUp: number; minced: number; pureed: number
  glutenFree: number; nutFree: number; dairyFree: number; ensure: number
}

function emptyTally(): DietTally {
  return { diabetic: 0, cutUp: 0, minced: 0, pureed: 0, glutenFree: 0, nutFree: 0, dairyFree: 0, ensure: 0 }
}

function TallyBadges({ t }: { t: DietTally }) {
  const items: [string, number][] = [
    ['Diabetic', t.diabetic],
    ['Cut-Up', t.cutUp],
    ['Minced', t.minced],
    ['Puréed', t.pureed],
    ['Gluten-Free', t.glutenFree],
    ['Nut-Free', t.nutFree],
    ['Dairy-Free', t.dairyFree],
    ['Ensure', t.ensure],
  ]
  return (
    <div style={{
      background: 'var(--bg-app)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)', padding: '12px 16px',
      display: 'flex', flexWrap: 'wrap', gap: '10px 24px',
    }}>
      {items.map(([label, val]) => (
        <span key={label} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {label}: <b style={{ color: 'var(--text-primary)' }}>{val}</b>
        </span>
      ))}
    </div>
  )
}

// ── Production Worksheet ───────────────────────────────────────────────────────
function WorksheetTab() {
  const { residents } = useResidentsStore()
  const { weeks } = useMenuStore()
  const activeWeek = weeks.find(w => w.active) ?? weeks[0] ?? null

  // Build tally from actual Resident fields
  const tally = emptyTally()
  residents.forEach(r => {
    if (r.dietType === 'Diabetic')                           tally.diabetic++
    if (r.texture === 'Cut-Up')                             tally.cutUp++
    if (r.texture === 'Minced' || r.texture === 'Minced & Moist') tally.minced++
    if (r.texture === 'Pureed')                             tally.pureed++
    if (r.allergies.includes('Gluten'))                     tally.glutenFree++
    if (r.allergies.includes('Nuts'))                       tally.nutFree++
    if (r.allergies.includes('Dairy'))                      tally.dairyFree++
    if (r.ensurePerDay > 0)                                 tally.ensure++
  })

  const activeResidents = residents.filter(r => r.status === 'Active')
  const total       = activeResidents.length
  const diningRoom  = activeResidents.filter(r => r.servingLocation === 'Dining Room').length
  const roomService = activeResidents.filter(r => r.servingLocation === 'Room').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Census summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 12 }}>
        {[
          { label: 'Total Census', value: total,       color: 'var(--color-primary)' },
          { label: 'Dining Room',  value: diningRoom,  color: '#059669' },
          { label: 'Room Service', value: roomService, color: '#d97706' },
          { label: 'Ensure',       value: tally.ensure,color: '#7c3aed' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Per-meal section */}
      {MEAL_SLOTS.map(slot => (
        <div key={slot} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 12 }}>
            {MEAL_LABELS[slot]} Service
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {(['Option A', 'Option B'] as const).map((opt, oi) => (
              <div key={opt} style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {opt} <span style={{ fontWeight: 400 }}>(Planned: {oi === 0 ? total : 0} portions)</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => window.print()} style={{
          background: 'var(--color-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', padding: '9px 22px',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>🖨 Print Worksheet</button>
      </div>
    </div>
  )
}

// ── Tray Tickets ───────────────────────────────────────────────────────────────
function TrayTicketsTab() {
  const { residents } = useResidentsStore()
  // Use correct field names: status 'Active', servingLocation 'Room'
  const roomResidents = residents.filter(r => r.servingLocation === 'Room' && r.status === 'Active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Room-service tray tickets for <b>{roomResidents.length}</b> residents.
        </p>
        <button onClick={() => window.print()} style={{
          background: 'var(--color-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', padding: '8px 18px',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>🖨 Print All Tray Tickets</button>
      </div>

      {roomResidents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
          <p style={{ fontSize: 14 }}>No room-service residents found.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
        {roomResidents.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg-card)', border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{r.name}</div>
                {/* tableAssignment replaces tableNumber; portionSize replaces portion */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {r.room} · Table {r.tableAssignment || '—'}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 10 }}>
                {r.portionSize}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>Diet: <b>{r.dietType}</b></span>
              <span>Texture: <b>{r.texture}</b></span>
              {r.allergies.length > 0 && <span style={{ color: '#dc2626' }}>⚠ Allergies: {r.allergies.join(', ')}</span>}
              {r.beverages.length > 0 && <span>Beverages: {r.beverages.join(', ')}</span>}
              {r.specialInstructions && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.specialInstructions}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Culinary Prep List ─────────────────────────────────────────────────────────
type PrepItem = { id: string; task: string; assignedTo: string; meal: MealSlot; done: boolean }

function CulinaryPrepTab() {
  const [items, setItems] = useState<PrepItem[]>([
    { id: '1', task: 'Thaw proteins for dinner service', assignedTo: 'Kitchen Staff', meal: 'breakfast', done: false },
    { id: '2', task: 'Prep soup base',                  assignedTo: 'Cook',          meal: 'lunch',     done: false },
    { id: '3', task: 'Slice vegetables',                assignedTo: 'Kitchen Staff', meal: 'lunch',     done: false },
    { id: '4', task: 'Set up dessert station',          assignedTo: 'Cook',          meal: 'dinner',    done: false },
  ])
  const [newTask, setNewTask]       = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newMeal, setNewMeal]       = useState<MealSlot>('breakfast')

  function toggle(id: string) { setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i)) }
  function remove(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }
  function add() {
    if (!newTask.trim()) return
    setItems(prev => [...prev, { id: Date.now().toString(), task: newTask.trim(), assignedTo: newAssignee || 'Unassigned', meal: newMeal, done: false }])
    setNewTask(''); setNewAssignee('')
  }

  const inp = { padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 200px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Task</label>
          <input style={inp} value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g. Prep salad bar" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Assigned To</label>
          <input style={inp} value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="Staff name" />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Meal</label>
          <select style={inp} value={newMeal} onChange={e => setNewMeal(e.target.value as MealSlot)}>
            {MEAL_SLOTS.map(s => <option key={s} value={s}>{MEAL_LABELS[s]}</option>)}
          </select>
        </div>
        <button onClick={add} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end' }}>+ Add</button>
      </div>

      {MEAL_SLOTS.map(slot => {
        const slotItems = items.filter(i => i.meal === slot)
        if (!slotItems.length) return null
        return (
          <div key={slot}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 8 }}>{MEAL_LABELS[slot]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {slotItems.map(item => (
                <div key={item.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, opacity: item.done ? 0.5 : 1,
                }}>
                  <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.task}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>— {item.assignedTo}</span>
                  </div>
                  <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Ensure Checklist ───────────────────────────────────────────────────────────
function EnsureTab() {
  const { residents } = useResidentsStore()
  // ensurePerDay > 0 replaces supplement === 'Ensure'
  const ensureResidents = residents.filter(r => r.ensurePerDay > 0 && r.status === 'Active')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <b>{checked.size}</b> of <b>{ensureResidents.length}</b> Ensure supplements delivered today.
        </p>
        <button onClick={() => setChecked(new Set(ensureResidents.map(r => r.id)))} style={{
          background: 'var(--color-primary)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-md)', padding: '7px 16px',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>Mark All Delivered</button>
      </div>

      {ensureResidents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <p style={{ fontSize: 14 }}>No residents currently on Ensure supplements.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ensureResidents.map(r => (
          <div key={r.id} onClick={() => toggle(r.id)} style={{
            background: checked.has(r.id) ? '#f0fdf4' : 'var(--bg-card)',
            border: `1px solid ${checked.has(r.id) ? '#86efac' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${checked.has(r.id) ? '#22c55e' : 'var(--border-color)'}`,
              background: checked.has(r.id) ? '#22c55e' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 12, fontWeight: 700,
            }}>{checked.has(r.id) ? '✓' : ''}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
              {/* ensurePerDay replaces ensureCans */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Room {r.room} · {r.ensurePerDay} can{r.ensurePerDay !== 1 ? 's' : ''} / day</div>
            </div>
            {checked.has(r.id) && <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Delivered</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shift Checklists ───────────────────────────────────────────────────────────
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
  const [shift, setShift] = useState<ShiftType>('morning')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(task: string) {
    setChecked(prev => { const s = new Set(prev); s.has(task) ? s.delete(task) : s.add(task); return s })
  }

  const tasks = SHIFT_TASKS[shift]
  const done  = tasks.filter(t => checked.has(`${shift}:${t}`)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['morning', 'midday', 'evening'] as ShiftType[]).map(s => (
          <button key={s} onClick={() => setShift(s)} style={{
            background: shift === s ? 'var(--color-primary)' : 'var(--bg-card)',
            color: shift === s ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${shift === s ? 'var(--color-primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)', padding: '8px 18px',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize',
          }}>{s} Shift</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, height: 8, background: 'var(--bg-app)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ height: '100%', width: `${(done / tasks.length) * 100}%`, background: done === tasks.length ? '#22c55e' : 'var(--color-primary)', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{done}/{tasks.length} done</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map(task => {
          const key   = `${shift}:${task}`
          const isDone = checked.has(key)
          return (
            <div key={key} onClick={() => toggle(key)} style={{
              background: isDone ? '#f0fdf4' : 'var(--bg-card)',
              border: `1px solid ${isDone ? '#86efac' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${isDone ? '#22c55e' : 'var(--border-color)'}`,
                background: isDone ? '#22c55e' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700,
              }}>{isDone ? '✓' : ''}</div>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>{task}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Dietary Inventory ──────────────────────────────────────────────────────────
type InventoryItem = { id: string; item: string; qty: number; unit: string; min: number }

function InventoryTab() {
  const [items, setItems] = useState<InventoryItem[]>([
    { id: '1', item: 'Ensure Original (vanilla)', qty: 24, unit: 'cans',    min: 12 },
    { id: '2', item: 'Ensure Plus (chocolate)',   qty:  6, unit: 'cans',    min: 12 },
    { id: '3', item: 'Thickener (Simply Thick)',  qty:  2, unit: 'bottles', min:  3 },
    { id: '4', item: 'Gluten-Free bread',         qty:  1, unit: 'loaves',  min:  2 },
    { id: '5', item: 'Lactose-Free milk',         qty: 12, unit: 'cartons', min:  6 },
    { id: '6', item: 'Sugar-Free syrup',          qty:  3, unit: 'bottles', min:  2 },
  ])
  const [editing, setEditing]   = useState<string | null>(null)
  const [tempQty, setTempQty]   = useState(0)

  function saveEdit(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty: tempQty } : i))
    setEditing(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Items highlighted in amber are below minimum par levels.</p>
      {items.map(item => {
        const low = item.qty < item.min
        return (
          <div key={item.id} style={{
            background: low ? '#fffbeb' : 'var(--bg-card)',
            border: `1px solid ${low ? '#fbbf24' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.item}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Min Par: {item.min} {item.unit}</div>
            </div>
            {editing === item.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" value={tempQty} onChange={e => setTempQty(+e.target.value)}
                  style={{ width: 70, padding: '5px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.unit}</span>
                <button onClick={() => saveEdit(item.id)} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: low ? '#d97706' : 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{item.qty}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.unit}</span>
                {low && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '2px 8px' }}>LOW</span>}
                <button onClick={() => { setEditing(item.id); setTempQty(item.qty) }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>Edit</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>('worksheet')
  // store.fetch replaces the old fetchResidents that doesn't exist
  const { fetch: fetchResidents } = useResidentsStore()
  const { fetchWeeks } = useMenuStore()

  useEffect(() => { fetchResidents(); fetchWeeks() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px', marginBottom: 4 }}>Production &amp; Service</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Production worksheets, tray tickets, prep lists, checklists, and dietary inventory.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {SERVICE_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? 'var(--color-primary)' : 'var(--bg-card)',
            color: activeTab === t.id ? 'white' : 'var(--text-primary)',
            border: `1px solid ${activeTab === t.id ? 'var(--color-primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-lg)', padding: '9px 18px',
            fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)',
      }}>
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
