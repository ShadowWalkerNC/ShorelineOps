import { useEffect, useState, useCallback } from 'react'
import { useMenuStore } from '@/state/menuStore'
import WeekGrid from './components/WeekGrid'
import ItemLibraryPanel from './components/ItemLibraryPanel'
import type { DayOfWeek, MealSlot, MealEntry } from '@/types'

export default function MenuPage() {
  const {
    weeks,
    items,
    selectedWeekId,
    loading,
    error,
    fetchWeeks,
    fetchItems,
    addWeek,
    deleteWeek,
    setActiveWeek,
    selectWeek,
    updateMealEntry,
    addItem,
    updateItem,
    deleteItem,
  } = useMenuStore()

  const [showLibrary, setShowLibrary] = useState(false)
  const [addingWeek, setAddingWeek] = useState(false)
  const [newWeekName, setNewWeekName] = useState('')
  const [weekSaving, setWeekSaving] = useState(false)

  useEffect(() => {
    fetchWeeks()
    fetchItems()
  }, [])

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) ?? null

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddWeek = useCallback(async () => {
    if (!newWeekName.trim()) return
    setWeekSaving(true)
    try {
      await addWeek(newWeekName.trim())
      setNewWeekName('')
      setAddingWeek(false)
    } finally {
      setWeekSaving(false)
    }
  }, [newWeekName, addWeek])

  const handleDeleteWeek = useCallback(async () => {
    if (!selectedWeek) return
    if (!window.confirm(`Delete week "${selectedWeek.name}"? This cannot be undone.`)) return
    await deleteWeek(selectedWeek.id)
  }, [selectedWeek, deleteWeek])

  const handleSetActive = useCallback(async () => {
    if (!selectedWeek) return
    await setActiveWeek(selectedWeek.id)
  }, [selectedWeek, setActiveWeek])

  const handleUpdateSlot = useCallback(
    (day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) =>
      updateMealEntry(selectedWeekId!, day, slot, entry),
    [selectedWeekId, updateMealEntry]
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-xl font-semibold shrink-0">Menu</h1>

        {/* Week tabs */}
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {weeks.map((w) => (
            <button
              key={w.id}
              onClick={() => selectWeek(w.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
                ${
                  w.id === selectedWeekId
                    ? 'bg-primary text-white border-primary'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {w.name}
              {w.active && (
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  ● Live
                </span>
              )}
            </button>
          ))}

          {/* Add week */}
          {addingWeek ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newWeekName}
                onChange={(e) => setNewWeekName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddWeek()
                  if (e.key === 'Escape') { setAddingWeek(false); setNewWeekName('') }
                }}
                placeholder="Week name…"
                className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm
                           bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary w-36"
              />
              <button
                onClick={handleAddWeek}
                disabled={weekSaving || !newWeekName.trim()}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90
                           disabled:opacity-50 transition-colors"
              >
                {weekSaving ? '…' : 'Add'}
              </button>
              <button
                onClick={() => { setAddingWeek(false); setNewWeekName('') }}
                className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingWeek(true)}
              className="px-3 py-1.5 rounded-lg text-sm border-2 border-dashed border-slate-300 dark:border-slate-600
                         text-slate-500 hover:border-primary hover:text-primary transition-colors"
            >
              + New week
            </button>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex gap-2">
          {selectedWeek && !selectedWeek.active && (
            <button
              onClick={handleSetActive}
              className="px-3 py-1.5 text-sm rounded border border-green-400 text-green-600
                         dark:border-green-600 dark:text-green-400
                         hover:bg-green-50 dark:hover:bg-green-950 transition-colors font-medium"
            >
              Set as Live
            </button>
          )}
          {selectedWeek && (
            <button
              onClick={handleDeleteWeek}
              className="px-3 py-1.5 text-sm rounded border border-red-200 dark:border-red-800
                         text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Delete week
            </button>
          )}
          <button
            onClick={() => setShowLibrary(true)}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600
                       text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            📋 Item Library
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchWeeks} className="ml-4 text-red-700 underline text-sm hover:no-underline">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && weeks.length === 0 && (
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && weeks.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium mb-2">No menu weeks yet</p>
          <p className="text-sm">Click "+ New week" to create your first cycle menu.</p>
        </div>
      )}

      {/* Week grid */}
      {selectedWeek && (
        <WeekGrid
          week={selectedWeek}
          items={items}
          onUpdateSlot={handleUpdateSlot}
        />
      )}

      {/* Item library slide-over */}
      {showLibrary && (
        <ItemLibraryPanel
          items={items}
          onAdd={(payload) => { addItem(payload) }}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}
