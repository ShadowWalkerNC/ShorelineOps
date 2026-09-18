import { useEffect, useMemo, useState } from 'react'
import { useMenuStore }      from '../../state/menuStore'
import { useResidentsStore } from '../../state/residentsStore'
import type { Resident }     from '@/types/resident'
import type { DayOfWeek, MealSlot } from '@/types/menu'
import { MEAL_GROUPS } from '@/types/menu'
import type { ProductionSheet } from '@/types/production'
import { productionApi } from '@/api/production'
import ProductionSheetView from './components/ProductionSheet'
import HydrationPassTab from './components/HydrationPass'
import TempLogPanel from '../kitchen/TempLogPanel' // C01: HACCP temperature logging tab (self-contained)
import { KitchenModeProvider, KitchenFitShell, KitchenModeToggle } from '../kitchen/KitchenModeContext'
import ClinicalSafetyStrip from '../kitchen/ClinicalSafetyStrip'
import {
  FileText,
  Utensils,
  ChefHat,
  CheckSquare,
  Droplets,
  Thermometer,
  CheckCircle2,
  Printer,
  Bed,
  Edit3,
  type LucideIcon
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────────
type ServiceTab = 'worksheet' | 'traytickets' | 'preplist' | 'shiftchecklists' | 'hydration' | 'templog'

const SERVICE_TABS: { id: ServiceTab; label: string; icon: LucideIcon }[] = [
  { id: 'worksheet',       label: 'Worksheet',    icon: FileText },
  { id: 'traytickets',     label: 'Tray Tickets', icon: Utensils },
  { id: 'preplist',        label: 'Prep List',    icon: ChefHat },
  { id: 'shiftchecklists', label: 'Shift Checks', icon: CheckSquare },
  { id: 'hydration',       label: 'Hydration',    icon: Droplets },
  { id: 'templog',         label: 'Temp Log',     icon: Thermometer }, // C01
]

const DAYS: DayOfWeek[] = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  Sunday:'Sunday', Monday:'Monday', Tuesday:'Tuesday', Wednesday:'Wednesday',
  Thursday:'Thursday', Friday:'Friday', Saturday:'Saturday',
}

