import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import {
  CheckSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  Check,
  UtensilsCrossed,
  FileText,
} from 'lucide-react'
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

// ── Clinical surfacing at the order-entry decision point ──────────────
function residentClinical(r: any) {
  return {
    allergies: ((r?.allergies ?? []) as string[]),
    texture: (r?.texture ?? 'Regular') as string,
    isNpo: Boolean(r?.is_npo ?? r?.isNpo ?? false),
    npoReason: (r?.npo_reason ?? r?.npoReason ?? '') as string,
  }
}

/**
 * Deterministic Clinical Safety conflict check.
 * - NPO + anything but Declined → hard-block (non-overridable; surfaced here).
 * - Modified IDDSI texture + standard entrée with no adaptation notes → texture-mismatch warning.
 */
function orderConflict(
  resident: any,
  choice: string,
  modifier: string
): { tone: 'block' | 'warn'; text: string } | null {
  const { texture, isNpo } = residentClinical(resident)
  if (isNpo && choice !== 'declined') {
    return { tone: 'block', text: 'NPO HARD-BLOCK: No tray may be served. Set choice to Declined.' }
  }
  const { level, label } = iddsiForTexture(texture)
  if (level < 7 && (choice === '1' || choice === '2') && !modifier.trim()) {
    return {
      tone: 'warn',
      text: `Texture risk: resident is ${label} (IDDSI L${level}). Confirm texture adaptation or record notes.`,
    }
  }
  return null
}

/** Allergy badges + IDDSI texture chip rendered in resident summaries. */
function ClinicalBadges({ resident }: { resident: any }) {
  const { allergies, texture, isNpo } = residentClinical(resident)
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span
        className="px-2 py-0.5 rounded-lg text-xs font-black font-mono bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
        title={`IDDSI 2.0 food level for texture: ${texture}`}
      >
        {iddsiChipLabel(texture)}
      </span>
      {isNpo && (
        <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-600 text-white shadow-xs">
          ⛔ NPO — NO TRAY
        </span>
      )}
      {allergies.length > 0 ? (
        allergies.map(a => (
          <span
            key={a}
            className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
            {a}
          </span>
        ))
      ) : (
        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          NKDA
        </span>
      )}
    </div>
  )
}

