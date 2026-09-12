import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { CheckSquare, Calendar, ChevronLeft, ChevronRight, Zap, Users, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { iddsiForTexture, iddsiChipLabel } from '@/types/resident'
import { KitchenModeProvider, KitchenFitShell, KitchenModeToggle } from './KitchenModeContext'
import ClinicalSafetyStrip from './ClinicalSafetyStrip'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MEALS = ['Lunch', 'Supper']

function getMostRecentSunday(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(sunday: string) {
  const d = new Date(sunday + 'T12:00:00')
  const sat = new Date(d)
  sat.setDate(sat.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${d.toLocaleDateString('en-US', opts)} – ${sat.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

interface OrderCellProps {
  order: any
  resident: any
  residentId: string
  weekStart: string
  day: string
  meal: string
  onSave: (payload: any) => Promise<void>
}

// ── B02: clinical surfacing at the order-entry decision point ──────────────
// Raw resident rows from /api/kitchen/orders are DB snake_case (is_npo,
// allergies, texture); other clients may return camelCase. Read both.
function residentClinical(r: any) {
  return {
    allergies: ((r?.allergies ?? []) as string[]),
    texture: (r?.texture ?? 'Regular') as string,
    isNpo: Boolean(r?.is_npo ?? r?.isNpo ?? false),
    npoReason: (r?.npo_reason ?? r?.npoReason ?? '') as string,
  }
}

/**
 * Warning-only conflict check (never silently changes the order).
 * - NPO + anything but Declined → hard-block (non-overridable; surfaced here).
 * - Modified IDDSI texture + a standard entrée choice with no adaptation in
 *   the notes → texture-mismatch risk warning.
 */
function orderConflict(
  resident: any,
  choice: string,
  modifier: string
): { tone: 'block' | 'warn'; text: string } | null {
  const { texture, isNpo } = residentClinical(resident)
  if (isNpo && choice !== 'declined') {
    return { tone: 'block', text: 'NPO HARD-BLOCK — no tray may be served. Set this cell to Declined.' }
  }
  const { level, label } = iddsiForTexture(texture)
  if (level < 7 && (choice === '1' || choice === '2') && !modifier.trim()) {
    return {
      tone: 'warn',
      text: `Texture risk — resident is ${label} (IDDSI L${level}). Confirm the entrée is prepared to this texture, or record the adaptation in notes / use Standing Alt.`,
    }
  }
  return null
}

/** Allergy badges + IDDSI texture chip rendered in each resident row. */
function ClinicalBadges({ resident }: { resident: any }) {
  const { allergies, texture, isNpo } = residentClinical(resident)
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span
        className="px-2 py-1 rounded-md text-sm font-black font-mono bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
        title={`IDDSI 2.0 food level for texture: ${texture}`}
      >
        {iddsiChipLabel(texture)}
      </span>
      {isNpo && (
        <span className="px-2 py-1 rounded-md text-sm font-black bg-red-600 text-white">
          NPO — NO TRAY
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
        <span className="px-2 py-1 rounded-md text-sm font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          NKDA
        </span>
      )}
    </div>
  )
}

function OrderCell({ order, resident, residentId, weekStart, day, meal, onSave }: OrderCellProps) {
  const choice = order?.choice_selected ?? 1
  const modifier = order?.modifier_text ?? ''
  const isAlt = !!order?.is_alternative
  const isDeclined = !!order?.is_declined

  const [localChoice, setLocalChoice] = useState(isAlt ? 'alt' : isDeclined ? 'declined' : String(choice))
  const [localModifier, setLocalModifier] = useState(modifier)
  const saveTimer = useRef<any>(null)

  useEffect(() => {
    setLocalChoice(
      order?.is_alternative
        ? 'alt'
        : order?.is_declined
        ? 'declined'
        : String(order?.choice_selected ?? 1)
    )
    setLocalModifier(order?.modifier_text ?? '')
  }, [order])

  function scheduleSave(newChoice: string, newModifier: string) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const payload = {
        resident_id: residentId,
        week_start_date: weekStart,
        day_of_week: day,
        meal_type: meal,
        choice_selected: newChoice === 'alt' || newChoice === 'declined' ? null : parseInt(newChoice),
        modifier_text: newModifier,
        is_alternative: newChoice === 'alt' ? 1 : 0,
        is_declined: newChoice === 'declined' ? 1 : 0,
      }
      onSave(payload)
    }, 600)
  }

  function handleChoice(e: React.ChangeEvent<HTMLSelectElement>) {
    setLocalChoice(e.target.value)
    scheduleSave(e.target.value, localModifier)
  }

  function handleModifier(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalModifier(e.target.value)
    scheduleSave(localChoice, e.target.value)
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      <select
        value={localChoice}
        onChange={handleChoice}
        className={`w-full min-h-[44px] py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${
          localChoice === '1'
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            : localChoice === '2'
            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            : localChoice === 'alt'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
        }`}
      >
        <option value="1">Choice 1</option>
        <option value="2">Choice 2</option>
        <option value="alt">Standing Alt</option>
        <option value="declined">Declined</option>
      </select>
      <input
        type="text"
        placeholder="Custom notes…"
        value={localModifier}
        onChange={handleModifier}
        className="w-full min-h-[44px] py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      />
      {(() => {
        const conflict = orderConflict(resident, localChoice, localModifier)
        if (!conflict) return null
        return (
          <div
            role="alert"
            className={`flex items-start gap-1.5 px-2 py-2 rounded-lg text-sm font-bold leading-snug ${
              conflict.tone === 'block'
                ? 'bg-red-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
            <span>{conflict.text}</span>
          </div>
        )
      })()}
    </div>
  )
}

function OrderEntryPageInner() {
  const [week, setWeek] = useState(getMostRecentSunday())
  const [viewMode, setViewMode] = useState<'day' | 'weekly'>('day')
  const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay()])
  const [residents, setResidents] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initBusy, setInitBusy] = useState(false)

  const token = tokenManager.getAccessToken()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [resResidents, resOrders] = await Promise.all([
        fetch('/api/residents', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/kitchen/orders?week=${week}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const rData = await resResidents.json()
      const oData = await resOrders.json()
      // /api/residents returns a list; /api/kitchen/orders returns
      // { residents, orderMap, week } (orderMap is flattened below).
      setResidents(rData.residents || rData || [])
      setOrders(oData.orders || oData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [week, token])

  // Flatten the /api/kitchen/orders orderMap (resident → day → meal) into the
  // cell rows the grid expects. Handles a plain array payload too.
  const orderList = useMemo(() => {
    if (Array.isArray(orders)) return orders
    const map = (orders as any)?.orderMap
    if (!map) return []
    const list: any[] = []
    for (const residentId of Object.keys(map)) {
      const byDay = map[residentId] || {}
      for (const day_of_week of Object.keys(byDay)) {
        const byMeal = byDay[day_of_week] || {}
        for (const meal_type of Object.keys(byMeal)) {
          list.push({ resident_id: residentId, day_of_week, meal_type, ...byMeal[meal_type] })
        }
      }
    }
    return list
  }, [orders])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveCell = async (payload: any) => {
    setSaving(true)
    try {
      // Backend registers PUT /api/kitchen/orders (single-cell upsert).
      await fetch('/api/kitchen/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleInitWeek = async () => {
    setInitBusy(true)
    try {
      // Backend registers POST /api/kitchen/orders/initialize-week.
      await fetch('/api/kitchen/orders/initialize-week', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ week_start_date: week }),
      })
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setInitBusy(false)
    }
  }

  const navWeek = (delta: number) => {
    const d = new Date(week + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setWeek(d.toISOString().slice(0, 10))
  }

  return (
    <KitchenFitShell className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Meal Tally &amp; Selection Entry
            </h1>
            <AppleBadge color="blue" dot className="text-sm">
              {formatWeekLabel(week)}
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pre-service meal selection tally, resident choice recording, and standing diet adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {saving && <span className="text-sm font-mono font-bold text-slate-400">Saving…</span>}
          <KitchenModeToggle />
          <AppleButton
            variant="primary"
            size="md"
            className="min-h-[44px]"
            icon={<Zap className="w-4 h-4" />}
            onClick={handleInitWeek}
            disabled={initBusy}
          >
            {initBusy ? 'Initializing…' : 'Initialize Week'}
          </AppleButton>
        </div>
      </div>

      {/* ── C02 clinical safety strip: current meal + live allergy/NPO counts ── */}
      <ClinicalSafetyStrip residents={residents} />

      {/* ── Controls Bar ── */}
      <AppleCard className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navWeek(-1)}
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white px-2">
            {formatWeekLabel(week)}
          </span>
          <button
            onClick={() => navWeek(1)}
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setViewMode('day')}
            className={`min-h-[44px] px-4 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'day' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`min-h-[44px] px-4 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'weekly' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Weekly Grid
          </button>
        </div>
      </AppleCard>

      {/* Day Selector Pills for Day View */}
      {viewMode === 'day' && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`min-h-[44px] px-5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeDay === d
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Tally Entry Table */}
      <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-850 font-bold uppercase font-mono text-xs text-slate-400">
              <tr>
                <th className="p-3.5 w-24">Room</th>
                <th className="p-3.5 w-48">Resident Name</th>
                <th className="p-3.5 w-36">Diet Order</th>
                {viewMode === 'day' ? (
                  <>
                    <th className="p-3.5">Lunch Service</th>
                    <th className="p-3.5">Dinner Service</th>
                  </>
                ) : (
                  DAYS.map(d => (
                    <th key={d} className="p-3.5 text-center min-w-[130px]">
                      {d.slice(0, 3)}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {residents.map((r: any) => {
                // B02: flag rows with allergies or texture restrictions prominently.
                const clin = residentClinical(r)
                const restricted = clin.isNpo || clin.allergies.length > 0 || iddsiForTexture(clin.texture).level < 7
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                      clin.isNpo
                        ? 'bg-red-50/70 dark:bg-red-950/20'
                        : restricted
                        ? 'bg-amber-50/40 dark:bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <td className="p-3.5 font-mono font-bold text-sm text-slate-500 dark:text-slate-400">
                      {r.roomNumber || r.room || '—'}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</div>
                      <ClinicalBadges resident={r} />
                    </td>
                    <td className="p-3.5 text-sm text-slate-600 dark:text-slate-300">
                      {r.dietType || r.dietOrder || r.diet_type || 'Regular'}
                    </td>
                    {viewMode === 'day' ? (
                      <>
                        <td className="p-2">
                          <OrderCell
                            order={orderList.find(o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Lunch')}
                            resident={r}
                            residentId={r.id}
                            weekStart={week}
                            day={activeDay}
                            meal="Lunch"
                            onSave={handleSaveCell}
                          />
                        </td>
                        <td className="p-2">
                          <OrderCell
                            order={orderList.find(o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Supper')}
                            resident={r}
                            residentId={r.id}
                            weekStart={week}
                            day={activeDay}
                            meal="Supper"
                            onSave={handleSaveCell}
                          />
                        </td>
                      </>
                    ) : (
                      DAYS.map(d => (
                        <td key={d} className="p-2">
                          <OrderCell
                            order={orderList.find(o => o.resident_id === r.id && o.day_of_week === d && o.meal_type === 'Lunch')}
                            resident={r}
                            residentId={r.id}
                            weekStart={week}
                            day={d}
                            meal="Lunch"
                            onSave={handleSaveCell}
                          />
                        </td>
                      ))
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </AppleCard>
    </KitchenFitShell>
  )
}

/** C02: each kitchen page mounts its own provider so the per-device
 *  kitchen-mode preference applies to this page's subtree. */
export default function OrderEntryPage() {
  return (
    <KitchenModeProvider>
      <OrderEntryPageInner />
    </KitchenModeProvider>
  )
}