// ── Shared helpers ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }
function dateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="sl-stat-card">
      <div className="sl-eyebrow" style={{ marginBottom:'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize:'var(--text-4xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color: color ?? 'var(--color-primary)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'var(--text-base)', color:'var(--text-muted)', marginTop:'var(--space-1)' }}>{sub}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// WORKSHEET TAB — backend-backed production sheets (live census)
// ────────────────────────────────────────────────────────────────────────────
type MealId = 'breakfast' | 'lunch' | 'dinner'
const MEAL_IDS: { id: MealId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch',     label: 'Lunch' },
  { id: 'dinner',    label: 'Dinner' },
]

function slotsForMeal(mealId: MealId): { slot: MealSlot; label: string }[] {
  const group = MEAL_GROUPS.find(g => g.id === mealId)
  if (!group) return []
  if (group.singleSlot) return [{ slot: group.singleSlot, label: 'Breakfast' }]
  const out: { slot: MealSlot; label: string }[] = []
  group.options?.forEach(opt => {
    opt.slots.forEach(s => out.push({ slot: s.slot, label: `${opt.label} · ${s.label}` }))
  })
  if (group.dessertSlot) out.push({ slot: group.dessertSlot, label: 'Dessert' })
  return out
}

function WorksheetTab() {
  const { weeks, fetchWeeks } = useMenuStore()
  const activeWeek = weeks.find(w => w.active) ?? weeks[0] ?? null

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DAYS[(new Date().getDay() + 1) % 7])
  const [mealId, setMealId]           = useState<MealId>('lunch')
  const [slot, setSlot]               = useState<MealSlot>('lunchOpt1Meat')

  const [sheet,   setSheet]   = useState<ProductionSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [staffName, setStaffName] = useState('')
  const [signing,   setSigning]   = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  useEffect(() => { fetchWeeks() }, []) // eslint-disable-line

  useEffect(() => {
    if (!activeWeek) { setSheet(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    productionApi.getSheet(activeWeek.id, selectedDay, slot)
      .then(s => { if (!cancelled) setSheet(s) })
      .catch((e: any) => {
        if (cancelled) return
        setSheet(null)
        setError(e?.response?.data?.error ?? e?.message ?? 'Could not load the production sheet.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeWeek?.id, selectedDay, slot]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickMeal(m: MealId) {
    setMealId(m)
    const first = slotsForMeal(m)[0]
    if (first) setSlot(first.slot)
  }

  async function handleSignOff() {
    if (!sheet || !staffName.trim() || signing) return
    setSigning(true)
    setSignError(null)
    try {
      const updated = await productionApi.signOff(sheet.id, staffName.trim())
      setSheet(updated)
      setStaffName('')
    } catch (e: any) {
      setSignError(e?.response?.data?.error ?? 'Sign-off failed — please try again.')
    } finally {
      setSigning(false)
    }
  }

  async function handleSaveNote(menuItemId: string, note: string) {
    if (!sheet) return
    const rows = sheet.rows.map(r =>
      r.menuItemId === menuItemId ? { ...r, kitchenNote: note } : r
    )
    const updated = await productionApi.updateSheet(sheet.id, { rows })
    setSheet(updated)
  }

  const slotOptions = slotsForMeal(mealId)
  const counts = sheet?.counts

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-6)' }}>

      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div className="sl-eyebrow">Planning For</div>
        <div className="sl-pills">
          {DAYS.map(d => (
            <button key={d} onClick={() => setSelectedDay(d)} className={selectedDay===d?'sl-pill active':'sl-pill'} style={{ minHeight:44 }}>
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
        {activeWeek
          ? <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Active menu: <b>{activeWeek.name}</b> · counts from live census</p>
          : <div className="sl-alert sl-alert-warning">No active menu week. Set one in the Menu page.</div>}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div className="sl-eyebrow">Meal</div>
        <div className="sl-pills">
          {MEAL_IDS.map(m => (
            <button key={m.id} onClick={() => pickMeal(m.id)} className={mealId===m.id?'sl-pill active':'sl-pill'} style={{ minHeight:44 }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        <div className="sl-eyebrow">Slot</div>
        <div className="sl-pills" style={{ flexWrap:'wrap' }}>
          {slotOptions.map(o => (
            <button key={o.slot} onClick={() => setSlot(o.slot)} className={slot===o.slot?'sl-pill active':'sl-pill'} style={{ minHeight:44 }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="sl-empty">
          <div className="sl-empty-title">Loading sheet…</div>
          <div className="sl-empty-subtitle">Generating from the active menu week and current census.</div>
        </div>
      )}

      {error && !loading && (
        <div className="sl-alert sl-alert-danger">
          <b>Couldn&apos;t load the production sheet.</b> {error}
        </div>
      )}

      {!loading && !error && sheet && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'var(--space-3)' }}>
            <StatCard label="Census"       value={counts?.total ?? 0}          color="var(--color-primary)" />
            <StatCard label="Dining Room"  value={counts?.diningRoom ?? 0}      color="#059669" />
            <StatCard label="Room Service" value={counts?.room ?? 0}           color="#d97706" />
            <StatCard label="Asst. Living" value={counts?.assistedLiving ?? 0} color="#7c3aed" />
            <StatCard label="Memory Care"  value={counts?.memoryCare ?? 0}     color="#dc2626" />
            <StatCard label="Out"          value={counts?.absent ?? 0}         color="#64748b" sub="hospital / LOA" />
          </div>

          <ProductionSheetView sheet={sheet} onSaveNote={handleSaveNote} />

          <div style={{ background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
            {sheet.signedOffBy ? (
              <div className="sl-alert sl-alert-success" style={{ margin:0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <b>Signed off by {sheet.signedOffBy}</b>
                  {sheet.signedOffAt && <> at {new Date(sheet.signedOffAt).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</>}
                  <div style={{ fontSize:'var(--text-xs)', marginTop:4, opacity:0.8 }}>Audit entry recorded.</div>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'var(--space-3)', alignItems:'flex-end' }}>
                <div style={{ flex:'1 1 220px' }}>
                  <label>Staff name (sign-off)</label>
                  <input
                    className="sl-input"
                    value={staffName}
                    onChange={e => setStaffName(e.target.value)}
                    placeholder="e.g. Maria Lopez"
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={handleSignOff}
                  className="btn btn-primary"
                  disabled={!staffName.trim() || signing}
                  style={{ minHeight:44, flexShrink:0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{signing ? 'Signing off…' : 'Sign Off Sheet'}</span>
                </button>
              </div>
            )}
            {signError && <div className="sl-alert sl-alert-danger" style={{ marginTop:'var(--space-3)' }}>{signError}</div>}
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => window.print()} className="btn btn-outline" style={{ minHeight:44, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>
          </div>
        </>
      )}
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
                  <span style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>Rm {r.room} · {r.servingLocation} · {r.dietType}{r.allergies.length>0?' · Allergies: '+r.allergies.join(', '):''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {roomServiceCount>0&&(
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', paddingTop:'var(--space-2)', borderTop:'1px dashed var(--border-color)' }}>
            <span style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)' }}><b>{roomServiceCount}</b> residents need delivery for {mealPick}.</span>
            <button onClick={generateRoomService} className="btn btn-outline btn-sm" style={{ whiteSpace:'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Bed className="w-3.5 h-3.5" />
              <span>Generate All Room Service Tickets</span>
            </button>
          </div>
        )}
      </div>

      {tickets.length===0&&(
        <div className="sl-empty">
          <Utensils className="w-9 h-9 text-slate-400" style={{ margin: '0 auto var(--space-3)' }} />
          <div className="sl-empty-title">No tray tickets yet.</div>
          <div className="sl-empty-subtitle">Search a resident above, or use "Generate All Room Service Tickets" to create delivery tickets in one click.</div>
        </div>
      )}

      {tickets.length>0&&(
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'var(--space-2)' }}>
          <button onClick={()=>setTickets([])} className="btn btn-outline btn-sm">Clear All</button>
          <button onClick={()=>window.print()} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Printer className="w-3.5 h-3.5" />
            <span>Print Tickets</span>
          </button>
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
        <span style={{ fontSize:'var(--text-base)', color:'var(--text-secondary)' }}>Diet: <b style={{ color:'var(--text-primary)' }}>{t.dietType}</b> · Texture: <b>{t.texture}</b> · Portion: <b>{t.portionSize}</b></span>
        {t.allergies.length>0&&<span style={{ fontSize:'var(--text-base)', color:'#dc2626', fontWeight:'var(--weight-bold)' }}>Allergies: {t.allergies.join(', ')}</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
        {([['entree','Entrée'],['sides','Sides'],['dessert','Dessert'],['beverages','Beverages'],['notes','Special Instructions']] as [keyof TrayTicket,string][]).map(([field,lbl])=>(
          (field!=='dessert'||t.dessert)?(
            <div key={field as string}>
              <label style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)' }}>{lbl}</label>
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
// PREP LIST — manual tasks only.
// (Auto-generated prep tasks were retired: portion counts now come from the
// backend production sheet engine, which owns census-based math.)
// ────────────────────────────────────────────────────────────────────────────
type PrepTask = {
  id: string
  task: string
  detail: string
  meal: 'prep' | 'breakfast' | 'lunch' | 'dinner'
  dueDate: string
  done: boolean
}

function CulinaryPrepTab() {
  const [manualTasks,setManualTasks]=useState<PrepTask[]>([])
  const [newTask,   setNewTask]    =useState('')
  const [newDetail, setNewDetail]  =useState('')
  const [newMeal,   setNewMeal]    =useState<PrepTask['meal']>('prep')
  const [newDue,    setNewDue]     =useState(new Date().toISOString().slice(0,10))
  const [doneIds,   setDoneIds]    =useState<Set<string>>(new Set())

  function toggleDone(id:string) { setDoneIds(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s }) }
  function addManual() {
    if(!newTask.trim()) return
    setManualTasks(p=>[...p,{ id:uid(), task:newTask.trim(), detail:newDetail.trim(), meal:newMeal, dueDate:newDue || new Date().toISOString().slice(0,10), done:false }])
    setNewTask(''); setNewDetail('')
  }
  function removeManual(id:string) {
    setManualTasks(p=>p.filter(t=>t.id!==id))
    setDoneIds(prev=>{ const s=new Set(prev); s.delete(id); return s })
  }

  const allTasks=useMemo(()=>manualTasks.map(t=>({...t,done:doneIds.has(t.id)})),[manualTasks,doneIds])

  const byDate=useMemo(()=>{
    const map:Record<string,PrepTask[]>={}
    allTasks.forEach(t=>{ ;(map[t.dueDate]??=[]).push(t) })
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[allTasks])

  const totalDone=allTasks.filter(t=>t.done).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
      <div className="sl-alert sl-alert-info">
        Portion counts now come from the <b>Worksheet</b> tab&apos;s backend production sheet.
        Use this list for extra manual prep tasks the kitchen needs to track.
      </div>

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
              const isDone=task.done
              return (
                <div key={task.id} onClick={()=>toggleDone(task.id)} style={{ background:isDone?'#f0fdf4':'var(--bg-card)', border:`1px solid ${isDone?'#86efac':'var(--border-color)'}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:'var(--space-3)', cursor:'pointer', opacity:isDone?0.6:1, transition:'all 0.15s' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, border:`2px solid ${isDone?'#22c55e':'var(--border-color)'}`, background:isDone?'#22c55e':'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:700, marginTop:1 }}>{isDone?'✓':''}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)', flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontSize:'var(--text-base)', fontWeight:'var(--weight-semi)', color:'var(--text-primary)', textDecoration:isDone?'line-through':'none' }}>{task.task}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#7c3aed', color:'#fff', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0, display:'inline-flex', alignItems:'center', gap:4 }}>
                        <Edit3 size={11} /> Manual
                      </span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--bg-app)', color:'var(--text-secondary)', border:'1px solid var(--border-color)', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>
                        {task.meal==='prep'?'All Meals':task.meal}
                      </span>
                    </div>
                    {task.detail&&<div style={{ fontSize:'var(--text-sm)', color:'var(--text-secondary)', lineHeight:1.5 }}>{task.detail}</div>}
                  </div>
                  <button onClick={e=>{e.stopPropagation();removeManual(task.id)}} style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:20, fontWeight:700, padding:'10px 14px', minHeight:44, minWidth:44, flexShrink:0 }} aria-label="Remove task">×</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {allTasks.length===0&&(
        <div className="sl-empty">
          <div style={{ display:'flex', justifyContent:'center', marginBottom:'var(--space-3)' }}><ChefHat size={36} className="text-muted-foreground" /></div>
          <div className="sl-empty-title">No manual prep tasks.</div>
          <div className="sl-empty-subtitle">Add tasks below to track anything the worksheet doesn&apos;t cover.</div>
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
          <button onClick={addManual} className="btn btn-primary" style={{ flexShrink:0, alignSelf:'flex-end', minHeight:44 }}>+ Add</button>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={()=>window.print()} className="btn btn-outline" style={{ minHeight:44, display:'inline-flex', alignItems:'center', gap:6 }}>
          <Printer size={16} /> Print Prep List
        </button>
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
function ProductionPageView() {
  const [activeTab,    setActiveTab]    = useState<ServiceTab>('worksheet')
  const { residents, fetch: fetchResidents } = useResidentsStore()
  const { fetchWeeks, fetchItems }      = useMenuStore()

  useEffect(() => { fetchResidents(); fetchWeeks(); fetchItems() }, []) // eslint-disable-line

  return (
    <KitchenFitShell className="sl-page fade-in">
      <div className="sl-page-header">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-3)', flexWrap:'wrap' }}>
          <div>
            <h1 className="sl-page-title">Production &amp; Service</h1>
            <p className="sl-page-subtitle">Worksheets, tray tickets, prep lists, shift checklists, and hydration passes.</p>
          </div>
          <KitchenModeToggle />
        </div>
        <div style={{ marginTop:'var(--space-3)' }}>
          <ClinicalSafetyStrip residents={residents as any[]} />
        </div>
      </div>

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
                minHeight: 44,
              }}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
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
        {activeTab==='hydration'       && <HydrationPassTab />}
        {activeTab==='templog'         && <TempLogPanel />}
      </div>
    </KitchenFitShell>
  )
}

function ProductionPageInner() {
  return <ProductionPageView />
}

/** C02: each kitchen page mounts its own provider so the per-device
 *  kitchen-mode preference applies to this page's subtree. */
export default function ProductionPage() {
  return (
    <KitchenModeProvider>
      <ProductionPageInner />
    </KitchenModeProvider>
  )
}
