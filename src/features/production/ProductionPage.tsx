import { useEffect, useMemo, useState } from 'react'
import { useMenuStore }      from '../../state/menuStore'
import { useResidentsStore } from '../../state/residentsStore'
import { useRecipesStore }   from '../../state/recipesStore'
import type { Resident }     from '@/types/resident'
import type { DayOfWeek }    from '@/types/menu'

// ── Constants ─────────────────────────────────────────────────────────────────────
type ServiceTab = 'worksheet' | 'traytickets' | 'preplist' | 'shiftchecklists'

const SERVICE_TABS: { id: ServiceTab; label: string; icon: string }[] = [
  { id: 'worksheet',       label: 'Worksheet',    icon: '📋' },
  { id: 'traytickets',     label: 'Tray Tickets', icon: '🍽️' },
  { id: 'preplist',        label: 'Prep List',    icon: '👨‍🍳' },
  { id: 'shiftchecklists', label: 'Shift Checks', icon: '✅' },
]

const DAYS: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  Sunday:'Sunday', Monday:'Monday', Tuesday:'Tuesday', Wednesday:'Wednesday',
  Thursday:'Thursday', Friday:'Friday', Saturday:'Saturday',
}
const DAY_INDEX: Record<DayOfWeek, number> = {
  Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6,
}

const BUFFER = 5

const PROTEIN_KEYWORDS = [
  'chicken','salmon','beef','pork','turkey','tilapia','cod','shrimp','steak',
  'roast','loin','chop','fillet','filet','fish','ham','sausage','meatball',
]
function isProtein(name: string) {
  return PROTEIN_KEYWORDS.some(k => name.toLowerCase().includes(k))
}

// ── Types ────────────────────────────────────────────────────────────────────────────
type ResidentOrder = {
  residentId: string
  lunchChoice:  'opt1' | 'opt2' | ''
  dinnerChoice: 'opt1' | 'opt2' | ''
}

type DietBreakdown = {
  diabetic: number; cardiac: number; renal: number; lowSodium: number; mechSoft: number
  cutUp: number; minced: number; pureed: number
  glutenFree: number; dairyFree: number; nutFree: number
  diningRoom: number; room: number; assistedLiving: number; memoryCare: number
  ensure: number; small: number; large: number
}
function emptyBreakdown(): DietBreakdown {
  return { diabetic:0,cardiac:0,renal:0,lowSodium:0,mechSoft:0,cutUp:0,minced:0,pureed:0,glutenFree:0,dairyFree:0,nutFree:0,diningRoom:0,room:0,assistedLiving:0,memoryCare:0,ensure:0,small:0,large:0 }
}
function buildBreakdown(residents: Resident[]): DietBreakdown {
  const b = emptyBreakdown()
  residents.forEach(r => {
    if (r.dietType === 'Diabetic')        b.diabetic++
    if (r.dietType === 'Cardiac')         b.cardiac++
    if (r.dietType === 'Renal')           b.renal++
    if (r.dietType === 'Low Sodium')      b.lowSodium++
    if (r.dietType === 'Mechanical Soft') b.mechSoft++
    if (r.texture  === 'Cut-Up')          b.cutUp++
    if (r.texture  === 'Minced' || r.texture === 'Minced & Moist') b.minced++
    if (r.texture  === 'Pureed')          b.pureed++
    if (r.allergies.includes('Gluten'))   b.glutenFree++
    if (r.allergies.includes('Dairy'))    b.dairyFree++
    if (r.allergies.includes('Nuts'))     b.nutFree++
    if (r.servingLocation === 'Dining Room')     b.diningRoom++
    if (r.servingLocation === 'Room')            b.room++
    if (r.servingLocation === 'Assisted Living') b.assistedLiving++
    if (r.servingLocation === 'Memory Care')     b.memoryCare++
    if (r.ensurePerDay > 0)               b.ensure++
    if (r.portionSize === 'Small')        b.small++
    if (r.portionSize === 'Large')        b.large++
  })
  return b
}

type PrepTask = {
  id: string
  task: string
  detail: string
  meal: 'prep' | 'breakfast' | 'lunch' | 'dinner'
  type: 'freezer-pull' | 'prep' | 'manual'
  dueDate: string
  done: boolean
  qty?: number
  unit?: string
}

