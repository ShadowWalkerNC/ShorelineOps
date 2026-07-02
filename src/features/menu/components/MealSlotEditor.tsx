/**
 * Inline editor for one meal slot (e.g. Breakfast on Monday).
 * Shows current items and lets the user add from the library or type a free-text label.
 */
import { useState, useRef } from 'react'
import type { MenuItem, MealEntry } from '@/types'

type Props = {
  entry: MealEntry
  allItems: MenuItem[]
  onSave: (entry: Partial<MealEntry>) => Promise<void>
  onClose: () => void
}

export default function MealSlotEditor({ entry, allItems, onSave, onClose }: Props) {
  const [itemIds, setItemIds] = useState<string[]>(entry.itemIds)
  const [label, setLabel] = useState(entry.label ?? '')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = allItems.filter(
    (i) =>
      !itemIds.includes(i.id) &&
      i.name.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(id: string) {
    setItemIds((prev) => [...prev, id])
    setSearch('')
    searchRef.current?.focus()
  }

  function removeItem(id: string) {
    setItemIds((prev) => prev.filter((x) => x !== id))
  }

  function moveItem(id: string, dir: -1 | 1) {
    setItemIds((prev) => {
      const idx = prev.indexOf(id)
      if (idx === -1) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ itemIds, label: label.trim() || undefined })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Free-text label override */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Display label <span className="font-normal normal-case text-slate-400">(overrides item names)</span>
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Chef's Special"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm
                     bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Current items */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Items in this slot
        </p>
        {itemIds.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No items yet — add from library below.</p>
        ) : (
          <ul className="space-y-1.5">
            {itemIds.map((id, idx) => {
              const item = allItems.find((i) => i.id === id)
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800
                             rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex flex-col gap-0.5 mr-1">
                    <button
                      onClick={() => moveItem(id, -1)}
                      disabled={idx === 0}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-20 leading-none"
                      aria-label="Move up"
                    >▲</button>
                    <button
                      onClick={() => moveItem(id, 1)}
                      disabled={idx === itemIds.length - 1}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-20 leading-none"
                      aria-label="Move down"
                    >▼</button>
                  </div>
                  <span className="flex-1 font-medium">
                    {item?.name ?? <span className="text-red-400 italic">Unknown item</span>}
                  </span>
                  {item?.textureModified && (
                    <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-1.5 py-0.5 rounded">
                      TM
                    </span>
                  )}
                  {item?.notes && (
                    <span className="text-xs text-slate-400 max-w-[120px] truncate" title={item.notes}>
                      {item.notes}
                    </span>
                  )}
                  <button
                    onClick={() => removeItem(id)}
                    className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Item library search */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Add from item library
        </p>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm
                     bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary mb-2"
        />
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {search ? 'No matching items.' : 'All items already added.'}
          </p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => addItem(item.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm
                             hover:bg-primary/10 hover:text-primary transition-colors
                             flex items-center gap-2"
                >
                  <span className="text-primary font-bold">+</span>
                  <span className="flex-1">{item.name}</span>
                  {item.textureModified && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">TM</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600
                     text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm rounded bg-primary text-white hover:bg-primary/90
                     disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Saving…' : 'Save slot'}
        </button>
      </div>
    </div>
  )
}
