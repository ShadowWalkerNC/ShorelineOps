/**
 * Full-day editor — edit all slots for one day at once.
 * Groups slots by MEAL_GROUPS, uses same item-picker UX per slot.
 */
import { useState } from 'react'
import type { DayOfWeek, MealSlot, MealEntry, MenuItem } from '@/types'
import { MEAL_GROUPS } from '@/types/menu'

type SlotDraft = Record<MealSlot, { itemIds: string[]; label: string }>

type Props = {
  day: DayOfWeek
  weekName: string
  dayMenu: Record<MealSlot, MealEntry>
  allItems: MenuItem[]
  onSave: (updates: Partial<Record<MealSlot, Partial<MealEntry>>>) => Promise<void>
  onClose: () => void
}

function buildDraft(dayMenu: Record<MealSlot, MealEntry>): SlotDraft {
  return Object.fromEntries(
    Object.entries(dayMenu).map(([slot, entry]) => [
      slot,
      { itemIds: [...entry.itemIds], label: entry.label ?? '' },
    ])
  ) as SlotDraft
}

function SlotPicker({
  slot, draft, allItems, onChange,
}: {
  slot: MealSlot
  draft: SlotDraft
  allItems: MenuItem[]
  onChange: (slot: MealSlot, itemIds: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const current = draft[slot]
  const filtered = allItems.filter(
    i => !current.itemIds.includes(i.id) && i.name.toLowerCase().includes(search.toLowerCase())
  )

  function add(id: string) { onChange(slot, [...current.itemIds, id]); setSearch('') }
  function remove(id: string) { onChange(slot, current.itemIds.filter(x => x !== id)) }

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 9px', borderRadius: 12,
    background: 'var(--color-primary-light)', border: '1px solid rgba(var(--color-primary-rgb),.25)',
    fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Current chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: current.itemIds.length ? 8 : 0 }}>
        {current.itemIds.map(id => {
          const item = allItems.find(i => i.id === id)
          return (
            <span key={id} style={chipStyle}>
              {item?.name ?? <em style={{ color: 'var(--color-danger-hover)' }}>Unknown</em>}
              {item?.textureModified && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 6, background: 'var(--color-warning-light)', color: 'var(--color-warning-hover)' }}>TM</span>}
              <button onClick={() => remove(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger-hover)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >✕</button>
            </span>
          )
        })}
      </div>
      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="+ Add item…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
      />
      {search && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, maxHeight: 140, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 4 }}>
          {filtered.map(item => (
            <button key={item.id} onClick={() => add(item.id)}
              style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>+</span>
              <span style={{ flex: 1 }}>{item.name}</span>
              {item.textureModified && <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 6, background: 'var(--color-warning-light)', color: 'var(--color-warning-hover)' }}>TM</span>}
            </button>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>No matching items.</p>}
    </div>
  )
}

export default function DayEditorModal({ day, weekName, dayMenu, allItems, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<SlotDraft>(() => buildDraft(dayMenu))
  const [saving, setSaving] = useState(false)

  function handleSlotChange(slot: MealSlot, itemIds: string[]) {
    setDraft(prev => ({ ...prev, [slot]: { ...prev[slot], itemIds } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updates: Partial<Record<MealSlot, Partial<MealEntry>>> = {}
      for (const [slot, d] of Object.entries(draft) as [MealSlot, { itemIds: string[]; label: string }][]) {
        updates[slot] = { itemIds: d.itemIds, label: d.label.trim() || undefined }
      }
      await onSave(updates)
      onClose()
    } finally { setSaving(false) }
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--text-muted)', margin: '16px 0 8px',
  }
  const rowLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
    color: 'var(--text-secondary)', marginBottom: 5,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(13,27,42,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(13,27,42,0.3)', width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto', padding: 22 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif' }}>{day}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{weekName}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
        </div>

        {/* Slots grouped */}
        {MEAL_GROUPS.map(group => (
          <div key={group.id}>
            <p style={{ ...sectionLabel, color: group.id === 'breakfast' ? 'var(--color-teal-hover)' : group.id === 'lunch' ? 'var(--color-primary)' : 'var(--color-success-hover)' }}>{group.label}</p>

            {group.singleSlot && (
              <SlotPicker slot={group.singleSlot} draft={draft} allItems={allItems} onChange={handleSlotChange} />
            )}

            {group.options?.map(opt => (
              <div key={opt.label} style={{ marginBottom: 10, padding: 12, background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <p style={{ ...rowLabel, marginBottom: 8 }}>{opt.label}</p>
                {opt.slots.map(({ slot, label }) => (
                  <div key={slot} style={{ marginBottom: 10 }}>
                    <p style={{ ...rowLabel, fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                    <SlotPicker slot={slot} draft={draft} allItems={allItems} onChange={handleSlotChange} />
                  </div>
                ))}
              </div>
            ))}

            {group.dessertSlot && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', marginBottom: 4 }}>
                <p style={{ ...rowLabel, fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>🍰 Dessert</p>
                <SlotPicker slot={group.dessertSlot} draft={draft} allItems={allItems} onChange={handleSlotChange} />
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 16, marginTop: 8, borderTop: '1px solid var(--border-color)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px 0', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '11px 0', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'Outfit,sans-serif' }}>{saving ? 'Saving…' : 'Save day'}</button>
        </div>
      </div>
    </div>
  )
}