// ── Shared helpers ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0,10)
}
function dateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="sl-stat-card">
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: color ?? 'var(--color-primary)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-1)' }}>{sub}</div>}
    </div>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: [string, number][] }) {
  const nonZero = rows.filter(([, n]) => n > 0)
  if (!nonZero.length) return null
  return (
    <div style={{ marginBottom:'var(--space-3)' }}>
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-2)', color:'var(--color-primary)' }}>{title}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 20px' }}>
        {nonZero.map(([label, val]) => (
          <span key={label} style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>
            {label}: <b style={{ color:'var(--text-primary)' }}>{val}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ORDER ROUND OVERLAY
// Full-screen card-by-card flow for entering resident meal choices
// ────────────────────────────────────────────────────────────────────────────
function OrderRoundOverlay({
  residents,
  orders,
  opt1LunchLabel,
  opt2LunchLabel,
  opt1DinnerLabel,
  opt2DinnerLabel,
  onChoice,
  onClose,
}: {
  residents: Resident[]
  orders: Record<string, ResidentOrder>
  opt1LunchLabel: string
  opt2LunchLabel: string
  opt1DinnerLabel: string
  opt2DinnerLabel: string
  onChoice: (id: string, meal: 'lunchChoice' | 'dinnerChoice', val: 'opt1' | 'opt2' | '') => void
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const resident = residents[idx] ?? null
  const total    = residents.length
  const progress = total > 0 ? ((idx) / total) * 100 : 0

  const order = resident ? (orders[resident.id] ?? { residentId: resident.id, lunchChoice: '', dinnerChoice: '' }) : null

  function pick(meal: 'lunchChoice' | 'dinnerChoice', val: 'opt1' | 'opt2') {
    if (!resident) return
    // toggle off if already selected
    const current = orders[resident.id]?.[meal] ?? ''
    onChoice(resident.id, meal, current === val ? '' : val)
  }

  function next() { if (idx < total - 1) setIdx(i => i + 1) }
  function prev() { if (idx > 0)         setIdx(i => i - 1) }
  function skip() { next() }

  // keyboard nav
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft')                        prev()
      if (e.key === 'Escape')                           onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (!resident) {
    // Done screen
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign:'center', padding:'var(--space-8) var(--space-6)' }}>
            <div style={{ fontSize:64, marginBottom:'var(--space-4)' }}>✅</div>
            <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)', marginBottom:'var(--space-2)' }}>
              Order Round Complete
            </div>
            <div style={{ fontSize:'var(--text-base)', color:'var(--text-secondary)', marginBottom:'var(--space-6)' }}>
              All {total} residents have been reviewed.
            </div>
            <button onClick={onClose} className="btn btn-primary" style={{ minWidth:160 }}>
              Back to Worksheet
            </button>
          </div>
        </div>
      </div>
    )
  }

  const lunchDone  = (order?.lunchChoice  ?? '') !== ''
  const dinnerDone = (order?.dinnerChoice ?? '') !== ''
  const bothDone   = lunchDone && dinnerDone

  return (
    <div style={overlayStyle}>
      {/* Progress bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'var(--border-color)' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:'var(--color-primary)', transition:'width 0.25s ease' }} />
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        style={{ position:'absolute', top:16, right:20, background:'none', border:'none', fontSize:28, color:'var(--text-muted)', cursor:'pointer', lineHeight:1 }}
        aria-label="Close"
      >×</button>

      {/* Counter */}
      <div style={{ position:'absolute', top:16, left:20, fontSize:'var(--text-sm)', color:'var(--text-muted)', fontWeight:'var(--weight-bold)' }}>
        {idx + 1} / {total}
      </div>

      <div style={cardStyle}>
        {/* Resident header */}
        <div style={{ padding:'var(--space-5) var(--space-6)', borderBottom:'1px solid var(--border-color)', background:'var(--bg-app)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-4)', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--text-primary)', lineHeight:1.1 }}>
                {resident.name}
              </div>
              <div className="sl-eyebrow" style={{ marginTop:'var(--space-1)' }}>
                Room {resident.room} · {resident.servingLocation}{resident.tableAssignment ? ` · Table ${resident.tableAssignment}` : ''}
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-1)' }}>
              <span className="sl-badge sl-badge-primary">{resident.dietType}</span>
              {resident.texture !== 'Regular' && <span className="sl-badge">{resident.texture}</span>}
              {resident.portionSize !== 'Regular' && <span className="sl-badge">{resident.portionSize} portion</span>}
              {resident.allergies.map(a => (
                <span key={a} style={{ fontSize:11, fontWeight:700, background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:20, padding:'2px 8px' }}>⚠ {a}</span>
              ))}
            </div>
          </div>
          {(resident.likes || resident.dislikes || resident.specialInstructions) && (
            <div style={{ marginTop:'var(--space-3)', display:'flex', flexWrap:'wrap', gap:'var(--space-3)' }}>
              {resident.likes             && <span style={{ fontSize:'var(--text-xs)', color:'#059669' }}>👍 {resident.likes}</span>}
              {resident.dislikes          && <span style={{ fontSize:'var(--text-xs)', color:'#dc2626' }}>👎 {resident.dislikes}</span>}
              {resident.specialInstructions && <span style={{ fontSize:'var(--text-xs)', color:'#7c3aed' }}>📝 {resident.specialInstructions}</span>}
            </div>
          )}
        </div>

        {/* Meal choices */}
        <div style={{ padding:'var(--space-5) var(--space-6)', display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
          {/* Lunch */}
          <MealChoiceRow
            label="Lunch"
            icon="🥗"
            opt1Label={opt1LunchLabel}
            opt2Label={opt2LunchLabel}
            choice={order?.lunchChoice ?? ''}
            onPick={val => pick('lunchChoice', val)}
          />

          {/* Dinner */}
          <MealChoiceRow
            label="Dinner"
            icon="🍽️"
            opt1Label={opt1DinnerLabel}
            opt2Label={opt2DinnerLabel}
            choice={order?.dinnerChoice ?? ''}
            onPick={val => pick('dinnerChoice', val)}
          />
        </div>

        {/* Nav */}
        <div style={{ padding:'var(--space-4) var(--space-6)', borderTop:'1px solid var(--border-color)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'var(--space-3)', background:'var(--bg-app)' }}>
          <button onClick={prev} className="btn btn-outline" disabled={idx === 0} style={{ minWidth:80 }}>← Back</button>

          <button onClick={skip} className="btn btn-ghost btn-sm" style={{ color:'var(--text-muted)' }}>
            Skip →
          </button>

          <button
            onClick={bothDone ? next : skip}
            className="btn btn-primary"
            style={{ minWidth:140 }}
          >
            {bothDone
              ? idx === total - 1 ? '✓ Finish' : 'Next →'
              : 'Skip →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MealChoiceRow({
  label, icon, opt1Label, opt2Label, choice, onPick,
}: {
  label: string; icon: string
  opt1Label: string; opt2Label: string
  choice: 'opt1' | 'opt2' | ''
  onPick: (val: 'opt1' | 'opt2') => void
}) {
  return (
    <div>
      <div style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'var(--space-2)' }}>
        {icon} {label}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-3)' }}>
        <button
          onClick={() => onPick('opt1')}
          style={{
            padding:'14px 12px',
            borderRadius:'var(--radius-lg)',
            border: choice === 'opt1' ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
            background: choice === 'opt1' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-card)',
            color: choice === 'opt1' ? 'var(--color-primary)' : 'var(--text-primary)',
            fontWeight: choice === 'opt1' ? 700 : 500,
            fontSize:'var(--text-sm)',
            cursor:'pointer',
            textAlign:'center',
            lineHeight:1.4,
            transition:'all 0.15s',
          }}
        >
          <div style={{ fontSize:'var(--text-xs)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4, opacity:0.7 }}>Option 1</div>
          {opt1Label}
        </button>

        <button
          onClick={() => onPick('opt2')}
          style={{
            padding:'14px 12px',
            borderRadius:'var(--radius-lg)',
            border: choice === 'opt2' ? '2px solid var(--color-primary)' : '2px solid var(--border-color)',
            background: choice === 'opt2' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-card)',
            color: choice === 'opt2' ? 'var(--color-primary)' : 'var(--text-primary)',
            fontWeight: choice === 'opt2' ? 700 : 500,
            fontSize:'var(--text-sm)',
            cursor:'pointer',
            textAlign:'center',
            lineHeight:1.4,
            transition:'all 0.15s',
          }}
        >
          <div style={{ fontSize:'var(--text-xs)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4, opacity:0.7 }}>Option 2</div>
          {opt2Label}
        </button>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}
const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-xl)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
  overflowY: 'auto',
}

// ────────────────────────────────────────────────────────────────────────────
// WORKSHEET TAB
// ────────────────────────────────────────────────────────────────────────────
function WorksheetTab() {
  const { residents }    = useResidentsStore()
  const { weeks, items } = useMenuStore()
  const { recipes }      = useRecipesStore()

  const today    = new Date().getDay()
  const tmrIndex = (today + 1) % 7
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DAYS[tmrIndex])
  const [orderRoundOpen, setOrderRoundOpen] = useState(false)

  const activeWeek      = weeks.find(w => w.active) ?? weeks[0] ?? null
  const dayMenu         = activeWeek?.days?.[selectedDay]
  const itemName        = (id: string) => items.find(i => i.id === id)?.name ?? id
  const activeResidents = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const total           = activeResidents.length

  const [orders, setOrders] = useState<Record<string, ResidentOrder>>(() => {
    const init: Record<string, ResidentOrder> = {}
    residents.filter(r => r.status === 'Active').forEach(r => {
      init[r.id] = { residentId: r.id, lunchChoice: '', dinnerChoice: '' }
    })
    return init
  })

  useEffect(() => {
    setOrders(prev => {
      const next = { ...prev }
      activeResidents.forEach(r => {
        if (!next[r.id]) next[r.id] = { residentId: r.id, lunchChoice: '', dinnerChoice: '' }
      })
      return next
    })
  }, [activeResidents])

  function setChoice(resId: string, meal: 'lunchChoice' | 'dinnerChoice', val: 'opt1' | 'opt2' | '') {
    setOrders(prev => ({ ...prev, [resId]: { ...prev[resId], [meal]: val } }))
  }

  const tallyOrders = (meal: 'lunchChoice' | 'dinnerChoice') => {
    const opt1: Resident[] = [], opt2: Resident[] = [], none: Resident[] = []
    activeResidents.forEach(r => {
      const c = orders[r.id]?.[meal] ?? ''
      if (c === 'opt1') opt1.push(r)
      else if (c === 'opt2') opt2.push(r)
      else none.push(r)
    })
    return { opt1, opt2, none }
  }

  const breakdownAll   = useMemo(() => buildBreakdown(activeResidents), [activeResidents])
  const lunchTally     = tallyOrders('lunchChoice')
  const dinnerTally    = tallyOrders('dinnerChoice')
  const lunchNoOrders  = lunchTally.opt1.length === 0 && lunchTally.opt2.length === 0
  const dinnerNoOrders = dinnerTally.opt1.length === 0 && dinnerTally.opt2.length === 0
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)

  function optionLabel(slot: 'lunch' | 'dinner', opt: 1 | 2) {
    if (!dayMenu) return `Option ${opt}`
    const meatIds = dayMenu[`${slot}Opt${opt}Meat`   as keyof typeof dayMenu]?.itemIds ?? []
    const vegIds  = dayMenu[`${slot}Opt${opt}Veggie` as keyof typeof dayMenu]?.itemIds ?? []
    const starIds = dayMenu[`${slot}Opt${opt}Starch` as keyof typeof dayMenu]?.itemIds ?? []
    const parts   = [...meatIds.map(itemName), ...vegIds.map(itemName), ...starIds.map(itemName)]
    return parts.length ? parts.join(' / ') : `Option ${opt}`
  }
  function dessertLabel(slot: 'lunch' | 'dinner') {
    return (dayMenu?.[`${slot}Dessert` as keyof typeof dayMenu]?.itemIds ?? []).map(itemName).join(', ') || '—'
  }

  const totalOrdered = activeResidents.filter(r =>
    (orders[r.id]?.lunchChoice ?? '') !== '' || (orders[r.id]?.dinnerChoice ?? '') !== ''
  ).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>

      {/* Order Round Banner */}
      <div style={{ background:'color-mix(in srgb, var(--color-primary) 8%, transparent)', border:'1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', borderRadius:'var(--radius-lg)', padding:'var(--space-4) var(--space-5)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'var(--space-3)' }}>
        <div>
          <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-black)', color:'var(--color-primary)', fontFamily:'var(--font-display)' }}>
            📋 Order Round
          </div>
          <div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', marginTop:2 }}>
            Walk through each resident one-by-one and tap their meal choice.
            {totalOrdered > 0 && <span style={{ color:'var(--color-primary)', fontWeight:700, marginLeft:6 }}>{totalOrdered}/{total} entered</span>}
          </div>
        </div>
        <button
          onClick={() => setOrderRoundOpen(true)}
          className="btn btn-primary"
          style={{ whiteSpace:'nowrap', flexShrink:0 }}
          disabled={total === 0}
        >
          {totalOrdered > 0 ? '✏️ Continue Round' : '▶ Start Order Round'}
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div className="sl-eyebrow">Planning For</div>
        <div className="sl-pills">
          {DAYS.map(d => <button key={d} onClick={() => setSelectedDay(d)} className={selectedDay===d?'sl-pill active':'sl-pill'}>{DAY_LABELS[d]}</button>)}
        </div>
        {activeWeek
          ? <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Active menu: <b>{activeWeek.name}</b></p>
          : <div className="sl-alert sl-alert-warning">No active menu week. Set one in the Menu page.</div>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'var(--space-3)' }}>
        <StatCard label="Census"       value={total}                       color="var(--color-primary)" />
        <StatCard label="Dining Room"  value={breakdownAll.diningRoom}     color="#059669" />
        <StatCard label="Room Service" value={breakdownAll.room}           color="#d97706" />
        <StatCard label="Asst. Living" value={breakdownAll.assistedLiving} color="#7c3aed" />
        <StatCard label="Memory Care"  value={breakdownAll.memoryCare}     color="#dc2626" />
        <StatCard label="Ensure"       value={breakdownAll.ensure}         color="#0891b2" />
      </div>

      <MealSection title="Breakfast" color="#f59e0b">
        <BreakdownTable title="Diet & Texture" rows={[
          ['Diabetic',breakdownAll.diabetic],['Cardiac',breakdownAll.cardiac],
          ['Renal',breakdownAll.renal],['Low Na',breakdownAll.lowSodium],
          ['Mech Soft',breakdownAll.mechSoft],['Cut-Up',breakdownAll.cutUp],
          ['Minced',breakdownAll.minced],['Puréed',breakdownAll.pureed],
        ]} />
        <BreakdownTable title="Allergens" rows={[
          ['Gluten-Free',breakdownAll.glutenFree],['Dairy-Free',breakdownAll.dairyFree],['Nut-Free',breakdownAll.nutFree],
        ]} />
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'10px 14px' }}>
          <div className="sl-eyebrow" style={{ marginBottom:4 }}>Menu</div>
          <div style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)' }}>
            {(dayMenu?.breakfast?.itemIds ?? []).map(itemName).join(' · ') || '— No menu set —'}
          </div>
        </div>
        <PrepCount label="Prepare" count={total + BUFFER} note={`${total} residents + ${BUFFER} buffer`} />
      </MealSection>

      <MealSection title="Lunch" color="#10b981">
        {lunchNoOrders && <div className="sl-alert sl-alert-info" style={{ marginBottom:'var(--space-3)' }}>No orders entered — showing <b>50/50 split + {BUFFER} buffer</b> per option.</div>}
        <OrderEntry meal="lunchChoice" residents={activeResidents} orders={orders} opt1Label={optionLabel('lunch',1)} opt2Label={optionLabel('lunch',2)} onChange={setChoice} />
        <OptionResult slot="lunch" opt={1} label={optionLabel('lunch',1)} dessert={dessertLabel('lunch')} residents={lunchNoOrders?activeResidents.slice(0,Math.round(total/2)):lunchTally.opt1} isSplit={lunchNoOrders} total={total} recipes={recipes} expandedRecipe={expandedRecipe} setExpandedRecipe={setExpandedRecipe} />
        <OptionResult slot="lunch" opt={2} label={optionLabel('lunch',2)} dessert={dessertLabel('lunch')} residents={lunchNoOrders?activeResidents.slice(Math.round(total/2)):lunchTally.opt2} isSplit={lunchNoOrders} total={total} recipes={recipes} expandedRecipe={expandedRecipe} setExpandedRecipe={setExpandedRecipe} />
        {!lunchNoOrders && lunchTally.none.length > 0 && <div className="sl-alert sl-alert-warning"><b>{lunchTally.none.length}</b> residents missing lunch order: {lunchTally.none.map(r=>r.name).join(', ')}</div>}
      </MealSection>

      <MealSection title="Dinner" color="#6366f1">
        {dinnerNoOrders && <div className="sl-alert sl-alert-info" style={{ marginBottom:'var(--space-3)' }}>No orders entered — showing <b>50/50 split + {BUFFER} buffer</b> per option.</div>}
        <OrderEntry meal="dinnerChoice" residents={activeResidents} orders={orders} opt1Label={optionLabel('dinner',1)} opt2Label={optionLabel('dinner',2)} onChange={setChoice} />
        <OptionResult slot="dinner" opt={1} label={optionLabel('dinner',1)} dessert={dessertLabel('dinner')} residents={dinnerNoOrders?activeResidents.slice(0,Math.round(total/2)):dinnerTally.opt1} isSplit={dinnerNoOrders} total={total} recipes={recipes} expandedRecipe={expandedRecipe} setExpandedRecipe={setExpandedRecipe} />
        <OptionResult slot="dinner" opt={2} label={optionLabel('dinner',2)} dessert={dessertLabel('dinner')} residents={dinnerNoOrders?activeResidents.slice(Math.round(total/2)):dinnerTally.opt2} isSplit={dinnerNoOrders} total={total} recipes={recipes} expandedRecipe={expandedRecipe} setExpandedRecipe={setExpandedRecipe} />
        {!dinnerNoOrders && dinnerTally.none.length > 0 && <div className="sl-alert sl-alert-warning"><b>{dinnerTally.none.length}</b> residents missing dinner order: {dinnerTally.none.map(r=>r.name).join(', ')}</div>}
      </MealSection>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => window.print()} className="btn btn-primary">🖸 Print Worksheet</button>
      </div>

      {/* Order Round Overlay */}
      {orderRoundOpen && (
        <OrderRoundOverlay
          residents={activeResidents}
          orders={orders}
          opt1LunchLabel={optionLabel('lunch', 1)}
          opt2LunchLabel={optionLabel('lunch', 2)}
          opt1DinnerLabel={optionLabel('dinner', 1)}
          opt2DinnerLabel={optionLabel('dinner', 2)}
          onChoice={setChoice}
          onClose={() => setOrderRoundOpen(false)}
        />
      )}
    </div>
  )
}

function MealSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
      <button onClick={() => setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:`${color}14`, border:'none', borderBottom:`2px solid ${color}`, padding:'var(--space-3) var(--space-4)', cursor:'pointer' }}>
        <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color, textTransform:'uppercase', letterSpacing:'1px' }}>{title} Service</span>
        <span style={{ color, fontSize:18 }}>{open?'▾':'▸'}</span>
      </button>
      {open && <div style={{ background:'var(--bg-card)', padding:'var(--space-5)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>{children}</div>}
    </div>
  )
}

function PrepCount({ label, count, note }: { label: string; count: number; note?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', background:'var(--color-primary)', borderRadius:'var(--radius-md)', padding:'10px 18px', marginTop:'var(--space-2)' }}>
      <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
      <span style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'white', lineHeight:1 }}>{count}</span>
      <span style={{ fontSize:'var(--text-xs)', color:'rgba(255,255,255,0.7)' }}>portions{note?` (${note})`:''}</span>
    </div>
  )
}

const TH: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', whiteSpace:'nowrap' }
const TD: React.CSSProperties = { padding:'8px 12px', color:'var(--text-secondary)', verticalAlign:'middle' }

function OrderEntry({ meal, residents, orders, opt1Label, opt2Label, onChange }: {
  meal: 'lunchChoice' | 'dinnerChoice'
  residents: Resident[]
  orders: Record<string, ResidentOrder>
  opt1Label: string; opt2Label: string
  onChange: (id: string, meal: 'lunchChoice'|'dinnerChoice', val: 'opt1'|'opt2'|'') => void
}) {
  const [open, setOpen] = useState(false)
  const filled = residents.filter(r => (orders[r.id]?.[meal]??'') !== '').length
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <button onClick={() => setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-app)', border:'none', borderBottom:open?'1px solid var(--border-color)':'none', padding:'var(--space-3) var(--space-4)', cursor:'pointer' }}>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)' }}>
          ✏️ Enter Orders{filled>0&&<span style={{ marginLeft:8, color:'var(--color-primary)' }}>({filled}/{residents.length} entered)</span>}
        </span>
        <span style={{ color:'var(--text-muted)', fontSize:14 }}>{open?'hide ▾':'show ▸'}</span>
      </button>
      {open && (
        <div style={{ maxHeight:360, overflowY:'auto', background:'var(--bg-card)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
            <thead>
              <tr style={{ background:'var(--bg-app)', position:'sticky', top:0 }}>
                <th style={TH}>Resident</th><th style={TH}>Room</th><th style={TH}>Location</th><th style={TH}>Diet / Texture</th><th style={{ ...TH, minWidth:200 }}>Choice</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r,i) => {
                const choice = orders[r.id]?.[meal]??''
                return (
                  <tr key={r.id} style={{ background:i%2===0?'var(--bg-card)':'var(--bg-app)', borderBottom:'1px solid var(--border-color)' }}>
                    <td style={TD}>{r.name}</td>
                    <td style={TD}>{r.room}</td>
                    <td style={TD}>{r.servingLocation}</td>
                    <td style={TD}>
                      <span style={{ color:'var(--text-primary)' }}>{r.dietType}</span>
                      {r.texture!=='Regular'&&<span style={{ color:'var(--text-muted)', marginLeft:4 }}>/ {r.texture}</span>}
                      {r.allergies.length>0&&<span style={{ color:'#dc2626', marginLeft:4 }}>⚠ {r.allergies.join(',')}</span>}
                    </td>
                    <td style={TD}>
                      <div style={{ display:'flex', gap:'var(--space-2)' }}>
                        <button onClick={()=>onChange(r.id,meal,choice==='opt1'?'':'opt1')} className={choice==='opt1'?'btn btn-primary btn-sm':'btn btn-outline btn-sm'} style={{ flex:1, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Opt 1</button>
                        <button onClick={()=>onChange(r.id,meal,choice==='opt2'?'':'opt2')} className={choice==='opt2'?'btn btn-primary btn-sm':'btn btn-outline btn-sm'} style={{ flex:1, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Opt 2</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OptionResult({ slot, opt, label, dessert, residents, isSplit, total, recipes, expandedRecipe, setExpandedRecipe }: {
  slot:'lunch'|'dinner'; opt:1|2; label:string; dessert:string
  residents:Resident[]; isSplit:boolean; total:number
  recipes:import('@/types/recipe').Recipe[]
  expandedRecipe:string|null; setExpandedRecipe:(id:string|null)=>void
}) {
  const bd      = buildBreakdown(residents)
  const prepQty = (isSplit?Math.round(total/2):residents.length)+BUFFER
  const words   = label.toLowerCase().split(/[\s/,&]+/).filter(w=>w.length>3)
  const matched = recipes.find(rec=>words.some(w=>rec.name.toLowerCase().includes(w)))??null
  const ratio   = matched?(prepQty/(matched.baseServings||1)):1
  function scaleQty(raw:string):string {
    const m=raw.match(/^([\d./]+)(.*)/)
    if(!m) return raw
    // eslint-disable-next-line no-eval
    return `${+(eval(m[1])*ratio).toFixed(2)}${m[2]}`
  }
  const isExpanded = expandedRecipe===`${slot}-${opt}`
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <div style={{ background:'var(--bg-app)', padding:'var(--space-3) var(--space-4)', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'var(--space-2)' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--color-primary)', marginBottom:2 }}>Option {opt}</div>
          <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{label}</div>
          {dessert!=='—'&&<div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:2 }}>Dessert: {dessert}</div>}
          {isSplit&&<div style={{ fontSize:'var(--text-xs)', color:'#d97706', marginTop:2 }}>⚠ Estimated — no orders entered</div>}
        </div>
        <PrepCount label="Prep" count={prepQty} note={`${isSplit?Math.round(total/2):residents.length} ordered + ${BUFFER} buffer`} />
      </div>
      <div style={{ padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        <BreakdownTable title="Diet & Texture" rows={[['Diabetic',bd.diabetic],['Cardiac',bd.cardiac],['Renal',bd.renal],['Low Na',bd.lowSodium],['Mech Soft',bd.mechSoft],['Cut-Up',bd.cutUp],['Minced',bd.minced],['Puréed',bd.pureed]]} />
        <BreakdownTable title="Allergens" rows={[['Gluten-Free',bd.glutenFree],['Dairy-Free',bd.dairyFree],['Nut-Free',bd.nutFree]]} />
        <BreakdownTable title="Location" rows={[['Dining Room',bd.diningRoom],['Room Service',bd.room],['Asst. Living',bd.assistedLiving],['Memory Care',bd.memoryCare]]} />
        {matched&&(
          <div style={{ borderTop:'1px dashed var(--border-color)', paddingTop:'var(--space-3)' }}>
            <button onClick={()=>setExpandedRecipe(isExpanded?null:`${slot}-${opt}`)} className="btn btn-outline btn-sm" style={{ marginBottom:isExpanded?'var(--space-3)':0 }}>
              📖 {isExpanded?'Hide':'Show'} Recipe: <b style={{ marginLeft:4 }}>{matched.name}</b>
              <span style={{ marginLeft:8, fontSize:'var(--text-xs)', color:'var(--color-primary)' }}>scaled to {prepQty} portions</span>
            </button>
            {isExpanded&&(
              <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'var(--space-4)' }}>
                <div className="sl-eyebrow" style={{ color:'var(--color-primary)', marginBottom:'var(--space-2)' }}>Ingredients (scaled to {prepQty} servings)</div>
                <ul style={{ listStyle:'disc', paddingLeft:20, margin:'0 0 16px' }}>
                  {matched.ingredients.map((ing,i)=>(<li key={i} style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)', marginBottom:4 }}><b>{scaleQty(ing.qty)}</b> {ing.item}</li>))}
                </ul>
                {matched.notes&&<div className="sl-alert sl-alert-info" style={{ fontSize:'var(--text-sm)' }}><b>Notes:</b> {matched.notes}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// TRAY TICKETS TAB
// ────────────────────────────────────────────────────────────────────────────
type TrayTicket = {
  id:string; residentId:string; residentName:string; room:string
  meal:'Breakfast'|'Lunch'|'Dinner'
  entree:string; sides:string; dessert:string; beverages:string; notes:string
  dietType:string; texture:string; allergies:string[]
  portionSize:string; servingLocation:string; tableAssignment:string
}

function TrayTicketsTab() {
  const { residents }    = useResidentsStore()
  const { weeks, items } = useMenuStore()
  const activeWeek       = weeks.find(w=>w.active)??weeks[0]??null
  const activeResidents  = residents.filter(r=>r.status==='Active')

  const [search,   setSearch]   = useState('')
  const [tickets,  setTickets]  = useState<TrayTicket[]>([])
  const [mealPick, setMealPick] = useState<'Breakfast'|'Lunch'|'Dinner'>('Lunch')
  const [dayPick,  setDayPick]  = useState<DayOfWeek>(DAYS[(new Date().getDay()+1)%7])

  const itemName = (id:string) => items.find(i=>i.id===id)?.name??id
  const q        = search.toLowerCase().trim()
  const suggestions = q.length>=1 ? activeResidents.filter(r=>r.name.toLowerCase().includes(q)||r.room.includes(q)).slice(0,8) : []

  function buildTicket(r:Resident):TrayTicket {
    const dayMenu = activeWeek?.days?.[dayPick]
    const slot    = mealPick.toLowerCase() as 'breakfast'|'lunch'|'dinner'
    let entree='', sides='', dessert=''
    if (dayMenu) {
      if (slot==='breakfast') {
        const ids=dayMenu.breakfast?.itemIds??[]
        entree=ids.slice(0,2).map(itemName).join(', ')
        sides=ids.slice(2).map(itemName).join(', ')
      } else {
        const meat  =dayMenu[`${slot}Opt1Meat`   as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ')??''
        const veg   =dayMenu[`${slot}Opt1Veggie` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ')??''
        const starch=dayMenu[`${slot}Opt1Starch` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ')??''
        entree=meat; sides=[veg,starch].filter(Boolean).join(', ')
        dessert=dayMenu[`${slot}Dessert` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ')??''
      }
    }
    return { id:uid(), residentId:r.id, residentName:r.name, room:r.room, meal:mealPick, entree, sides, dessert, beverages:r.beverages.join(', '), notes:r.specialInstructions??'', dietType:r.dietType, texture:r.texture, allergies:r.allergies, portionSize:r.portionSize, servingLocation:r.servingLocation, tableAssignment:r.tableAssignment??'' }
  }

  function addTicket(r:Resident) {
    setSearch('')
    if(tickets.find(t=>t.residentId===r.id&&t.meal===mealPick)) return
    setTickets(prev=>[...prev,buildTicket(r)])
  }

  function generateRoomService() {
    const roomRes=activeResidents.filter(r=>r.servingLocation==='Room'||r.servingLocation==='Assisted Living'||r.servingLocation==='Memory Care')
    const newT=roomRes.filter(r=>!tickets.find(t=>t.residentId===r.id&&t.meal===mealPick)).map(buildTicket)
    setTickets(prev=>[...prev,...newT])
  }

  function removeTicket(id:string) { setTickets(prev=>prev.filter(t=>t.id!==id)) }
  function updateField(id:string,field:keyof TrayTicket,val:string) {
    setTickets(prev=>prev.map(t=>t.id===id?{...t,[field]:val}:t))
  }

  const roomServiceCount=activeResidents.filter(r=>r.servingLocation==='Room'||r.servingLocation==='Assisted Living'||r.servingLocation==='Memory Care').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'0 0 auto' }}>
            <label>Meal</label>
            <div style={{ display:'flex', gap:'var(--space-2)' }}>
              {(['Breakfast','Lunch','Dinner'] as const).map(m=>(
                <button key={m} onClick={()=>setMealPick(m)} className={mealPick===m?'btn btn-primary btn-sm':'btn btn-outline btn-sm'}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ flex:'1 1 200px' }}>
            <label>Day</label>
            <select className="sl-select" value={dayPick} onChange={e=>setDayPick(e.target.value as DayOfWeek)}>
              {DAYS.map(d=><option key={d} value={d}>{DAY_LABELS[d]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ position:'relative' }}>
          <label>Add Resident (name or room #)</label>
          <input className="sl-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type name or room…" autoComplete="off" />
          {suggestions.length>0&&(
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', zIndex:50, boxShadow:'var(--shadow-md)', overflow:'hidden' }}>
              {suggestions.map(r=>(
                <button key={r.id} onClick={()=>addTicket(r)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', borderBottom:'1px solid var(--border-color)', padding:'10px 14px', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{r.name}</span>
                  <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Rm {r.room} · {r.servingLocation} · {r.dietType}{r.allergies.length>0?' · ⚠ '+r.allergies.join(', '):''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {roomServiceCount>0&&(
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', paddingTop:'var(--space-2)', borderTop:'1px dashed var(--border-color)' }}>
            <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}><b>{roomServiceCount}</b> residents need delivery for {mealPick}.</span>
            <button onClick={generateRoomService} className="btn btn-outline btn-sm" style={{ whiteSpace:'nowrap' }}>🛌 Generate All Room Service Tickets</button>
          </div>
        )}
      </div>

      {tickets.length===0&&(
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>🍽️</div>
          <div className="sl-empty-title">No tray tickets yet.</div>
          <div className="sl-empty-subtitle">Search a resident above, or use "Generate All Room Service Tickets" to create delivery tickets in one click.</div>
        </div>
      )}

      {tickets.length>0&&(
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'var(--space-2)' }}>
          <button onClick={()=>setTickets([])} className="btn btn-outline btn-sm">Clear All</button>
          <button onClick={()=>window.print()} className="btn btn-primary btn-sm">🖸 Print Tickets</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'var(--space-4)' }}>
        {tickets.map(t=><TrayTicketCard key={t.id} ticket={t} onRemove={()=>removeTicket(t.id)} onUpdate={updateField} />)}
      </div>
    </div>
  )
}

function TrayTicketCard({ ticket:t, onRemove, onUpdate }: { ticket:TrayTicket; onRemove:()=>void; onUpdate:(id:string,field:keyof TrayTicket,val:string)=>void }) {
  const lc=t.servingLocation==='Room'?'#d97706':t.servingLocation==='Memory Care'?'#dc2626':t.servingLocation==='Assisted Living'?'#7c3aed':'#059669'
  return (
    <div style={{ background:'var(--bg-card)', border:`2px solid ${lc}44`, borderRadius:'var(--radius-lg)', padding:'var(--space-4)', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:'var(--text-lg)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', fontFamily:'var(--font-display)' }}>{t.residentName}</div>
          <div className="sl-eyebrow" style={{ marginTop:2 }}>Room {t.room}{t.tableAssignment?` · Table ${t.tableAssignment}`:''} · {t.servingLocation}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'var(--space-1)' }}>
          <span className="sl-badge sl-badge-primary">{t.meal}</span>
          <span style={{ fontSize:11, fontWeight:700, color:lc, background:`${lc}22`, border:`1px solid ${lc}55`, borderRadius:20, padding:'2px 8px' }}>{t.servingLocation}</span>
        </div>
      </div>
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'var(--space-1)' }}>
        <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>Diet: <b style={{ color:'var(--text-primary)' }}>{t.dietType}</b> · Texture: <b>{t.texture}</b> · Portion: <b>{t.portionSize}</b></span>
        {t.allergies.length>0&&<span style={{ fontSize:'var(--text-sm)', color:'#dc2626', fontWeight:'var(--weight-bold)' }}>⚠ Allergies: {t.allergies.join(', ')}</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {([['entree','Entrée'],['sides','Sides'],['dessert','Dessert'],['beverages','Beverages'],['notes','Special Instructions']] as [keyof TrayTicket,string][]).map(([field,lbl])=>(
          (field!=='dessert'||t.dessert)?(
            <div key={field as string}>
              <label style={{ fontSize:'var(--text-xs)' }}>{lbl}</label>
              <input className="sl-input" value={t[field] as string} onChange={e=>onUpdate(t.id,field,e.target.value)} />
            </div>
          ):null
        ))}
      </div>
      <button onClick={onRemove} className="btn btn-ghost btn-sm" style={{ color:'var(--color-danger)', alignSelf:'flex-end', marginTop:'auto' }}>Remove</button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// CULINARY PREP LIST — auto-generated from menu + resident census
// ────────────────────────────────────────────────────────────────────────────
function CulinaryPrepTab() {
  const { residents }    = useResidentsStore()
  const { weeks, items } = useMenuStore()

  const activeResidents = useMemo(()=>residents.filter(r=>r.status==='Active'),[residents])
  const total           = activeResidents.length
  const activeWeek      = weeks.find(w=>w.active)??weeks[0]??null

  const todayIdx = new Date().getDay()
  const [serveDay,        setServeDay]        = useState<DayOfWeek>(DAYS[(todayIdx+2)%7])
  const [freezerLeadDays, setFreezerLeadDays] = useState(2)

  const itemName = (id:string) => items.find(i=>i.id===id)?.name??id
  const dayMenu  = activeWeek?.days?.[serveDay]

  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  function serveDateISO():string {
    const servIdx=DAY_INDEX[serveDay]
    const diff=(servIdx-todayIdx+7)%7
    const d=new Date(todayDate); d.setDate(d.getDate()+diff)
    return d.toISOString().slice(0,10)
  }

  const autoTasks = useMemo(():PrepTask[] => {
    if(!dayMenu||!activeWeek) return []
    const tasks:PrepTask[]=[]
    const serveISO =serveDateISO()
    const prepISO  =addDays(serveISO,-1)
    const freezeISO=addDays(serveISO,-freezerLeadDays)
    const seen=new Set<string>()

    function addItem(name:string, meal:PrepTask['meal'], qty:number) {
      if(!name||seen.has(name)) return
      seen.add(name)
      if(isProtein(name)) {
        tasks.push({ id:uid(), type:'freezer-pull', task:`❄️ Freezer Pull — ${name}`, detail:`Pull ${qty} portions from freezer to refrigerator by ${dateLabel(freezeISO)} (${freezerLeadDays} days before service). Verify thaw by service day.`, meal:'prep', dueDate:freezeISO, done:false, qty, unit:'portions' })
      }
      tasks.push({ id:uid(), type:'prep', task:`Prep — ${name}`, detail:`Prepare ${qty} portions for ${serveDay} ${meal} service.`, meal, dueDate:prepISO, done:false, qty, unit:'portions' })
    }

    const half=Math.round(total/2)
    ;(dayMenu.breakfast?.itemIds??[]).forEach(id=>addItem(itemName(id),'breakfast',total+BUFFER))
    ;[...(dayMenu.lunchOpt1Meat?.itemIds??[]),(dayMenu.lunchOpt1Veggie?.itemIds??[]),(dayMenu.lunchOpt1Starch?.itemIds??[])].flat().forEach(id=>addItem(itemName(id),'lunch',half+BUFFER))
    ;[...(dayMenu.lunchOpt2Meat?.itemIds??[]),(dayMenu.lunchOpt2Veggie?.itemIds??[]),(dayMenu.lunchOpt2Starch?.itemIds??[])].flat().forEach(id=>addItem(itemName(id),'lunch',(total-half)+BUFFER))
    ;(dayMenu.lunchDessert?.itemIds??[]).forEach(id=>addItem(itemName(id),'lunch',total+BUFFER))
    ;[...(dayMenu.dinnerOpt1Meat?.itemIds??[]),(dayMenu.dinnerOpt1Veggie?.itemIds??[]),(dayMenu.dinnerOpt1Starch?.itemIds??[])].flat().forEach(id=>addItem(itemName(id),'dinner',half+BUFFER))
    ;[...(dayMenu.dinnerOpt2Meat?.itemIds??[]),(dayMenu.dinnerOpt2Veggie?.itemIds??[]),(dayMenu.dinnerOpt2Starch?.itemIds??[])].flat().forEach(id=>addItem(itemName(id),'dinner',(total-half)+BUFFER))
    ;(dayMenu.dinnerDessert?.itemIds??[]).forEach(id=>addItem(itemName(id),'dinner',total+BUFFER))
    return tasks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dayMenu,activeWeek,total,freezerLeadDays,serveDay,items])

  const [manualTasks,setManualTasks]=useState<PrepTask[]>([])
  const [newTask,   setNewTask]    =useState('')
  const [newDetail, setNewDetail]  =useState('')
  const [newMeal,   setNewMeal]    =useState<PrepTask['meal']>('prep')
  const [newDue,    setNewDue]     =useState(new Date().toISOString().slice(0,10))
  const [doneIds,   setDoneIds]    =useState<Set<string>>(new Set())

  function toggleDone(id:string) { setDoneIds(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s }) }
  function addManual() {
    if(!newTask.trim()) return
    setManualTasks(p=>[...p,{ id:uid(), type:'manual', task:newTask.trim(), detail:newDetail.trim(), meal:newMeal, dueDate:newDue||addDays(serveDateISO(),-1), done:false }])
    setNewTask(''); setNewDetail('')
  }
  function removeManual(id:string) { setManualTasks(p=>p.filter(t=>t.id!==id)) }

  const allTasks=useMemo(()=>[
    ...autoTasks.map(t=>({...t,done:doneIds.has(t.id)})),
    ...manualTasks.map(t=>({...t,done:doneIds.has(t.id)})),
  ],[autoTasks,manualTasks,doneIds])

  const byDate=useMemo(()=>{
    const map:Record<string,PrepTask[]>={}
    allTasks.forEach(t=>{ ;(map[t.dueDate]??=[]).push(t) })
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[allTasks])

  const totalDone=allTasks.filter(t=>t.done).length
  const serveISO =serveDateISO()

  const typeStyle:Record<PrepTask['type'],{bg:string;border:string;badge:string;badgeText:string}>={
    'freezer-pull':{bg:'#eff6ff',border:'#93c5fd',badge:'#1d4ed8',badgeText:'#fff'},
    'prep'        :{bg:'var(--bg-card)',border:'var(--border-color)',badge:'#059669',badgeText:'#fff'},
    'manual'      :{bg:'var(--bg-card)',border:'var(--border-color)',badge:'#7c3aed',badgeText:'#fff'},
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexWrap:'wrap', gap:'var(--space-4)', alignItems:'flex-end' }}>
        <div style={{ flex:'1 1 200px' }}>
          <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>Service Day (prepping for)</div>
          <div className="sl-pills" style={{ flexWrap:'wrap' }}>
            {DAYS.map(d=>(<button key={d} onClick={()=>setServeDay(d)} className={serveDay===d?'sl-pill active':'sl-pill'} style={{ fontSize:12 }}>{d.slice(0,3)}</button>))}
          </div>
          <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-1)' }}>Service date: <b>{dateLabel(serveISO)}</b></div>
        </div>
        <div style={{ flex:'0 1 160px' }}>
          <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>Freezer Pull Lead</div>
          <select className="sl-select" value={freezerLeadDays} onChange={e=>setFreezerLeadDays(+e.target.value)}>
            <option value={1}>1 day before</option>
            <option value={2}>2 days before</option>
            <option value={3}>3 days before</option>
          </select>
        </div>
        <div style={{ display:'flex', gap:'var(--space-4)' }}>
          <div className="sl-stat-card" style={{ padding:'10px 16px', minWidth:90 }}>
            <div className="sl-eyebrow">Census</div>
            <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)', lineHeight:1 }}>{total}</div>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>active residents</div>
          </div>
          <div className="sl-stat-card" style={{ padding:'10px 16px', minWidth:90 }}>
            <div className="sl-eyebrow">Tasks</div>
            <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:totalDone===allTasks.length&&allTasks.length>0?'#22c55e':'var(--color-primary)', lineHeight:1 }}>{totalDone}/{allTasks.length}</div>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>completed</div>
          </div>
        </div>
      </div>

      {!activeWeek&&<div className="sl-alert sl-alert-warning">⚠ No active menu week. Go to Menu Planner and mark a week as active.</div>}
      {activeWeek&&!dayMenu&&<div className="sl-alert sl-alert-warning">⚠ No menu set for <b>{serveDay}</b> in the active week. Add menu items to auto-generate prep tasks.</div>}
      {total===0&&<div className="sl-alert sl-alert-warning">⚠ No active residents found. Add residents to calculate portions.</div>}

      {allTasks.length>0&&(
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
          <div style={{ flex:1, height:10, background:'var(--bg-app)', borderRadius:5, overflow:'hidden', border:'1px solid var(--border-color)' }}>
            <div style={{ height:'100%', width:`${allTasks.length?(totalDone/allTasks.length)*100:0}%`, background:totalDone===allTasks.length?'#22c55e':'var(--color-primary)', borderRadius:5, transition:'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{totalDone}/{allTasks.length} done</span>
        </div>
      )}

      {byDate.map(([date,tasks])=>(
        <div key={date}>
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:'var(--space-2)' }}>
            <div style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-black)', color:'var(--color-primary)', fontFamily:'var(--font-display)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Due by: {dateLabel(date)}</div>
            <div style={{ flex:1, height:1, background:'var(--border-color)' }} />
            <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>{tasks.length} task{tasks.length!==1?'s':''}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
            {tasks.map(task=>{
              const s=typeStyle[task.type]; const isDone=task.done
              return (
                <div key={task.id} onClick={()=>toggleDone(task.id)} style={{ background:isDone?'#f0fdf4':s.bg, border:`1px solid ${isDone?'#86efac':s.border}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:'var(--space-3)', cursor:'pointer', opacity:isDone?0.6:1, transition:'all 0.15s' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, border:`2px solid ${isDone?'#22c55e':'var(--border-color)'}`, background:isDone?'#22c55e':'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:700, marginTop:1 }}>{isDone?'✓':''}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)', flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)', textDecoration:isDone?'line-through':'none' }}>{task.task}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:s.badge, color:s.badgeText, textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>
                        {task.type==='freezer-pull'?'❄️ Freezer Pull':task.type==='prep'?'👨‍🍳 Prep':'✏️ Manual'}
                      </span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bg-app)', color:'var(--text-secondary)', border:'1px solid var(--border-color)', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>
                        {task.meal==='prep'?'All Meals':task.meal}
                      </span>
                      {task.qty&&<span style={{ fontSize:'var(--text-xs)', color:'var(--color-primary)', fontWeight:'var(--weight-bold)' }}>{task.qty} {task.unit}</span>}
                    </div>
                    {task.detail&&<div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', lineHeight:1.5 }}>{task.detail}</div>}
                  </div>
                  {task.type==='manual'&&(
                    <button onClick={e=>{e.stopPropagation();removeManual(task.id)}} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:16, padding:'0 4px', flexShrink:0 }}>×</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {allTasks.length===0&&activeWeek&&dayMenu&&(
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>👨‍🍳</div>
          <div className="sl-empty-title">No prep tasks yet.</div>
          <div className="sl-empty-subtitle">Select a service day to auto-generate tasks, or add manual tasks below.</div>
        </div>
      )}

      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
        <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-3)' }}>+ Add Manual Task</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-3)', alignItems:'flex-end' }}>
          <div style={{ flex:'2 1 200px' }}><label>Task</label><input className="sl-input" value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="e.g. Prep garnishes" /></div>
          <div style={{ flex:'2 1 200px' }}><label>Detail</label><input className="sl-input" value={newDetail} onChange={e=>setNewDetail(e.target.value)} placeholder="Optional…" /></div>
          <div style={{ flex:'0 1 130px' }}><label>Meal</label>
            <select className="sl-select" value={newMeal} onChange={e=>setNewMeal(e.target.value as PrepTask['meal'])}>
              <option value="prep">All Meals</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
          <div style={{ flex:'0 1 140px' }}><label>Due Date</label><input type="date" className="sl-input" value={newDue} onChange={e=>setNewDue(e.target.value)} /></div>
          <button onClick={addManual} className="btn btn-primary" style={{ flexShrink:0, alignSelf:'flex-end' }}>+ Add</button>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={()=>window.print()} className="btn btn-outline">🖸 Print Prep List</button>
      </div>
    </div>
  )
}

// ── Shift Checklists ─────────────────────────────────────────────────────────────────
type ShiftType = 'morning' | 'midday' | 'evening'
const SHIFT_TASKS: Record<ShiftType,string[]> = {
  morning: ['Set up breakfast service line','Check fridge & freezer temps (log)','Prep juice, coffee, and milk station','Pull & thaw next-day proteins','Stock condiment carts'],
  midday:  ['Clear breakfast, reset dining room','Set up lunch service line','Deliver room-service trays','Check Ensure fridge stock','Restock paper goods'],
  evening: ['Set up dinner service line','Label and date all stored items','Sanitize prep surfaces & equipment','Complete temperature logs','Secure walk-in cooler & freezer'],
}

function CheckRow({ done, onChange, children }: { done:boolean; onChange:()=>void; children:React.ReactNode }) {
  return (
    <div onClick={onChange} style={{ background:done?'#f0fdf4':'var(--bg-card)', border:`1px solid ${done?'#86efac':'var(--border-color)'}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'center', gap:'var(--space-3)', cursor:'pointer', transition:'all 0.15s' }}>
      <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, border:`2px solid ${done?'#22c55e':'var(--border-color)'}`, background:done?'#22c55e':'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:700 }}>{done?'✓':''}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

function ShiftChecklistsTab() {
  const [shift,setShift]=useState<ShiftType>('morning')
  const [checked,setChecked]=useState<Set<string>>(new Set())
  function toggle(t:string){setChecked(p=>{const s=new Set(p);s.has(t)?s.delete(t):s.add(t);return s})}
  const tasks=SHIFT_TASKS[shift]
  const done=tasks.filter(t=>checked.has(`${shift}:${t}`)).length
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div className="sl-pills">
        {(['morning','midday','evening'] as ShiftType[]).map(s=>(
          <button key={s} onClick={()=>setShift(s)} className={shift===s?'sl-pill active':'sl-pill'} style={{ textTransform:'capitalize' }}>{s} Shift</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
        <div style={{ flex:1, height:8, background:'var(--bg-app)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-color)' }}>
          <div style={{ height:'100%', width:`${(done/tasks.length)*100}%`, background:done===tasks.length?'#22c55e':'var(--color-primary)', borderRadius:4, transition:'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{done}/{tasks.length} done</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {tasks.map(task=>{
          const key=`${shift}:${task}`,isDone=checked.has(key)
          return (
            <CheckRow key={key} done={isDone} onChange={()=>toggle(key)}>
              <span style={{ fontSize:'var(--text-base)', color:'var(--text-primary)', fontWeight:'var(--weight-medium)', textDecoration:isDone?'line-through':'none', opacity:isDone?0.6:1 }}>{task}</span>
            </CheckRow>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────────────
export default function ProductionPage() {
  const [activeTab,    setActiveTab]    = useState<ServiceTab>('worksheet')
  const { fetch: fetchResidents }       = useResidentsStore()
  const { fetchWeeks, fetchItems }      = useMenuStore()
  const { fetch: fetchRecipes }         = useRecipesStore()

  useEffect(() => { fetchResidents(); fetchWeeks(); fetchItems(); fetchRecipes() }, []) // eslint-disable-line

  return (
    <div className="sl-page fade-in">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Production &amp; Service</h1>
        <p className="sl-page-subtitle">Worksheets, tray tickets, prep lists, and shift checklists.</p>
      </div>

      {/* ── Sticky Tab Bar ── */}
      <div
        role="tablist"
        aria-label="Production sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          background: 'var(--bg-app)',
          borderBottom: '2px solid var(--border-color)',
          marginBottom: 'var(--space-6)',
          marginLeft: 'calc(var(--space-6) * -1)',
          marginRight: 'calc(var(--space-6) * -1)',
          paddingLeft: 'var(--space-6)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {SERVICE_TABS.map(t => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '14px 20px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -2,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {activeTab==='worksheet'       && <WorksheetTab />}
        {activeTab==='traytickets'     && <TrayTicketsTab />}
        {activeTab==='preplist'        && <CulinaryPrepTab />}
        {activeTab==='shiftchecklists' && <ShiftChecklistsTab />}
      </div>
    </div>
  )
}
