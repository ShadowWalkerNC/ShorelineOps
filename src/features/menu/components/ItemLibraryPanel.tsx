/**
 * Slide-over / panel listing all MenuItem library entries.
 * Lets staff add, edit, or delete items from the master library.
 */
import { useState } from 'react'
import type { MenuItem } from '@/types'
import MenuItemForm from './MenuItemForm'

type Props = {
  items: MenuItem[]
  onAdd: (payload: Omit<MenuItem, 'id'>) => Promise<void>
  onUpdate: (id: string, payload: Partial<MenuItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export default function ItemLibraryPanel({ items, onAdd, onUpdate, onDelete, onClose }: Props) {
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}" from the item library?`)) return
    await onDelete(item.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">Item Library</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Close"
          >✕</button>
        </div>

        <div className="p-5 flex-1 space-y-4">
          {/* Add form */}
          {adding ? (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">New item</h3>
              <MenuItemForm
                onSave={async (v) => { await onAdd(v); setAdding(false) }}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600
                         text-slate-500 hover:border-primary hover:text-primary text-sm transition-colors"
            >
              + Add new item
            </button>
          )}

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm
                       bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {/* List */}
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No items found.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3"
                >
                  {editingItem?.id === item.id ? (
                    <MenuItemForm
                      initial={item}
                      onSave={async (v) => { await onUpdate(item.id, v); setEditingItem(null) }}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 dark:text-white truncate">
                          {item.name}
                          {item.textureModified && (
                            <span className="ml-2 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-1.5 py-0.5 rounded">
                              TM
                            </span>
                          )}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600
                                     text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800
                                     text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
