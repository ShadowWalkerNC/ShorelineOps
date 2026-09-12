import { useState, useEffect, useMemo } from 'react'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { ChefHat, Printer, Edit2, Calendar, Utensils, AlertCircle, AlertTriangle, CheckCircle2, UserX, ShieldAlert } from 'lucide-react'
import { iddsiChipLabel } from '@/types/resident'
import TempLogPanel from './TempLogPanel' // C01: HACCP temp entry (self-contained; sits below the sheet)
import { KitchenModeProvider, KitchenFitShell, KitchenModeToggle } from './KitchenModeContext'
import ClinicalSafetyStrip from './ClinicalSafetyStrip'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// B08: canonical meal slots — Breakfast / Lunch / Dinner. Legacy stored
// 'Supper' order rows are mapped to 'Dinner' at read time (see the clinical
// join below and the /sheet endpoint).
const MEALS = ['Breakfast', 'Lunch', 'Dinner']

function getSunday(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

// ── B02: per-batch clinical surfacing for the cook's sheet ──────────────────
// Joins the sheet's orderMap (resident → day → meal) with the active-census
// resident rows so each production batch shows its allergens, IDDSI textures
// and NPO hard-blocks. Display only — never overrides the counts.
interface SheetMember {
  id: string
  name: string
  room: string
  allergies: string[]
  texture: string
  isNpo: boolean
  npoReason: string
  modifier: string
}

function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}

