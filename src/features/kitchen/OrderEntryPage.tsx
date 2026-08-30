import React, { useState, useEffect, useCallback, useRef } from 'react'
import { tokenManager } from '@/security/tokenManager'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import { CheckSquare, Calendar, ChevronLeft, ChevronRight, Zap, Users, CheckCircle2, AlertCircle } from 'lucide-react'

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
  residentId: string
  weekStart: string
  day: string
  meal: string
  onSave: (payload: any) => Promise<void>
}

function OrderCell({ order, residentId, weekStart, day, meal, onSave }: OrderCellProps) {
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
        className={`w-full py-1 px-2 rounded-lg text-xs font-bold border transition-colors ${
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
        className="w-full py-0.5 px-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      />
    </div>
  )
}

export default function OrderEntryPage() {
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
      setResidents(rData.residents || rData || [])
      setOrders(oData.orders || oData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [week, token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveCell = async (payload: any) => {
    setSaving(true)
    try {
      await fetch('/api/kitchen/orders', {
        method: 'POST',
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
      await fetch('/api/kitchen/orders/init-week', {
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
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Meal Tally &amp; Selection Entry
            </h1>
            <AppleBadge color="blue" dot>
              {formatWeekLabel(week)}
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pre-service meal selection tally, resident choice recording, and standing diet adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {saving && <span className="text-xs font-mono font-bold text-slate-400">Saving…</span>}
          <AppleButton
            variant="primary"
            size="md"
            icon={<Zap className="w-4 h-4" />}
            onClick={handleInitWeek}
            disabled={initBusy}
          >
            {initBusy ? 'Initializing…' : 'Initialize Week'}
          </AppleButton>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <AppleCard className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navWeek(-1)}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white px-2">
            {formatWeekLabel(week)}
          </span>
          <button
            onClick={() => navWeek(1)}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setViewMode('day')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'day' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
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
              className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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
          <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-850 font-bold uppercase font-mono text-[10px] text-slate-400">
              <tr>
                <th className="p-3.5 w-24">Room</th>
                <th className="p-3.5 w-48">Resident Name</th>
                <th className="p-3.5 w-36">Diet Order</th>
                {viewMode === 'day' ? (
                  <>
                    <th className="p-3.5">Lunch Service</th>
                    <th className="p-3.5">Supper Service</th>
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
              {residents.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-slate-500 dark:text-slate-400">
                    {r.roomNumber || r.room || '101-A'}
                  </td>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                    {r.name}
                  </td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-300">
                    {r.dietType || r.dietOrder || 'Regular'}
                  </td>
                  {viewMode === 'day' ? (
                    <>
                      <td className="p-2">
                        <OrderCell
                          order={orders.find(o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Lunch')}
                          residentId={r.id}
                          weekStart={week}
                          day={activeDay}
                          meal="Lunch"
                          onSave={handleSaveCell}
                        />
                      </td>
                      <td className="p-2">
                        <OrderCell
                          order={orders.find(o => o.resident_id === r.id && o.day_of_week === activeDay && o.meal_type === 'Supper')}
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
                          order={orders.find(o => o.resident_id === r.id && o.day_of_week === d && o.meal_type === 'Lunch')}
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
              ))}
            </tbody>
          </table>
        </div>
      </AppleCard>
    </div>
  )
}
