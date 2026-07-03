import { useState } from 'react'
import type { MenuItem } from '@/types'
import { DIETARY_TAGS, ITEM_MEAL_CATEGORIES } from '@/types/menu'
import type { DietaryTag, ItemMealCategory } from '@/types/menu'
import { useRecipesStore } from '@/state/recipesStore'

type Props = {
  initial?: Partial<MenuItem>
  onSave: (values: Omit<MenuItem, 'id'>) => Promise<void>
  onCancel: () => void
}

const MEAL_CATS = ITEM_MEAL_CATEGORIES.filter(c => c !== 'All') as Exclude<ItemMealCategory, 'All'>[]

const TAG_CSS = `
  .tag-toggle {
    display:inline-flex; align-items:center; padding:5px 12px;
    border-radius:20px; font-size:12px; font-weight:700;
    border:1.5px solid var(--border-color); background:var(--bg-card);
    color:var(--text-secondary); cursor:pointer; transition:all 0.12s ease;
    font-family:'Outfit',sans-serif; user-select:none;
  }
  .tag-toggle.active {
    background:var(--color-primary-light); border-color:var(--color-primary);
    color:var(--color-primary);
  }
  .tag-toggle.active.danger {
    background:var(--color-danger-light); border-color:var(--color-danger-hover);
    color:var(--color-danger-hover);
  }
`

function InjectTagStyles() {
  const id = 'sl-tag-css'
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const el = document.createElement('style')
    el.id = id; el.textContent = TAG_CSS
    document.head.appendChild(el)
  }
  return null
}

export default function MenuItemForm({ initial, onSave, onCancel }: Props) {
  const { recipes } = useRecipesStore()

  const [name,            setName]            = useState(initial?.name ?? '')
  const [notes,           setNotes]           = useState(initial?.notes ?? '')
  const [textureModified, setTextureModified] = useState(initial?.textureModified ?? false)
  const [mealCategory,    setMealCategory]    = useState<Exclude<ItemMealCategory, 'All'> | ''>(initial?.mealCategory && initial.mealCategory !== 'All' ? initial.mealCategory : '')
  const [dietaryTags,     setDietaryTags]     = useState<DietaryTag[]>(initial?.dietaryTags ?? [])
  const [recipeId,        setRecipeId]        = useState(initial?.recipeId ?? '')
  const [saving,          setSaving]          = useState(false)
  const [err,             setErr]             = useState<string | null>(null)

  function toggleTag(tag: DietaryTag) {
    setDietaryTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Name is required.'); return }
    setSaving(true); setErr(null)
    try {
      await onSave({
        name: name.trim(),
        notes: notes.trim() || undefined,
        textureModified,
        mealCategory: mealCategory || undefined,
        dietaryTags: dietaryTags.length ? dietaryTags : undefined,
        recipeId: recipeId || undefined,
      })
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg-app)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: "'Outfit',sans-serif",
  }
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    color: 'var(--text-muted)', marginBottom: 6,
  }
  const sectionStyle = { marginBottom: 16 }

  return (
    <>
      <InjectTagStyles />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Name */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Item Name <span style={{ color: 'var(--color-danger-hover)' }}>*</span></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Scrambled Eggs"
            style={fieldStyle}
          />
        </div>

        {/* Meal category */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Meal Service</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEAL_CATS.map(cat => (
              <button
                key={cat}
                type="button"
                className={`tag-toggle${mealCategory === cat ? ' active' : ''}`}
                onClick={() => setMealCategory(prev => prev === cat ? '' : cat)}
              >{cat}</button>
            ))}
          </div>
        </div>

        {/* Dietary tags */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Dietary Tags</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIETARY_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className={`tag-toggle${dietaryTags.includes(tag) ? ' active danger' : ''}`}
                onClick={() => toggleTag(tag)}
              >{tag}</button>
            ))}
          </div>
        </div>

        {/* Texture modified */}
        <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="tm-check"
            checked={textureModified}
            onChange={e => setTextureModified(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
          <label htmlFor="tm-check" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Texture-modified version available
          </label>
        </div>

        {/* Link to recipe */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Linked Recipe (optional)</label>
          <select
            value={recipeId}
            onChange={e => setRecipeId(e.target.value)}
            style={{ ...fieldStyle }}
          >
            <option value="">None</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Prep notes, portioning…"
            style={{ ...fieldStyle, resize: 'none' }}
          />
        </div>

        {err && <p style={{ color: 'var(--color-danger-hover)', fontSize: 13, marginBottom: 10 }}>{err}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 16px', fontSize: 13, fontWeight: 700,
              background: 'transparent', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 700,
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >{saving ? 'Saving…' : 'Save Item'}</button>
        </div>
      </form>
    </>
  )
}
