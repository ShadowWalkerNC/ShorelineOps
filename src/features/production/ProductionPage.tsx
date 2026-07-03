import { useEffect, useMemo, useState } from 'react'
import { useMenuStore }      from '../../state/menuStore'
import { useResidentsStore } from '../../state/residentsStore'
import { useRecipesStore }   from '../../state/recipesStore'
import type { Resident }     from '@/types/resident'
import type { DayOfWeek }    from '@/types/menu'

// ── Constants ──────────────────────────────────────────────────────────────────────────
type ServiceTab = 'worksheet' | 'traytickets' | 'preplist' | 'shiftchecklists' | 'inventory'

const SERVICE_TABS: { id: ServiceTab; label: string; icon: string }[] = [
  { id: 'worksheet',       label: 'Worksheet',    icon: '📋' },
  { id: 'traytickets',     label: 'Tray Tickets', icon: '🍽️' },
  { id: 'preplist',        label: 'Prep List',    icon: '👨‍🍳' },
  { id: 'shiftchecklists', label: 'Shift Checks', icon: '✅' },
  { id: 'inventory',       label: 'Inventory',    icon: '📦' },
]

const DAYS: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  Sunday:'Sunday', Monday:'Monday', Tuesday:'Tuesday', Wednesday:'Wednesday',
  Thursday:'Thursday', Friday:'Friday', Saturday:'Saturday',
}

const BUFFER = 5 // extra portions always added to each option

// ── Types ───────────────────────────────────────────────────────────────────────────
type MealSlotKey = 'breakfast' | 'lunch' | 'dinner'

/** What admin typed in for one resident’s meal choice */
type ResidentOrder = {
  residentId: string
  /** 'opt1' | 'opt2' | '' (not yet entered) */
  lunchChoice:  'opt1' | 'opt2' | ''
  dinnerChoice: 'opt1' | 'opt2' | ''
}

// Dietary breakdown tallied from resident records
type DietBreakdown = {
  diabetic: number; cardiac: number; renal: number; lowSodium: number; mechSoft: number
  cutUp: number; minced: number; pureed: number
  glutenFree: number; dairyFree: number; nutFree: number
  diningRoom: number; room: number; assistedLiving: number; memoryCare: number
  ensure: number; small: number; large: number
}
function emptyBreakdown(): DietBreakdown {
  return { diabetic:0, cardiac:0, renal:0, lowSodium:0, mechSoft:0, cutUp:0, minced:0, pureed:0, glutenFree:0, dairyFree:0, nutFree:0, diningRoom:0, room:0, assistedLiving:0, memoryCare:0, ensure:0, small:0, large:0 }
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

// ── Shared: stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="sl-stat-card">
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: color ?? 'var(--color-primary)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-1)' }}>{sub}</div>}
    </div>
  )
}