/** Desktop Table Cell for meal order entry. */
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

  const conflict = orderConflict(resident, localChoice, localModifier)

  return (
    <div className="flex flex-col gap-1.5 p-1">
      <select
        value={localChoice}
        onChange={handleChoice}
        className={`w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
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
        className="w-full min-h-[44px] py-2 px-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      />
      {conflict && (
        <div
          role="alert"
          className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold leading-snug ${
            conflict.tone === 'block'
              ? 'bg-rose-600 text-white'
              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{conflict.text}</span>
        </div>
      )}
    </div>
  )
}

/** Mobile-First Tactile Resident Card. */
function MobileResidentCard({
  resident,
  order,
  residentId,
  weekStart,
  day,
  meal,
  onSave,
}: OrderCellProps) {
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

  function handleSelectChoice(newChoice: string) {
    setLocalChoice(newChoice)
    scheduleSave(newChoice, localModifier)
  }

  function handleModifierChange(val: string) {
    setLocalModifier(val)
    scheduleSave(localChoice, val)
  }

  const clin = residentClinical(resident)
  const restricted = clin.isNpo || clin.allergies.length > 0 || iddsiForTexture(clin.texture).level < 7
  const conflict = orderConflict(resident, localChoice, localModifier)

  const CHOICES = [
    { id: '1', label: 'Choice 1', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm' },
    { id: '2', label: 'Choice 2', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm' },
    { id: 'alt', label: 'Standing Alt', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
    { id: 'declined', label: 'Declined', activeClass: 'bg-slate-700 text-white border-slate-700 shadow-sm' },
  ]

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        clin.isNpo
          ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/20 dark:bg-rose-950/20'
          : restricted
          ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      } shadow-xs space-y-3.5`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {resident.roomNumber || resident.room || 'Room —'}
            </span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans">
              {resident.name}
            </h3>
          </div>
          <ClinicalBadges resident={resident} />
        </div>
        <div className="shrink-0 text-right">
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {resident.dietType || resident.dietOrder || resident.diet_type || 'Regular'}
          </span>
        </div>
      </div>

      {/* Tactile Choice Selection Buttons (Jakob's Law: 44px+ touch targets) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {meal} Selection:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CHOICES.map(c => {
            const isSelected = localChoice === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectChoice(c.id)}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                  isSelected
                    ? c.activeClass
                    : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Non-Overridable Clinical Warning Banner */}
      {conflict && (
        <div
          role="alert"
          className={`flex items-start gap-2 p-3 rounded-xl text-xs font-bold leading-snug ${
            conflict.tone === 'block'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{conflict.text}</span>
        </div>
      )}

      {/* Modifier / Adaptation Notes Input */}
      <div>
        <input
          type="text"
          value={localModifier}
          onChange={e => handleModifierChange(e.target.value)}
          placeholder="Custom adaptation, puree consistency, or notes…"
          className="w-full min-h-[44px] py-2 px-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
    </div>
  )
}

function OrderEntryPageInner() {
  const [week, setWeek] = useState(getMostRecentSunday())
  const [viewMode, setViewMode] = useState<'day' | 'weekly'>('day')
  const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay()])
  const [mobileMeal, setMobileMeal] = useState<'Lunch' | 'Supper'>('Lunch')
  const [residents, setResidents] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initBusy, setInitBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'restricted' | 'pending'>('all')

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
      setResidents(rData.residents || rData || [])
      setOrders(oData.orders || oData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [week, token])

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

  // Filtered residents based on search and safety filters
  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.roomNumber && String(r.roomNumber).toLowerCase().includes(q)) ||
        (r.room && String(r.room).toLowerCase().includes(q))

      if (!matchSearch) return false

      if (filterMode === 'restricted') {
        const clin = residentClinical(r)
        return clin.isNpo || clin.allergies.length > 0 || iddsiForTexture(clin.texture).level < 7
      }

      if (filterMode === 'pending') {
        const order = orderList.find(
          o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === mobileMeal
        )
        return !order || (!order.choice_selected && !order.is_alternative && !order.is_declined)
      }

      return true
    })
  }, [residents, searchQuery, filterMode, orderList, activeDay, mobileMeal])

  // Count summaries
  const clinicalCounts = useMemo(() => {
    let npoCount = 0
    let textureCount = 0
    let allergyCount = 0
    for (const r of residents) {
      const clin = residentClinical(r)
      if (clin.isNpo) npoCount++
      if (iddsiForTexture(clin.texture).level < 7) textureCount++
      if (clin.allergies.length > 0) allergyCount++
    }
    return { npoCount, textureCount, allergyCount }
  }, [residents])

  return (
    <KitchenFitShell className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header Card ── */}
      <AppleCard className="p-4 sm:p-6 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Meal Tally &amp; Selection Entry
              </h1>
              <AppleBadge color="blue" dot className="text-xs">
                {formatWeekLabel(week)}
              </AppleBadge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Pre-service meal selection tally, resident choice recording, and clinical diet adjustments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {saving ? (
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Saving…
              </span>
            ) : (
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Synced
              </span>
            )}
            <KitchenModeToggle />
            <AppleButton
              variant="primary"
              size="md"
              className="min-h-[44px] hidden sm:inline-flex"
              icon={<Zap className="w-4 h-4" />}
              onClick={handleInitWeek}
              disabled={initBusy}
            >
              {initBusy ? 'Initializing…' : 'Initialize Week'}
            </AppleButton>
          </div>
        </div>
      </AppleCard>

      {/* ── Clinical Safety Strip (Live Census & NPO Counts) ── */}
      <ClinicalSafetyStrip residents={residents} />

      {/* ── Shared Controls & Filter Card ── */}
      <AppleCard className="p-4 border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Top Control Bar: Week Switcher + View Mode / Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Week Navigation */}
          <div className="flex items-center justify-between md:justify-start gap-2">
            <button
              onClick={() => navWeek(-1)}
              aria-label="Previous week"
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors active:scale-[0.98]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white px-2">
              {formatWeekLabel(week)}
            </span>
            <button
              onClick={() => navWeek(1)}
              aria-label="Next week"
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors active:scale-[0.98]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop-Only View Mode Switcher */}
          <div className="hidden lg:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('day')}
              className={`min-h-[44px] px-4 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Day View (Dual Meal)
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`min-h-[44px] px-4 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Weekly Grid (7-Day Overview)
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search resident name or room number…"
              className="w-full min-h-[44px] pl-9 pr-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterMode('all')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterMode === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({residents.length})
            </button>
            <button
              onClick={() => setFilterMode('restricted')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterMode === 'restricted'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Diet / NPO ({clinicalCounts.npoCount + clinicalCounts.textureCount})
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterMode === 'pending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Pending Choice
            </button>
          </div>
        </div>

        {/* Day Selector Pills (Active in Day View and Mobile) */}
        {(viewMode === 'day' || true) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={`min-h-[44px] px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
                    activeDay === d
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </AppleCard>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE ENVIRONMENT VIEW (Confined, Thumb-Zone Card Interface)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden space-y-3">
        {/* Mobile Meal Selector Card */}
        <AppleCard className="p-2 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
            <button
              onClick={() => setMobileMeal('Lunch')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition-all ${
                mobileMeal === 'Lunch'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lunch Service
            </button>
            <button
              onClick={() => setMobileMeal('Supper')}
              className={`min-h-[44px] rounded-lg text-xs font-bold transition-all ${
                mobileMeal === 'Supper'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Supper Service
            </button>
          </div>
        </AppleCard>

        {/* Mobile Resident Cards List */}
        {filteredResidents.length === 0 ? (
          <AppleCard className="p-8 text-center border border-slate-200 dark:border-slate-800">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No residents match criteria</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try adjusting your search query or reset the safety filter.
            </p>
          </AppleCard>
        ) : (
          filteredResidents.map((r: any) => (
            <MobileResidentCard
              key={`${r.id}-${activeDay}-${mobileMeal}`}
              order={orderList.find(
                o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === mobileMeal
              )}
              resident={r}
              residentId={r.id}
              weekStart={week}
              day={activeDay}
              meal={mobileMeal}
              onSave={handleSaveCell}
            />
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP ENVIRONMENT VIEW (High-Density Dual-Service Table)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <AppleCard className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-850 font-bold uppercase font-mono text-xs text-slate-400">
                <tr>
                  <th className="p-3.5 w-24">Room</th>
                  <th className="p-3.5 w-52">Resident Name</th>
                  <th className="p-3.5 w-40">Diet Order</th>
                  {viewMode === 'day' ? (
                    <>
                      <th className="p-3.5 min-w-[220px]">Lunch Service ({activeDay})</th>
                      <th className="p-3.5 min-w-[220px]">Dinner Service ({activeDay})</th>
                    </>
                  ) : (
                    DAYS.map(d => (
                      <th key={d} className="p-3.5 text-center min-w-[140px]">
                        {d.slice(0, 3)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredResidents.map((r: any) => {
                  const clin = residentClinical(r)
                  const restricted = clin.isNpo || clin.allergies.length > 0 || iddsiForTexture(clin.texture).level < 7
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                        clin.isNpo
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : restricted
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="p-3.5 font-mono font-bold text-xs text-slate-500 dark:text-slate-400">
                        {r.roomNumber || r.room || '—'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</div>
                        <ClinicalBadges resident={r} />
                      </td>
                      <td className="p-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {r.dietType || r.dietOrder || r.diet_type || 'Regular'}
                      </td>
                      {viewMode === 'day' ? (
                        <>
                          <td className="p-2 align-top">
                            <OrderCell
                              order={orderList.find(
                                o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Lunch'
                              )}
                              resident={r}
                              residentId={r.id}
                              weekStart={week}
                              day={activeDay}
                              meal="Lunch"
                              onSave={handleSaveCell}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <OrderCell
                              order={orderList.find(
                                o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Supper'
                              )}
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
                          <td key={d} className="p-2 align-top">
                            <OrderCell
                              order={orderList.find(
                                o => o.resident_id === r.id && o.day_of_week === d && o.meal_type === 'Lunch'
                              )}
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
      </div>
    </KitchenFitShell>
  )
}

export default function OrderEntryPage() {
  return (
    <KitchenModeProvider>
      <OrderEntryPageInner />
    </KitchenModeProvider>
  )
}