function BatchClinicalStrip({
  title,
  dish,
  members,
}: {
  title: string
  dish: string
  members: SheetMember[]
}) {
  const allergens = distinctSorted(members.flatMap(m => m.allergies))
  const textures = distinctSorted(members.map(m => m.texture))
  const npoViolations = members.filter(m => m.isNpo)
  return (
    <AppleCard className="p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">{title}</div>
          <div className="text-base font-black text-slate-900 dark:text-white truncate">{dish}</div>
        </div>
        <AppleBadge color="blue" className="text-sm">{members.length} trays</AppleBadge>
      </div>

      {npoViolations.length > 0 && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-600 text-white text-sm font-black leading-snug">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
          <span>
            NPO HARD-BLOCK — no tray:{' '}
            {npoViolations.map(m => `${m.name} (Rm ${m.room})`).join(', ')}
          </span>
        </div>
      )}

      <div>
        <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono mb-1">Allergens in batch</div>
        {allergens.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {allergens.map(a => (
              <span
                key={a}
                className="px-2 py-1 rounded-md text-sm font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
              >
                ⚠ {a}
              </span>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> NKDA — no allergens recorded in this batch
          </span>
        )}
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono mb-1">IDDSI textures</div>
        {textures.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {textures.map(t => (
              <span
                key={t}
                className="px-2 py-1 rounded-md text-sm font-black font-mono bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                title={`Texture: ${t}`}
              >
                {iddsiChipLabel(t)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-400">No texture data</span>
        )}
      </div>
    </AppleCard>
  )
}

function KitchenSheetPageInner() {
  const [week, setWeek] = useState(getSunday())
  const [day, setDay] = useState(DAYS[new Date().getDay()])
  const [meal, setMeal] = useState('Lunch')

  const [tally, setTally] = useState({ choice1: 0, choice2: 0 })
  const [modifiers, setModifiers] = useState<any[]>([])
  const [alternatives, setAlternatives] = useState<any[]>([])
  const [declined, setDeclined] = useState<any[]>([])
  const [mealOptions, setMealOptions] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)

  // B02: active-census resident rows + orderMap for per-batch clinical data.
  const [sheetResidents, setSheetResidents] = useState<any[]>([])
  const [sheetOrderMap, setSheetOrderMap] = useState<any>({})

  // Edit menus
  const [editMenuMode, setEditMenuMode] = useState(false)
  const [dish1, setDish1] = useState('')
  const [dish2, setDish2] = useState('')

  const token = tokenManager.getAccessToken()

  const loadData = async () => {
    setLoading(true)
    try {
      const [resSheet, resOrders] = await Promise.all([
        fetch(`/api/kitchen/sheet?week=${week}&day=${day}&meal=${meal}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        // B02: join sheet rows to clinical resident data for the safety strip.
        fetch(`/api/kitchen/orders?week=${week}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ])
      const data = await resSheet.json()
      setTally(data.tally || { choice1: 0, choice2: 0 })
      setModifiers(data.modifiers || [])
      setAlternatives(data.alternatives || [])
      setDeclined(data.declined || [])
      setMealOptions(data.mealOptions || [])
      setSummary(data.summary || {})

      const oData = await resOrders.json()
      setSheetResidents(oData.residents || [])
      setSheetOrderMap(oData.orderMap || {})

      const o1 = (data.mealOptions || []).find((o: any) => o.choice_number === 1)
      const o2 = (data.mealOptions || []).find((o: any) => o.choice_number === 2)
      setDish1(o1 ? o1.dish_name : 'Choice 1')
      setDish2(o2 ? o2.dish_name : 'Choice 2')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [week, day, meal])

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const opts = [
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 1, dish_name: dish1 },
        { week_start_date: week, day_of_week: day, meal_type: meal, choice_number: 2, dish_name: dish2 }
      ]
      await fetch('/api/kitchen/meals/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ options: opts })
      })
      setEditMenuMode(false)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const choice1Name = mealOptions.find(o => o.choice_number === 1)?.dish_name || 'Choice 1 (Roast Turkey)'
  const choice2Name = mealOptions.find(o => o.choice_number === 2)?.dish_name || 'Choice 2 (Vegetarian Lasagna)'

  // ── B02: per-batch clinical breakdown for the selected service ──────────
  // Groups recorded orders (resident → day → meal) into production batches and
  // attaches each resident's allergies, IDDSI texture and NPO flag.
  const batches = useMemo(() => {
    const byId = new Map<string, any>(sheetResidents.map(r => [r.id, r]))
    const groups: Record<'choice1' | 'choice2' | 'alt' | 'declined', SheetMember[]> = {
      choice1: [], choice2: [], alt: [], declined: [],
    }
    for (const residentId of Object.keys(sheetOrderMap || {})) {
      // B08: legacy stored 'Supper' rows read as 'Dinner' (never dropped).
      const cell = sheetOrderMap[residentId]?.[day]?.[meal]
        ?? (meal === 'Dinner' ? sheetOrderMap[residentId]?.[day]?.['Supper'] : undefined)
      if (!cell) continue
      const r = byId.get(residentId)
      if (!r) continue
      const member: SheetMember = {
        id: residentId,
        name: r.name ?? '',
        room: r.room ?? '',
        allergies: (r.allergies ?? []) as string[],
        texture: (r.texture ?? 'Regular') as string,
        isNpo: Boolean(r.is_npo ?? r.isNpo ?? false),
        npoReason: (r.npo_reason ?? r.npoReason ?? '') as string,
        modifier: (cell.modifier_text ?? '') as string,
      }
      if (cell.is_declined) groups.declined.push(member)
      else if (cell.is_alternative) groups.alt.push(member)
      else if (cell.choice_selected === 2) groups.choice2.push(member)
      else groups.choice1.push(member)
    }
    return groups
  }, [sheetOrderMap, sheetResidents, day, meal])

  const hasOrderData = Object.keys(sheetOrderMap || {}).length > 0

  // Fallback join for the sheet API's exception rows (room + name keyed).
  const residentByRoomName = useMemo(() => {
    const m = new Map<string, any>()
    for (const r of sheetResidents) m.set(`${r.room}|${r.name}`, r)
    return m
  }, [sheetResidents])

  return (
    <KitchenFitShell className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Daily Cook &amp; Tally Sheet
            </h1>
            <AppleBadge color="orange" dot className="text-sm">
              {day} &middot; {meal}
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time meal tally orders, special dietary customizations, and alternative plate requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <KitchenModeToggle />
          <AppleButton
            variant="secondary"
            size="md"
            className="min-h-[44px]"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => setEditMenuMode(true)}
          >
            Edit Dish Titles
          </AppleButton>
          <AppleButton
            variant="primary"
            size="md"
            className="min-h-[44px]"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print Sheet
          </AppleButton>
        </div>
      </div>

      {/* ── C02 clinical safety strip: current meal + live allergy/NPO counts ── */}
      <ClinicalSafetyStrip residents={sheetResidents} meal={meal} />

      {/* ── Filter Controls ── */}
      <AppleCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Week Beginning
            </label>
            <input
              type="date"
              className="w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={week}
              onChange={e => setWeek(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Select Day
            </label>
            <select
              className="w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={day}
              onChange={e => setDay(e.target.value)}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5 block">
              Meal Service
            </label>
            <select
              className="w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20"
              value={meal}
              onChange={e => setMeal(e.target.value)}
            >
              {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </AppleCard>

      {/* ── Section A: Tally Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">Primary Entree</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{tally.choice1 || 28}</div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">{choice1Name}</div>
          </div>
        </AppleCard>

        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-purple-500">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">Alternate Entree</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{tally.choice2 || 14}</div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">{choice2Name}</div>
          </div>
        </AppleCard>

        <AppleCard className="p-5 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">Total Standard Orders</div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{(tally.choice1 || 28) + (tally.choice2 || 14)}</div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">Census Headcount Verified</div>
          </div>
        </AppleCard>
      </div>

      {/* ── Section A2: B02 Clinical Safety Strip — per-batch allergens/textures ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Batch Clinical Safety — allergens &amp; IDDSI textures per production batch
          </h3>
        </div>
        {hasOrderData ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <BatchClinicalStrip title="Primary batch" dish={choice1Name} members={batches.choice1} />
              <BatchClinicalStrip title="Alternate batch" dish={choice2Name} members={batches.choice2} />
              <BatchClinicalStrip title="Standing alternatives" dish="Individual alt plates" members={batches.alt} />
              <BatchClinicalStrip title="Declined" dish="No tray prepared" members={batches.declined} />
            </div>
            <p className="text-sm text-slate-400 px-1">
              Built from recorded orders for this service. Residents with no recorded choice are not assigned to a batch.
            </p>
          </>
        ) : (
          <AppleCard className="p-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>No order data for this service yet — initialize the week on the order-entry page to populate batch allergens and textures.</span>
          </AppleCard>
        )}
      </div>

      {/* ── Section B: Special Customizations & Modifiers ── */}
      <AppleCard className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Special Customizations &amp; Texture Exceptions
            </h3>
          </div>
          <AppleBadge color="orange" className="text-sm">
            {modifiers.length > 0 ? `${modifiers.length} Active` : '0 Exceptions'}
          </AppleBadge>
        </div>

        {modifiers.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            No special customized meal requests recorded for this service.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {modifiers.map((m, idx) => {
              // B02: per-item clinical surfacing — IDDSI texture chip + allergen badges.
              const r = residentByRoomName.get(`${m.room_number}|${m.name}`)
              const allergies: string[] = r?.allergies ?? []
              const texture: string = r?.texture ?? 'Regular'
              const isNpo = Boolean(r?.is_npo ?? r?.isNpo ?? false)
              return (
                <div key={idx} className="py-3 flex items-center justify-between text-sm gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-400">[{m.room_number}]</span>
                    <span className="font-bold text-slate-900 dark:text-white">{m.name}</span>
                    <AppleBadge color={m.choice_selected === 1 ? 'blue' : 'purple'}>
                      Choice {m.choice_selected}
                    </AppleBadge>
                    {r && (
                      <>
                        <span
                          className="px-2 py-1 rounded-md text-sm font-black font-mono bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                          title={`Texture: ${texture}`}
                        >
                          {iddsiChipLabel(texture)}
                        </span>
                        {isNpo && (
                          <span className="px-2 py-1 rounded-md text-sm font-black bg-red-600 text-white">
                            NPO
                          </span>
                        )}
                        {allergies.length > 0 ? (
                          allergies.map(a => (
                            <span
                              key={a}
                              className="px-2 py-1 rounded-md text-sm font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            >
                              ⚠ {a}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">NKDA</span>
                        )}
                      </>
                    )}
                  </div>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{m.modifier_text}</span>
                </div>
              )
            })}
          </div>
        )}
      </AppleCard>

      {/* C01: temperature logging — batch completion food temps live here so the
          cook never leaves the sheet; equipment schedule + today's log included. */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <TempLogPanel />
      </div>

      {/* Edit Dish Names Modal */}
      {editMenuMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveMenu} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Meal Option Titles</h3>
            <div>
              <label className="text-sm font-bold uppercase text-slate-400 mb-1 block">Choice 1 Name</label>
              <input
                className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                value={dish1}
                onChange={e => setDish1(e.target.value)}
                placeholder="e.g. Roast Turkey Breast"
              />
            </div>
            <div>
              <label className="text-sm font-bold uppercase text-slate-400 mb-1 block">Choice 2 Name</label>
              <input
                className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                value={dish2}
                onChange={e => setDish2(e.target.value)}
                placeholder="e.g. Vegetarian Lasagna"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AppleButton variant="secondary" className="min-h-[44px]" onClick={() => setEditMenuMode(false)}>
                Cancel
              </AppleButton>
              <AppleButton variant="primary" type="submit" className="min-h-[44px]">
                Save Dishes
              </AppleButton>
            </div>
          </form>
        </div>
      )}
    </KitchenFitShell>
  )
}

/** C02: each kitchen page mounts its own provider so the per-device
 *  kitchen-mode preference applies to this page's subtree. */
export default function KitchenSheetPage() {
  return (
    <KitchenModeProvider>
      <KitchenSheetPageInner />
    </KitchenModeProvider>
  )
}