// ── Breakdown table ──────────────────────────────────────────────────────────────────────
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
// PRODUCTION WORKSHEET TAB
// ────────────────────────────────────────────────────────────────────────────
function WorksheetTab() {
  const { residents }        = useResidentsStore()
  const { weeks, items }     = useMenuStore()
  const { recipes }          = useRecipesStore()

  // Pick which day to plan for
  const today     = new Date().getDay() // 0=Sun
  const tmrIndex  = (today + 1) % 7
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DAYS[tmrIndex])

  // Active week
  const activeWeek = weeks.find(w => w.active) ?? weeks[0] ?? null
  const dayMenu    = activeWeek?.days?.[selectedDay]

  // Helper: resolve item IDs -> names
  const itemName = (id: string) => items.find(i => i.id === id)?.name ?? id

  // Active residents only
  const activeResidents = useMemo(() => residents.filter(r => r.status === 'Active'), [residents])
  const total           = activeResidents.length

  // Orders: residentId -> choice
  const [orders, setOrders] = useState<Record<string, ResidentOrder>>(() => {
    const init: Record<string, ResidentOrder> = {}
    residents.filter(r => r.status === 'Active').forEach(r => {
      init[r.id] = { residentId: r.id, lunchChoice: '', dinnerChoice: '' }
    })
    return init
  })

  // Sync orders when residents change
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

  // Tally helpers
  const tallyOrders = (meal: 'lunchChoice' | 'dinnerChoice') => {
    const opt1: Resident[] = []
    const opt2: Resident[] = []
    const none:  Resident[] = []
    activeResidents.forEach(r => {
      const c = orders[r.id]?.[meal] ?? ''
      if (c === 'opt1') opt1.push(r)
      else if (c === 'opt2') opt2.push(r)
      else none.push(r)
    })
    return { opt1, opt2, none }
  }

  // For breakfast there’s no choice — all residents counted
  const breakdownAll = useMemo(() => buildBreakdown(activeResidents), [activeResidents])

  // Derive option names for lunch + dinner from menu
  function optionLabel(slot: 'lunch' | 'dinner', opt: 1 | 2) {
    if (!dayMenu) return `Option ${opt}`
    const meatIds = dayMenu[`${slot}Opt${opt}Meat`  as keyof typeof dayMenu]?.itemIds ?? []
    const vegIds  = dayMenu[`${slot}Opt${opt}Veggie` as keyof typeof dayMenu]?.itemIds ?? []
    const starIds = dayMenu[`${slot}Opt${opt}Starch` as keyof typeof dayMenu]?.itemIds ?? []
    const parts = [...meatIds.map(itemName), ...vegIds.map(itemName), ...starIds.map(itemName)]
    return parts.length ? parts.join(' / ') : `Option ${opt}`
  }

  function dessertLabel(slot: 'lunch' | 'dinner') {
    const ids = dayMenu?.[`${slot}Dessert` as keyof typeof dayMenu]?.itemIds ?? []
    return ids.map(itemName).join(', ') || '—'
  }

  // 50/50 split with buffer when no orders entered
  function smartCount(residents: Resident[], total: number, isSplit: boolean) {
    // if no orders at all for this meal, use 50/50
    if (isSplit) return Math.round(total / 2) + BUFFER
    return residents.length + BUFFER
  }

  const lunchTally  = tallyOrders('lunchChoice')
  const dinnerTally = tallyOrders('dinnerChoice')
  const lunchNoOrders  = lunchTally.opt1.length === 0 && lunchTally.opt2.length === 0
  const dinnerNoOrders = dinnerTally.opt1.length === 0 && dinnerTally.opt2.length === 0

  // Recipe lookup by name fragment
  function findRecipe(optionLabel: string) {
    const words = optionLabel.toLowerCase().split(/[\s/,]+/).filter(w => w.length > 3)
    return recipes.find(rec =>
      words.some(w => rec.name.toLowerCase().includes(w))
    ) ?? null
  }

  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)

  // ── Render ──
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>

      {/* ── Day Selector ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div className="sl-eyebrow">Planning For</div>
        <div className="sl-pills">
          {DAYS.map(d => (
            <button key={d}
              onClick={() => setSelectedDay(d)}
              className={selectedDay === d ? 'sl-pill active' : 'sl-pill'}
            >{DAY_LABELS[d]}</button>
          ))}
        </div>
        {activeWeek
          ? <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Active menu: <b>{activeWeek.name}</b></p>
          : <div className="sl-alert sl-alert-warning">No active menu week found. Set a menu week as active in the Menu page.</div>
        }
      </div>

      {/* ── Census stat row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'var(--space-3)' }}>
        <StatCard label="Census"        value={total}                          color="var(--color-primary)" />
        <StatCard label="Dining Room"   value={breakdownAll.diningRoom}        color="#059669" />
        <StatCard label="Room Service"  value={breakdownAll.room}              color="#d97706" />
        <StatCard label="Asst. Living"  value={breakdownAll.assistedLiving}   color="#7c3aed" />
        <StatCard label="Memory Care"   value={breakdownAll.memoryCare}       color="#dc2626" />
        <StatCard label="Ensure"        value={breakdownAll.ensure}            color="#0891b2" />
      </div>

      {/* ── BREAKFAST ── */}
      <MealSection title="Breakfast" color="#f59e0b">
        <BreakdownTable title="Diet &amp; Texture" rows={[
          ['Diabetic', breakdownAll.diabetic],
          ['Cardiac',  breakdownAll.cardiac],
          ['Renal',    breakdownAll.renal],
          ['Low Na',   breakdownAll.lowSodium],
          ['Mech Soft',breakdownAll.mechSoft],
          ['Cut-Up',   breakdownAll.cutUp],
          ['Minced',   breakdownAll.minced],
          ['Puréed',   breakdownAll.pureed],
        ]} />
        <BreakdownTable title="Allergens" rows={[
          ['Gluten-Free', breakdownAll.glutenFree],
          ['Dairy-Free',  breakdownAll.dairyFree],
          ['Nut-Free',    breakdownAll.nutFree],
        ]} />
        <BreakdownTable title="Portions" rows={[
          ['Small', breakdownAll.small],
          ['Large', breakdownAll.large],
        ]} />
        <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'10px 14px', marginTop:'var(--space-2)' }}>
          <div className="sl-eyebrow" style={{ marginBottom:4 }}>Menu</div>
          <div style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)' }}>
            {(dayMenu?.breakfast?.itemIds ?? []).map(itemName).join(' · ') || '— No menu set —'}
          </div>
        </div>
        <PrepCount label="Prepare" count={total + BUFFER} note={`${total} residents + ${BUFFER} buffer`} />
      </MealSection>

      {/* ── LUNCH ── */}
      <MealSection title="Lunch" color="#10b981">
        {lunchNoOrders && (
          <div className="sl-alert sl-alert-info" style={{ marginBottom:'var(--space-3)' }}>
            No orders entered yet — showing <b>50/50 split + {BUFFER} buffer</b> per option.
          </div>
        )}
        <OrderEntry
          meal="lunchChoice"
          residents={activeResidents}
          orders={orders}
          opt1Label={optionLabel('lunch', 1)}
          opt2Label={optionLabel('lunch', 2)}
          onChange={setChoice}
        />
        <OptionResult
          slot="lunch" opt={1}
          label={optionLabel('lunch', 1)}
          dessert={dessertLabel('lunch')}
          residents={lunchNoOrders ? activeResidents.slice(0, Math.round(total/2)) : lunchTally.opt1}
          isSplit={lunchNoOrders}
          total={total}
          recipes={recipes}
          expandedRecipe={expandedRecipe}
          setExpandedRecipe={setExpandedRecipe}
        />
        <OptionResult
          slot="lunch" opt={2}
          label={optionLabel('lunch', 2)}
          dessert={dessertLabel('lunch')}
          residents={lunchNoOrders ? activeResidents.slice(Math.round(total/2)) : lunchTally.opt2}
          isSplit={lunchNoOrders}
          total={total}
          recipes={recipes}
          expandedRecipe={expandedRecipe}
          setExpandedRecipe={setExpandedRecipe}
        />
        {!lunchNoOrders && lunchTally.none.length > 0 && (
          <div className="sl-alert sl-alert-warning">
            <b>{lunchTally.none.length}</b> residents have no lunch order entered: 
            {lunchTally.none.map(r => r.name).join(', ')}
          </div>
        )}
      </MealSection>

      {/* ── DINNER ── */}
      <MealSection title="Dinner" color="#6366f1">
        {dinnerNoOrders && (
          <div className="sl-alert sl-alert-info" style={{ marginBottom:'var(--space-3)' }}>
            No orders entered yet — showing <b>50/50 split + {BUFFER} buffer</b> per option.
          </div>
        )}
        <OrderEntry
          meal="dinnerChoice"
          residents={activeResidents}
          orders={orders}
          opt1Label={optionLabel('dinner', 1)}
          opt2Label={optionLabel('dinner', 2)}
          onChange={setChoice}
        />
        <OptionResult
          slot="dinner" opt={1}
          label={optionLabel('dinner', 1)}
          dessert={dessertLabel('dinner')}
          residents={dinnerNoOrders ? activeResidents.slice(0, Math.round(total/2)) : dinnerTally.opt1}
          isSplit={dinnerNoOrders}
          total={total}
          recipes={recipes}
          expandedRecipe={expandedRecipe}
          setExpandedRecipe={setExpandedRecipe}
        />
        <OptionResult
          slot="dinner" opt={2}
          label={optionLabel('dinner', 2)}
          dessert={dessertLabel('dinner')}
          residents={dinnerNoOrders ? activeResidents.slice(Math.round(total/2)) : dinnerTally.opt2}
          isSplit={dinnerNoOrders}
          total={total}
          recipes={recipes}
          expandedRecipe={expandedRecipe}
          setExpandedRecipe={setExpandedRecipe}
        />
        {!dinnerNoOrders && dinnerTally.none.length > 0 && (
          <div className="sl-alert sl-alert-warning">
            <b>{dinnerTally.none.length}</b> residents have no dinner order entered: 
            {dinnerTally.none.map(r => r.name).join(', ')}
          </div>
        )}
      </MealSection>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => window.print()} className="btn btn-primary">🖸 Print Worksheet</button>
      </div>
    </div>
  )
}

