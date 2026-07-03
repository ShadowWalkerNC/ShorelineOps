import { useEffect, useState } from 'react'
import { useMenuStore } from '../../state/menuStore'
import { useProductionStore } from '../../state/productionStore'
import { MEAL_SLOTS, MEAL_SLOT_LABELS, DAYS_OF_WEEK } from '../../types/menu'
import type { MealSlot, DayOfWeek } from '../../types/menu'
import ProductionSheetView from './components/ProductionSheet'
import TextureBreakdown from './components/TextureBreakdown'
import PrintSheet from './components/PrintSheet'

const DAY_ABBREV: Record<DayOfWeek, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
}

export default function ProductionPage() {
  const { weeks, selectedWeekId, fetchWeeks } = useMenuStore()
  const activeWeek = weeks.find(w => w.active) ?? weeks.find(w => w.id === selectedWeekId) ?? null
  const { activeSheet, loading, loadSheet, signOff } = useProductionStore()

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday')
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>('lunch')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  const [signOffName, setSignOffName] = useState('')
  const [showSignOff, setShowSignOff] = useState(false)

  useEffect(() => { fetchWeeks() }, [])

  useEffect(() => {
    if (activeWeek) loadSheet(activeWeek.id, selectedDay, selectedSlot)
  }, [activeWeek, selectedDay, selectedSlot])

  if (printMode && activeSheet) {
    return <PrintSheet sheet={activeSheet} onClose={() => setPrintMode(false)} />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Sheet</h1>
          {activeWeek && (
            <p className="text-sm text-gray-500 mt-0.5">Active week: <span className="font-medium">{activeWeek.name}</span></p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBreakdown(b => !b)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition"
          >
            {showBreakdown ? 'Hide' : 'Show'} Breakdown
          </button>
          <button
            onClick={() => setShowSignOff(true)}
            disabled={!activeSheet || !!activeSheet.signedOffBy}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition"
          >
            {activeSheet?.signedOffBy ? `✓ Signed off` : 'Sign Off'}
          </button>
          <button
            onClick={() => setPrintMode(true)}
            disabled={!activeSheet}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* No active week warning */}
      {!activeWeek && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          No active menu week found. Activate a week in the Menu module first.
        </div>
      )}

      {/* Day tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {DAYS_OF_WEEK.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
              selectedDay === day
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {DAY_ABBREV[day]}
          </button>
        ))}
      </div>

      {/* Meal slot tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {MEAL_SLOTS.map(slot => (
          <button
            key={slot}
            onClick={() => setSelectedSlot(slot)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
              selectedSlot === slot
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {MEAL_SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {activeSheet && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {([
            { label: 'Total', value: activeSheet.counts.total, color: 'bg-blue-50 text-blue-700' },
            { label: 'Dining Room', value: activeSheet.counts.diningRoom, color: 'bg-green-50 text-green-700' },
            { label: 'Room', value: activeSheet.counts.room, color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Assisted Living', value: activeSheet.counts.assistedLiving, color: 'bg-purple-50 text-purple-700' },
            { label: 'Memory Care', value: activeSheet.counts.memoryCare, color: 'bg-pink-50 text-pink-700' },
            { label: 'Absent', value: activeSheet.counts.absent, color: 'bg-gray-100 text-gray-500' },
          ] as { label: string; value: number; color: string }[]).map(card => (
            <div key={card.label} className={`rounded-lg p-3 ${card.color}`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="text-2xl font-bold mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && activeSheet && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <ProductionSheetView sheet={activeSheet} />
          </div>
          {showBreakdown && (
            <div className="w-72 shrink-0">
              <TextureBreakdown sheet={activeSheet} />
            </div>
          )}
        </div>
      )}

      {/* Sign-off modal */}
      {showSignOff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="text-lg font-semibold mb-4">Sign Off Sheet</h2>
            <label className="block text-sm text-gray-600 mb-1">Your name</label>
            <input
              type="text"
              value={signOffName}
              onChange={e => setSignOffName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              placeholder="e.g. Maria G."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSignOff(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  if (activeSheet && signOffName.trim()) {
                    await signOff(activeSheet.id, signOffName.trim())
                    setShowSignOff(false)
                  }
                }}
                disabled={!signOffName.trim()}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
