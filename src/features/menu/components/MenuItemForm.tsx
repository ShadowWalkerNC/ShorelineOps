import { useState } from 'react'
import type { MenuItem } from '@/types'

type Props = {
  initial?: Partial<MenuItem>
  onSave: (values: Omit<MenuItem, 'id'>) => Promise<void>
  onCancel: () => void
}

export default function MenuItemForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [textureModified, setTextureModified] = useState(initial?.textureModified ?? false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required.'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({ name: name.trim(), notes: notes.trim() || undefined, textureModified })
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Item name <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Scrambled Eggs"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600
                     rounded-lg text-sm bg-white dark:bg-slate-800
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Allergens, prep notes…"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600
                     rounded-lg text-sm bg-white dark:bg-slate-800
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={textureModified}
          onChange={(e) => setTextureModified(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Texture-modified version available
        </span>
      </label>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600
                     text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm rounded bg-primary text-white hover:bg-primary/90
                     disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Saving…' : 'Save item'}
        </button>
      </div>
    </form>
  )
}
