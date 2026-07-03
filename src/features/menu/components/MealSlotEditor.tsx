/**
 * Inline editor for one meal slot — design system styled.
 * Autocomplete from item library preserved.
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
  const [label,   setLabel]   = useState(entry.label ?? '')
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = allItems.filter(
    i => !itemIds.includes(i.id) && i.name.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(id: string) {
    setItemIds(prev => [...prev, id])
    setSearch('')
    searchRef.current?.focus()
  }

  function removeItem(id: string) { setItemIds(prev => prev.filter(x => x !== id)) }

  function moveItem(id: string, dir: -1 | 1) {
    setItemIds(prev => {
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
    try { await onSave({ itemIds, label: label.trim() || undefined }); onClose() }
    finally { setSaving(false) }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Free-text label */}
      <div>
        <label style={fieldLabel}>Display label <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(overrides item names)</span></label>
        <input
          style={input}
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Chef's Special"
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
        />
      </div>

      {/* Current items */}
      <div>
        <label style={fieldLabel}>Items in this slot</label>
        {itemIds.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No items yet — search below to add.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {itemIds.map((id, idx) => {
              const item = allItems.find(i => i.id === id)
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  {/* Reorder buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
                    <button onClick={() => moveItem(id, -1)} disabled={idx === 0}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '1px 3px', opacity: idx === 0 ? 0.2 : 1 }}
                      aria-label="Move up">▲</button>
                    <button onClick={() => moveItem(id, 1)} disabled={idx === itemIds.length - 1}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '1px 3px', opacity: idx === itemIds.length - 1 ? 0.2 : 1 }}
                      aria-label="Move down">▼</button>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item?.name ?? <span style={{ color: 'var(--color-danger-hover)', fontStyle: 'italic' }}>Unknown item</span>}
                  </span>
                  {item?.textureModified && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'var(--color-warning-light)', color: 'var(--color-warning-hover)', border: '1px solid rgba(201,146,88,.3)', textTransform: 'uppercase' }}>TM</span>
                  )}
                  {item?.notes && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>{item.notes}</span>
                  )}
                  <button onClick={() => removeItem(id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, marginLeft: 4, padding: 2, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    aria-label="Remove">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Item library autocomplete */}
      <div>
        <label style={fieldLabel}>Add from item library</label>
        <input
          ref={searchRef}
          style={{ ...input, marginBottom: 8 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Type to search items…"
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
        />
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {search ? 'No matching items.' : allItems.length === 0 ? 'Item library is empty — add items via Item Library.' : 'All items already added.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {filtered.map(item => (
              <button key={item.id} onClick={() => addItem(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-app)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary)' }}>+</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{item.name}</span>
                {item.textureModified && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'var(--color-warning-light)', color: 'var(--color-warning-hover)', border: '1px solid rgba(201,146,88,.3)', textTransform: 'uppercase' }}>TM</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: '11px 0', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >Cancel</button>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 2, padding: '11px 0', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'Outfit, sans-serif' }}
        >{saving ? 'Saving…' : 'Save slot'}</button>
      </div>
    </div>
  )
}
