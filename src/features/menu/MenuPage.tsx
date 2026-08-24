import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useMenuStore } from '@/state/menuStore'
import { useRecipesStore } from '@/state/recipesStore'
import WeekGrid from './components/WeekGrid'
import ItemLibraryPanel from './components/ItemLibraryPanel'
import DayEditorModal from './components/DayEditorModal'
import { AppleBadge, AppleButton, AppleCard } from '@/apple-ui'
import type { DayOfWeek, MealSlot, MealEntry, MenuItem } from '@/types'
import { DAYS_OF_WEEK, MEAL_GROUPS, MEAL_SLOTS } from '@/types/menu'
import type { Recipe } from '@/types/recipe'
import {
  Calendar,
  Utensils,
  BookOpen,
  Plus,
  Copy,
  Trash2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
} from 'lucide-react'

// ── Recipe Drawer ─────────────────────────────────────────────────────────────
function RecipeDrawer({
  menuItem,
  recipe,
  onClose,
}: {
  menuItem: MenuItem
  recipe: Recipe | null
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-5 sm:hidden" />

        {/* Item dietary tags */}
        {menuItem.dietaryTags && menuItem.dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {menuItem.dietaryTags.map(t => (
              <AppleBadge key={t} color="red" dot>
                {t}
              </AppleBadge>
            ))}
          </div>
        )}

        {recipe ? (
          <>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                  {recipe.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {recipe.category} &middot; {recipe.baseServings} Base Servings
                </p>
              </div>
              <AppleBadge color="green" dot>
                Recipe Linked
              </AppleBadge>
            </div>

            {recipe.allergens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 my-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Contains Allergens:
                </span>
                {recipe.allergens.map(a => (
                  <span key={a} className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {recipe.ingredients.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">Ingredients</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                      <span className="font-medium text-slate-900 dark:text-white">{ing.item}</span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{ing.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recipe.steps.length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">Prep Instructions</div>
                <div className="space-y-2.5">
                  {recipe.steps.map(s => (
                    <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {s.step}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 leading-relaxed">{s.instruction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recipe.notes && (
              <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">Chef's Notes: </span>{recipe.notes}
              </div>
            )}

            <div className="mt-6">
              <AppleButton variant="secondary" className="w-full" onClick={onClose}>
                Close Recipe View
              </AppleButton>
            </div>
          </>
        ) : (
          <>
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{menuItem.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                No standardized recipe linked to this item yet. Open Item Library to link batch yield and HACCP instructions.
              </p>
            </div>
            <AppleButton variant="secondary" className="w-full" onClick={onClose}>
              Close
            </AppleButton>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function entryLabel(entry: MealEntry, items: MenuItem[]): string {
  if (entry.label) return entry.label
  return entry.itemIds.map(id => items.find(i => i.id === id)?.name).filter(Boolean).join(', ')
}

function entryItems(entry: MealEntry, items: MenuItem[]): MenuItem[] {
  return entry.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean) as MenuItem[]
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const {
    weeks, items, selectedWeekId, loading, error,
    fetchWeeks, fetchItems,
    addWeek, updateWeek, deleteWeek, setActiveWeek, selectWeek,
    updateMealEntry,
    addItem, updateItem, deleteItem,
  } = useMenuStore()

  const { recipes, fetch: fetchRecipes } = useRecipesStore()

  const [showLibrary, setShowLibrary] = useState(false)
  const [addingWeek,  setAddingWeek]  = useState(false)
  const [newWeekName, setNewWeekName] = useState('')
  const [weekSaving,  setWeekSaving]  = useState(false)
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null)
  const [copyName,    setCopyName]    = useState('')
  const [dayIdx,      setDayIdx]      = useState(() => {
    const t = new Date().getDay()
    return Math.min(t === 0 ? 6 : t - 1, DAYS_OF_WEEK.length - 1)
  })
  const [editDay, setEditDay] = useState<DayOfWeek | null>(null)
  const [drawerMenuItem, setDrawerMenuItem] = useState<MenuItem | null>(null)

  useEffect(() => { fetchWeeks(); fetchItems(); fetchRecipes() }, []) // eslint-disable-line

  const selectedWeek = useMemo(() => weeks.find(w => w.id === selectedWeekId) ?? null, [weeks, selectedWeekId])
  const currentDay   = DAYS_OF_WEEK[dayIdx] as DayOfWeek

  const recipeById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes])

  const recipeForItem = useCallback((item: MenuItem): Recipe | null => {
    if (!item.recipeId) return null
    return recipeById.get(item.recipeId) ?? null
  }, [recipeById])

  const handleItemTap = useCallback((menuItemObj: MenuItem) => {
    setDrawerMenuItem(menuItemObj)
  }, [])

  const drawerRecipe = useMemo(
    () => drawerMenuItem ? recipeForItem(drawerMenuItem) : null,
    [drawerMenuItem, recipeForItem]
  )

  const handleAddWeek = useCallback(async () => {
    if (!newWeekName.trim()) return
    setWeekSaving(true)
    try { await addWeek(newWeekName.trim()); setNewWeekName(''); setAddingWeek(false) }
    finally { setWeekSaving(false) }
  }, [newWeekName, addWeek])

  const handleCopyWeek = useCallback(async () => {
    if (!copyingFrom || !copyName.trim()) return
    const src = weeks.find(w => w.id === copyingFrom)
    if (!src) return
    setWeekSaving(true)
    try {
      const nw = await addWeek(copyName.trim())
      await updateWeek(nw.id, { days: JSON.parse(JSON.stringify(src.days)) })
      setCopyName(''); setCopyingFrom(null); setAddingWeek(false)
    } finally { setWeekSaving(false) }
  }, [copyingFrom, copyName, weeks, addWeek, updateWeek])

  const handleDeleteWeek = useCallback(async () => {
    if (!selectedWeek || !window.confirm(`Delete "${selectedWeek.name}"? This cannot be undone.`)) return
    await deleteWeek(selectedWeek.id)
  }, [selectedWeek, deleteWeek])

  const handleSetActive = useCallback(async () => {
    if (selectedWeek) await setActiveWeek(selectedWeek.id)
  }, [selectedWeek, setActiveWeek])

  const handleSaveDay = useCallback(async (
    day: DayOfWeek,
    updates: Partial<Record<MealSlot, Partial<MealEntry>>>
  ) => {
    if (!selectedWeekId) return
    await Promise.all(
      (Object.entries(updates) as [MealSlot, Partial<MealEntry>][]).map(([slot, entry]) =>
        updateMealEntry(selectedWeekId, day, slot, entry.itemIds ?? [])
      )
    )
  }, [selectedWeekId, updateMealEntry])

  const textureModCount = useMemo(() => {
    return items.filter(i => i.textureModified).length
  }, [items])

  function SlotValue({ entry, emptyText }: { entry: MealEntry; emptyText: string }) {
    const slotItems = entryItems(entry, items)
    const label = entryLabel(entry, items)

    if (!label) {
      return <span className="text-slate-400 text-xs italic">{emptyText}</span>
    }

    if (slotItems.length > 0) {
      return (
        <div className="flex flex-wrap gap-1.5 items-center">
          {slotItems.map((mi) => {
            const hasRecipe = !!mi.recipeId
            return (
              <span
                key={mi.id}
                onClick={() => handleItemTap(mi)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                  hasRecipe
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 hover:scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{mi.name}</span>
                {hasRecipe && <ChefHat className="w-3 h-3 text-blue-500 opacity-80" />}
                {mi.dietaryTags && mi.dietaryTags.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 font-mono">
                    {mi.dietaryTags[0]}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )
    }

    return (
      <span
        className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:underline"
        onClick={() => setDrawerMenuItem({ id: '', name: label, textureModified: false })}
      >
        {label}
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">

      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Menu Cycle Planner
            </h1>
            {selectedWeek?.active && (
              <AppleBadge color="green" dot>
                Live Active Cycle
              </AppleBadge>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            4-week institutional cycle menus with standardized recipes, IDDSI dysphagia options, and allergen alerts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <AppleButton
            variant="secondary"
            size="md"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setShowLibrary(true)}
          >
            Item Library ({items.length})
          </AppleButton>
          <AppleButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => { setAddingWeek(v => !v); setCopyingFrom(null) }}
          >
            New Cycle
          </AppleButton>
        </div>
      </div>

      {/* ── Clinical / Operational Telemetry Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Current Cycle</div>
              <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                {selectedWeek ? selectedWeek.name : '—'}
              </div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Recipes Linked</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {recipes.length} Verified
              </div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">IDDSI Pureed Mod</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {textureModCount} Items
              </div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Meal Slots</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                B · L · D · Snack
              </div>
            </div>
          </div>
        </AppleCard>
      </div>

      {/* ── Cycle Selector Pills & Management Bar ── */}
      <AppleCard className="p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-slate-400 uppercase font-mono mr-1 shrink-0">Cycles:</span>
            {weeks.map(w => (
              <button
                key={w.id}
                onClick={() => selectWeek(w.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all shrink-0 flex items-center gap-1.5 ${
                  w.id === selectedWeekId
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{w.name}</span>
                {w.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            ))}
          </div>

          {selectedWeek && (
            <div className="flex items-center gap-2 shrink-0">
              {!selectedWeek.active && (
                <AppleButton size="sm" variant="secondary" onClick={handleSetActive}>
                  Set as Live
                </AppleButton>
              )}
              <AppleButton
                size="sm"
                variant="secondary"
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => { setCopyingFrom(selectedWeek.id); setCopyName('Copy of ' + selectedWeek.name); setAddingWeek(true) }}
              >
                Copy
              </AppleButton>
              <AppleButton
                size="sm"
                variant="destructive"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleDeleteWeek}
              >
                Delete
              </AppleButton>
            </div>
          )}
        </div>

        {addingWeek && (
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 animate-in fade-in">
            <input
              autoFocus
              value={newWeekName}
              onChange={e => setNewWeekName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') copyingFrom ? handleCopyWeek() : handleAddWeek()
                if (e.key === 'Escape') { setAddingWeek(false); setNewWeekName('') }
              }}
              placeholder="Cycle Name (e.g. Fall Week 1)…"
              className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {weeks.length > 0 && (
              <select
                value={copyingFrom ?? ''}
                onChange={e => setCopyingFrom(e.target.value || null)}
                className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
              >
                <option value="">Start with blank days</option>
                {weeks.map(w => <option key={w.id} value={w.id}>Copy from {w.name}</option>)}
              </select>
            )}
            <AppleButton size="sm" variant="primary" onClick={copyingFrom ? handleCopyWeek : handleAddWeek} disabled={weekSaving || !newWeekName.trim()}>
              {weekSaving ? 'Creating…' : 'Create Cycle'}
            </AppleButton>
            <AppleButton size="sm" variant="secondary" onClick={() => { setAddingWeek(false); setNewWeekName(''); setCopyingFrom(null) }}>
              Cancel
            </AppleButton>
          </div>
        )}
      </AppleCard>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchWeeks} className="font-bold underline">Retry</button>
        </div>
      )}

      {/* ══ MOBILE DAY VIEW ══ */}
      {selectedWeek && (
        <div className="block md:hidden space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              onClick={() => setDayIdx(i => Math.max(0, i - 1))}
              disabled={dayIdx === 0}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="font-bold text-base text-slate-900 dark:text-white">{currentDay}</div>
              <div className="text-[11px] text-slate-400">{selectedWeek.name}</div>
            </div>
            <button
              onClick={() => setDayIdx(i => Math.min(DAYS_OF_WEEK.length - 1, i + 1))}
              disabled={dayIdx === DAYS_OF_WEEK.length - 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day dots */}
          <div className="flex justify-center gap-1.5">
            {DAYS_OF_WEEK.map((d, i) => (
              <button
                key={d}
                onClick={() => setDayIdx(i)}
                className={`h-2 rounded-full transition-all ${i === dayIdx ? 'w-6 bg-blue-600' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}
              />
            ))}
          </div>

          {/* Mobile Meal Groups */}
          <div className="space-y-3">
            {MEAL_GROUPS.map(group => (
              <AppleCard key={group.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-tight font-sans">
                    {group.label}
                  </span>
                  <AppleButton size="sm" variant="secondary" onClick={() => setEditDay(currentDay)}>
                    Edit
                  </AppleButton>
                </div>

                {group.singleSlot && (() => {
                  const entry = selectedWeek.days[currentDay]?.[group.singleSlot] ?? { itemIds: [] }
                  return (
                    <div>
                      <SlotValue entry={entry} emptyText="Nothing planned" />
                    </div>
                  )
                })()}

                {group.options?.map(opt => (
                  <div key={opt.label} className="space-y-2 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{opt.label}</div>
                    <div className="space-y-1.5">
                      {opt.slots.map(({ slot, label }) => {
                        const entry = selectedWeek.days[currentDay]?.[slot] ?? { itemIds: [] }
                        return (
                          <div key={slot} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 min-w-[50px] shrink-0 font-mono">{label}:</span>
                            <SlotValue entry={entry} emptyText="—" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {group.dessertSlot && (() => {
                  const entry = selectedWeek.days[currentDay]?.[group.dessertSlot] ?? { itemIds: [] }
                  return (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 min-w-[50px] shrink-0 font-mono">Dessert:</span>
                      <SlotValue entry={entry} emptyText="None planned" />
                    </div>
                  )
                })()}
              </AppleCard>
            ))}
          </div>
        </div>
      )}

      {/* ══ DESKTOP WEEK GRID ══ */}
      {selectedWeek && (
        <div className="hidden md:block">
          <WeekGrid week={selectedWeek} items={items} onEditDay={day => setEditDay(day)} />
        </div>
      )}

      {/* Full-Day Editor Modal */}
      {editDay && selectedWeek && (
        <DayEditorModal
          day={editDay}
          weekName={selectedWeek.name}
          dayMenu={
            Object.fromEntries(
              MEAL_SLOTS.map(slot => [slot, selectedWeek.days[editDay]?.[slot] ?? { itemIds: [] }])
            ) as Record<MealSlot, MealEntry>
          }
          allItems={items}
          onSave={updates => handleSaveDay(editDay, updates)}
          onClose={() => setEditDay(null)}
        />
      )}

      {/* Item Library Modal */}
      {showLibrary && (
        <ItemLibraryPanel
          items={items}
          onAdd={async p => { await addItem(p) }}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Recipe drawer */}
      {drawerMenuItem && (
        <RecipeDrawer
          menuItem={drawerMenuItem}
          recipe={drawerRecipe}
          onClose={() => setDrawerMenuItem(null)}
        />
      )}
    </div>
  )
}