// Collapsible meal section wrapper
function MealSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        background: `${color}14`, border:'none', borderBottom:`2px solid ${color}`,
        padding:'var(--space-3) var(--space-4)', cursor:'pointer',
      }}>
        <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color, textTransform:'uppercase', letterSpacing:'1px' }}>{title} Service</span>
        <span style={{ color, fontSize:18 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ background:'var(--bg-card)', padding:'var(--space-5)', display:'flex', flexDirection:'column', gap:'var(--space-4)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// Prep count callout
function PrepCount({ label, count, note }: { label: string; count: number; note?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', background:'var(--color-primary)', borderRadius:'var(--radius-md)', padding:'10px 18px', marginTop:'var(--space-2)' }}>
      <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
      <span style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'white', lineHeight:1 }}>{count}</span>
      <span style={{ fontSize:'var(--text-xs)', color:'rgba(255,255,255,0.7)' }}>portions{note ? ` (${note})` : ''}</span>
    </div>
  )
}

// Order entry table for one meal
function OrderEntry({
  meal, residents, orders, opt1Label, opt2Label, onChange,
}: {
  meal: 'lunchChoice' | 'dinnerChoice'
  residents: Resident[]
  orders: Record<string, ResidentOrder>
  opt1Label: string
  opt2Label: string
  onChange: (id: string, meal: 'lunchChoice' | 'dinnerChoice', val: 'opt1' | 'opt2' | '') => void
}) {
  const [open, setOpen] = useState(false)
  const filled = residents.filter(r => (orders[r.id]?.[meal] ?? '') !== '').length

  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'var(--bg-app)', border:'none', borderBottom: open ? '1px solid var(--border-color)' : 'none',
        padding:'var(--space-3) var(--space-4)', cursor:'pointer',
      }}>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)' }}>
          ✏️ Enter Orders
          {filled > 0 && <span style={{ marginLeft:8, color:'var(--color-primary)' }}>({filled}/{residents.length} entered)</span>}
        </span>
        <span style={{ color:'var(--text-muted)', fontSize:14 }}>{open ? 'hide ▾' : 'show ▸'}</span>
      </button>

      {open && (
        <div style={{ maxHeight:360, overflowY:'auto', background:'var(--bg-card)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'var(--text-sm)' }}>
            <thead>
              <tr style={{ background:'var(--bg-app)', position:'sticky', top:0 }}>
                <th style={TH}>Resident</th>
                <th style={TH}>Room</th>
                <th style={TH}>Location</th>
                <th style={TH}>Diet / Texture</th>
                <th style={{ ...TH, minWidth:200 }}>Choice</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r, i) => {
                const choice = orders[r.id]?.[meal] ?? ''
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)', borderBottom:'1px solid var(--border-color)' }}>
                    <td style={TD}>{r.name}</td>
                    <td style={TD}>{r.room}</td>
                    <td style={TD}>{r.servingLocation}</td>
                    <td style={TD}>
                      <span style={{ color:'var(--text-primary)' }}>{r.dietType}</span>
                      {r.texture !== 'Regular' && <span style={{ color:'var(--text-muted)', marginLeft:4 }}>/ {r.texture}</span>}
                      {r.allergies.length > 0 && <span style={{ color:'#dc2626', marginLeft:4 }}>⚠ {r.allergies.join(',')}</span>}
                    </td>
                    <td style={TD}>
                      <div style={{ display:'flex', gap:'var(--space-2)' }}>
                        <button
                          onClick={() => onChange(r.id, meal, choice === 'opt1' ? '' : 'opt1')}
                          className={choice === 'opt1' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                          title={opt1Label}
                          style={{ flex:1, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                        >Opt 1</button>
                        <button
                          onClick={() => onChange(r.id, meal, choice === 'opt2' ? '' : 'opt2')}
                          className={choice === 'opt2' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                          title={opt2Label}
                          style={{ flex:1, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                        >Opt 2</button>
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
const TH: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', whiteSpace:'nowrap' }
const TD: React.CSSProperties = { padding:'8px 12px', color:'var(--text-secondary)', verticalAlign:'middle' }

// One option’s result card with dietary breakdown + recipe link
function OptionResult({
  slot, opt, label, dessert, residents, isSplit, total, recipes, expandedRecipe, setExpandedRecipe,
}: {
  slot: 'lunch' | 'dinner'
  opt: 1 | 2
  label: string
  dessert: string
  residents: Resident[]
  isSplit: boolean
  total: number
  recipes: import('@/types/recipe').Recipe[]
  expandedRecipe: string | null
  setExpandedRecipe: (id: string | null) => void
}) {
  const bd       = buildBreakdown(residents)
  const prepQty  = (isSplit ? Math.round(total / 2) : residents.length) + BUFFER

  // Try to match a recipe by any word in the label
  const words   = label.toLowerCase().split(/[\s/,&]+/).filter(w => w.length > 3)
  const matched = recipes.find(rec => words.some(w => rec.name.toLowerCase().includes(w))) ?? null

  const ratio = matched ? (prepQty / (matched.baseServings || 1)) : 1

  function scaleQty(raw: string): string {
    const m = raw.match(/^([\d./]+)(.*)/)
    if (!m) return raw
    // eslint-disable-next-line no-eval
    const scaled = +(eval(m[1]) * ratio).toFixed(2)
    return `${scaled}${m[2]}`
  }

  const isExpanded = expandedRecipe === `${slot}-${opt}`

  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-app)', padding:'var(--space-3) var(--space-4)', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'var(--space-2)' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--color-primary)', marginBottom:2 }}>Option {opt}</div>
          <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{label}</div>
          {dessert !== '—' && <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:2 }}>Dessert: {dessert}</div>}
          {isSplit && <div style={{ fontSize:'var(--text-xs)', color:'#d97706', marginTop:2 }}>⚠ Estimated — no orders entered</div>}
        </div>
        <PrepCount label="Prep" count={prepQty} note={`${isSplit ? Math.round(total/2) : residents.length} ordered + ${BUFFER} buffer`} />
      </div>

      {/* Breakdown */}
      <div style={{ padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        <BreakdownTable title="Diet &amp; Texture" rows={[
          ['Diabetic', bd.diabetic], ['Cardiac', bd.cardiac], ['Renal', bd.renal],
          ['Low Na', bd.lowSodium], ['Mech Soft', bd.mechSoft],
          ['Cut-Up', bd.cutUp], ['Minced', bd.minced], ['Puréed', bd.pureed],
        ]} />
        <BreakdownTable title="Allergens" rows={[
          ['Gluten-Free', bd.glutenFree], ['Dairy-Free', bd.dairyFree], ['Nut-Free', bd.nutFree],
        ]} />
        <BreakdownTable title="Location" rows={[
          ['Dining Room', bd.diningRoom], ['Room Service', bd.room],
          ['Asst. Living', bd.assistedLiving], ['Memory Care', bd.memoryCare],
        ]} />

        {/* Matched recipe */}
        {matched && (
          <div style={{ borderTop:'1px dashed var(--border-color)', paddingTop:'var(--space-3)' }}>
            <button onClick={() => setExpandedRecipe(isExpanded ? null : `${slot}-${opt}`)}
              className="btn btn-outline btn-sm" style={{ marginBottom: isExpanded ? 'var(--space-3)' : 0 }}>
              📖 {isExpanded ? 'Hide' : 'Show'} Recipe: <b style={{ marginLeft:4 }}>{matched.name}</b>
              <span style={{ marginLeft:8, fontSize:'var(--text-xs)', color:'var(--color-primary)' }}>scaled to {prepQty} portions</span>
            </button>
            {isExpanded && (
              <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'var(--space-4)' }}>
                <div className="sl-eyebrow" style={{ color:'var(--color-primary)', marginBottom:'var(--space-2)' }}>Ingredients (scaled to {prepQty} servings)</div>
                <ul style={{ listStyle:'disc', paddingLeft:20, margin:'0 0 16px' }}>
                  {matched.ingredients.map((ing, i) => (
                    <li key={i} style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)', marginBottom:4 }}>
                      <b>{scaleQty(ing.qty)}</b> {ing.item}
                    </li>
                  ))}
                </ul>
                {matched.notes && (
                  <div className="sl-alert sl-alert-info" style={{ fontSize:'var(--text-sm)' }}>
                    <b>Notes:</b> {matched.notes}
                  </div>
                )}
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
  id: string
  residentId: string
  residentName: string
  room: string
  meal: 'Breakfast' | 'Lunch' | 'Dinner'
  entree: string
  sides: string
  dessert: string
  beverages: string
  notes: string
  // Auto-pulled from resident
  dietType: string
  texture: string
  allergies: string[]
  portionSize: string
  servingLocation: string
  tableAssignment: string
}

function TrayTicketsTab() {
  const { residents }  = useResidentsStore()
  const { weeks, items } = useMenuStore()
  const activeWeek     = weeks.find(w => w.active) ?? weeks[0] ?? null
  const activeResidents = residents.filter(r => r.status === 'Active')

  const [search,   setSearch]   = useState('')
  const [tickets,  setTickets]  = useState<TrayTicket[]>([])
  const [mealPick, setMealPick] = useState<'Breakfast'|'Lunch'|'Dinner'>('Lunch')
  const [dayPick,  setDayPick]  = useState<DayOfWeek>(DAYS[(new Date().getDay()+1)%7])

  const itemName = (id: string) => items.find(i => i.id === id)?.name ?? id

  // Filtered resident search results
  const q = search.toLowerCase().trim()
  const suggestions = q.length >= 1
    ? activeResidents.filter(r => r.name.toLowerCase().includes(q) || r.room.includes(q)).slice(0, 8)
    : []

  function addTicket(r: Resident) {
    setSearch('')
    if (tickets.find(t => t.residentId === r.id && t.meal === mealPick)) return // no dupe

    const dayMenu = activeWeek?.days?.[dayPick]
    const slot    = mealPick.toLowerCase() as 'breakfast' | 'lunch' | 'dinner'

    // Pull menu for the selected day/meal
    let entree = ''
    let sides  = ''
    let dessert = ''
    if (dayMenu) {
      if (slot === 'breakfast') {
        const ids = dayMenu.breakfast?.itemIds ?? []
        entree = ids.slice(0,2).map(itemName).join(', ')
        sides  = ids.slice(2).map(itemName).join(', ')
      } else {
        // Default to opt1 — staff can override after generating
        const meat  = dayMenu[`${slot}Opt1Meat`   as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ') ?? ''
        const veg   = dayMenu[`${slot}Opt1Veggie` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ') ?? ''
        const starch= dayMenu[`${slot}Opt1Starch` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ') ?? ''
        entree  = meat
        sides   = [veg, starch].filter(Boolean).join(', ')
        dessert = dayMenu[`${slot}Dessert` as keyof typeof dayMenu]?.itemIds?.map(itemName).join(', ') ?? ''
      }
    }

    const ticket: TrayTicket = {
      id:           Math.random().toString(36).slice(2),
      residentId:   r.id,
      residentName: r.name,
      room:         r.room,
      meal:         mealPick,
      entree,
      sides,
      dessert,
      beverages:    r.beverages.join(', '),
      notes:        r.specialInstructions ?? '',
      dietType:     r.dietType,
      texture:      r.texture,
      allergies:    r.allergies,
      portionSize:  r.portionSize,
      servingLocation: r.servingLocation,
      tableAssignment: r.tableAssignment ?? '',
    }
    setTickets(prev => [...prev, ticket])
  }

  function removeTicket(id: string) {
    setTickets(prev => prev.filter(t => t.id !== id))
  }

  function updateField(id: string, field: keyof TrayTicket, val: string) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

      {/* Controls */}
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
        <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', alignItems:'flex-end' }}>
          {/* Meal */}
          <div style={{ flex:'0 0 auto' }}>
            <label>Meal</label>
            <div style={{ display:'flex', gap:'var(--space-2)' }}>
              {(['Breakfast','Lunch','Dinner'] as const).map(m => (
                <button key={m} onClick={() => setMealPick(m)}
                  className={mealPick === m ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>{m}</button>
              ))}
            </div>
          </div>
          {/* Day */}
          <div style={{ flex:'1 1 200px' }}>
            <label>Day</label>
            <select className="sl-select" value={dayPick} onChange={e => setDayPick(e.target.value as DayOfWeek)}>
              {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
            </select>
          </div>
        </div>

        {/* Resident search */}
        <div style={{ position:'relative' }}>
          <label>Add Resident</label>
          <input
            className="sl-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type name or room number…"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', zIndex:50, boxShadow:'var(--shadow-md)', overflow:'hidden' }}>
              {suggestions.map(r => (
                <button key={r.id} onClick={() => addTicket(r)} style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'none', border:'none', borderBottom:'1px solid var(--border-color)',
                  padding:'10px 14px', cursor:'pointer', textAlign:'left',
                }}>
                  <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{r.name}</span>
                  <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Rm {r.room} · {r.dietType} · {r.texture}{r.allergies.length > 0 ? ' · ⚠ '+r.allergies.join(', ') : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tickets */}
      {tickets.length === 0 && (
        <div className="sl-empty">
          <div style={{ fontSize:36, marginBottom:'var(--space-3)' }}>🍽️</div>
          <div className="sl-empty-title">No tray tickets yet.</div>
          <div className="sl-empty-subtitle">Search for a resident above to generate a ticket.</div>
        </div>
      )}

      {tickets.length > 0 && (
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'var(--space-2)' }}>
          <button onClick={() => setTickets([])} className="btn btn-outline btn-sm">Clear All</button>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">🖸 Print Tickets</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'var(--space-4)' }}>
        {tickets.map(t => (
          <TrayTicketCard key={t.id} ticket={t} onRemove={() => removeTicket(t.id)} onUpdate={updateField} />
        ))}
      </div>
    </div>
  )
}

function TrayTicketCard({ ticket: t, onRemove, onUpdate }: {
  ticket: TrayTicket
  onRemove: () => void
  onUpdate: (id: string, field: keyof TrayTicket, val: string) => void
}) {
  return (
    <div style={{ background:'var(--bg-card)', border:'2px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:'var(--text-lg)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', fontFamily:'var(--font-display)' }}>{t.residentName}</div>
          <div className="sl-eyebrow" style={{ marginTop:2 }}>Room {t.room} · Table {t.tableAssignment || '—'} · {t.servingLocation}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'var(--space-1)' }}>
          <span className="sl-badge sl-badge-primary">{t.meal}</span>
          <span className="sl-badge">{t.portionSize}</span>
        </div>
      </div>

      {/* Auto-filled dietary info — read-only — always visible */}
      <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'var(--space-1)' }}>
        <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>Diet: <b style={{ color:'var(--text-primary)' }}>{t.dietType}</b></span>
        <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>Texture: <b style={{ color:'var(--text-primary)' }}>{t.texture}</b></span>
        {t.allergies.length > 0 && (
          <span style={{ fontSize:'var(--text-sm)', color:'#dc2626', fontWeight:'var(--weight-bold)' }}>⚠ Allergies: {t.allergies.join(', ')}</span>
        )}
      </div>

      {/* Editable fields */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div>
          <label style={{ fontSize:'var(--text-xs)' }}>Entrée</label>
          <input className="sl-input" value={t.entree} onChange={e => onUpdate(t.id, 'entree', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:'var(--text-xs)' }}>Sides</label>
          <input className="sl-input" value={t.sides}  onChange={e => onUpdate(t.id, 'sides', e.target.value)} />
        </div>
        {t.dessert && (
          <div>
            <label style={{ fontSize:'var(--text-xs)' }}>Dessert</label>
            <input className="sl-input" value={t.dessert} onChange={e => onUpdate(t.id, 'dessert', e.target.value)} />
          </div>
        )}
        <div>
          <label style={{ fontSize:'var(--text-xs)' }}>Beverages</label>
          <input className="sl-input" value={t.beverages} onChange={e => onUpdate(t.id, 'beverages', e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:'var(--text-xs)' }}>Special Instructions</label>
          <input className="sl-input" value={t.notes} onChange={e => onUpdate(t.id, 'notes', e.target.value)} />
        </div>
      </div>

      <button onClick={onRemove} className="btn btn-ghost btn-sm" style={{ color:'var(--color-danger)', alignSelf:'flex-end', marginTop:'auto' }}>Remove</button>
    </div>
  )
}

// ── Culinary Prep List ─────────────────────────────────────────────────────────────────
type PrepItem = { id: string; task: string; assignedTo: string; meal: 'breakfast'|'lunch'|'dinner'; done: boolean }
const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' }
const MEAL_SLOTS: ('breakfast'|'lunch'|'dinner')[] = ['breakfast','lunch','dinner']

function CulinaryPrepTab() {
  const [items, setItems] = useState<PrepItem[]>([
    { id:'1', task:'Thaw proteins for dinner service', assignedTo:'Kitchen Staff', meal:'breakfast', done:false },
    { id:'2', task:'Prep soup base',                  assignedTo:'Cook',          meal:'lunch',     done:false },
    { id:'3', task:'Slice vegetables',                assignedTo:'Kitchen Staff', meal:'lunch',     done:false },
    { id:'4', task:'Set up dessert station',          assignedTo:'Cook',          meal:'dinner',    done:false },
  ])
  const [newTask,    setNewTask]    = useState('')
  const [newAssignee,setNewAssignee]= useState('')
  const [newMeal,    setNewMeal]    = useState<'breakfast'|'lunch'|'dinner'>('breakfast')

  function toggle(id: string) { setItems(p => p.map(i => i.id === id ? { ...i, done:!i.done } : i)) }
  function remove(id: string) { setItems(p => p.filter(i => i.id !== id)) }
  function add() {
    if (!newTask.trim()) return
    setItems(p => [...p, { id:Date.now().toString(), task:newTask.trim(), assignedTo:newAssignee||'Unassigned', meal:newMeal, done:false }])
    setNewTask(''); setNewAssignee('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
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
          <select className="sl-select" value={newMeal} onChange={e => setNewMeal(e.target.value as any)}>
            {MEAL_SLOTS.map(s => <option key={s} value={s}>{MEAL_LABELS[s]}</option>)}
          </select>
        </div>
        <button onClick={add} className="btn btn-primary" style={{ flexShrink:0, alignSelf:'flex-end' }}>+ Add</button>
      </div>
      {MEAL_SLOTS.map(slot => {
        const slotItems = items.filter(i => i.meal === slot)
        if (!slotItems.length) return null
        return (
          <div key={slot}>
            <div className="sl-section-title" style={{ color:'var(--color-primary)', marginBottom:'var(--space-2)' }}>{MEAL_LABELS[slot]}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
              {slotItems.map(item => (
                <div key={item.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', padding:'10px 14px', display:'flex', alignItems:'center', gap:'var(--space-3)', opacity:item.done?0.5:1 }}>
                  <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--color-primary)' }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-medium)', color:'var(--text-primary)', textDecoration:item.done?'line-through':'none' }}>{item.task}</span>
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

// ── Shift Checklists ──────────────────────────────────────────────────────────────────
type ShiftType = 'morning' | 'midday' | 'evening'
const SHIFT_TASKS: Record<ShiftType, string[]> = {
  morning: ['Set up breakfast service line','Check fridge & freezer temps (log)','Prep juice, coffee, and milk station','Pull & thaw next-day proteins','Stock condiment carts'],
  midday:  ['Clear breakfast, reset dining room','Set up lunch service line','Deliver room-service trays','Check Ensure fridge stock','Restock paper goods'],
  evening: ['Set up dinner service line','Label and date all stored items','Sanitize prep surfaces & equipment','Complete temperature logs','Secure walk-in cooler & freezer'],
}

function CheckRow({ done, onChange, children }: { done: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onChange} style={{ background:done?'#f0fdf4':'var(--bg-card)', border:`1px solid ${done?'#86efac':'var(--border-color)'}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'center', gap:'var(--space-3)', cursor:'pointer', transition:'all 0.15s' }}>
      <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, border:`2px solid ${done?'#22c55e':'var(--border-color)'}`, background:done?'#22c55e':'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:700 }}>{done?'✓':''}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

function ShiftChecklistsTab() {
  const [shift,   setShift]   = useState<ShiftType>('morning')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  function toggle(t: string) { setChecked(p => { const s=new Set(p); s.has(t)?s.delete(t):s.add(t); return s }) }
  const tasks = SHIFT_TASKS[shift]
  const done  = tasks.filter(t => checked.has(`${shift}:${t}`)).length
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div className="sl-pills">
        {(['morning','midday','evening'] as ShiftType[]).map(s => (
          <button key={s} onClick={() => setShift(s)} className={shift===s?'sl-pill active':'sl-pill'} style={{ textTransform:'capitalize' }}>{s} Shift</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
        <div style={{ flex:1, height:8, background:'var(--bg-app)', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-color)' }}>
          <div style={{ height:'100%', width:`${(done/tasks.length)*100}%`, background:done===tasks.length?'#22c55e':'var(--color-primary)', borderRadius:4, transition:'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{done}/{tasks.length} done</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {tasks.map(task => {
          const key=`${shift}:${task}`, isDone=checked.has(key)
          return (
            <CheckRow key={key} done={isDone} onChange={() => toggle(key)}>
              <span style={{ fontSize:'var(--text-base)', color:'var(--text-primary)', fontWeight:'var(--weight-medium)', textDecoration:isDone?'line-through':'none', opacity:isDone?0.6:1 }}>{task}</span>
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
  const [editing, setEditing] = useState<string|null>(null)
  const [tempQty, setTempQty] = useState(0)
  function saveEdit(id: string) { setItems(p => p.map(i => i.id===id?{...i,qty:tempQty}:i)); setEditing(null) }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
      <p style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}>Items highlighted in amber are below minimum par levels.</p>
      {items.map(item => {
        const low = item.qty < item.min
        return (
          <div key={item.id} style={{ background:low?'#fffbeb':'var(--bg-card)', border:`1px solid ${low?'#fbbf24':'var(--border-color)'}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'center', gap:'var(--space-3)', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)' }}>{item.item}</div>
              <div className="sl-eyebrow" style={{ marginTop:2 }}>Min Par: {item.min} {item.unit}</div>
            </div>
            {editing === item.id ? (
              <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center' }}>
                <input type="number" value={tempQty} onChange={e => setTempQty(+e.target.value)} className="sl-input" style={{ width:70 }} />
                <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>{item.unit}</span>
                <button onClick={() => saveEdit(item.id)} className="btn btn-primary btn-sm">Save</button>
                <button onClick={() => setEditing(null)} className="btn btn-outline btn-sm">Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:'var(--space-3)', alignItems:'center' }}>
                <span style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-black)', color:low?'#d97706':'var(--text-primary)', fontFamily:'var(--font-display)' }}>{item.qty}</span>
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
  const { fetchWeeks, fetchItems } = useMenuStore()
  const { fetch: fetchRecipes }   = useRecipesStore()

  useEffect(() => { fetchResidents(); fetchWeeks(); fetchItems(); fetchRecipes() }, []) // eslint-disable-line

  return (
    <div className="sl-page fade-in">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Production &amp; Service</h1>
        <p className="sl-page-subtitle">Worksheets, tray tickets, prep lists, checklists, and dietary inventory.</p>
      </div>

      <div className="sl-pills" style={{ marginBottom:'var(--space-6)' }}>
        {SERVICE_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={activeTab === t.id ? 'sl-pill active' : 'sl-pill'}>
            <span style={{ marginRight:'var(--space-1)' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-6)', boxShadow:'var(--shadow-sm)' }}>
        {activeTab === 'worksheet'       && <WorksheetTab />}
        {activeTab === 'traytickets'     && <TrayTicketsTab />}
        {activeTab === 'preplist'        && <CulinaryPrepTab />}
        {activeTab === 'shiftchecklists' && <ShiftChecklistsTab />}
        {activeTab === 'inventory'       && <InventoryTab />}
      </div>
    </div>
  )
}
