import { useEffect, useMemo, useState } from 'react'
import { useRecipesStore } from '@/state/recipesStore'
import { RECIPE_CATEGORIES, RECIPE_ALLERGENS } from '@/types/recipe'
import type { Recipe, RecipeCategory, RecipeAllergen, RecipeIngredient, RecipeStep } from '@/types/recipe'

// ── Allergen badge colours ──────────────────────────────────────────────────
const ALLERGEN_COLORS: Record<string, string> = {
  Gluten:  '#d97706',
  Dairy:   '#7c3aed',
  Nuts:    '#b45309',
  Eggs:    '#d97706',
  Soy:     '#059669',
  Seeds:   '#6b7280',
}

function AllergenBadge({ label }: { label: string }) {
  const color = ALLERGEN_COLORS[label] ?? '#6b7280'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
      textTransform: 'uppercase' as const,
      color, border: `1px solid ${color}`,
      borderRadius: 4, padding: '1px 6px',
      background: `${color}14`,
      whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

// ── Serving Scaler Modal ────────────────────────────────────────────────────
function ScalerModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [qty, setQty] = useState(recipe.baseServings)
  const [applied, setApplied] = useState(recipe.baseServings)

  const ratio = applied / (recipe.baseServings || 1)

  function scaleQty(raw: string): string {
    // parse leading number, scale it, reformat
    const match = raw.match(/^([\d./]+)(.*)$/)
    if (!match) return raw
    const num = eval(match[1]) as number // safe: only digits /
    const scaled = num * ratio
    const nice = +scaled.toFixed(2)
    return `${nice}${match[2]}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto',
        padding: '0 0 40px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            {recipe.category}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', textAlign: 'center', marginBottom: 20, letterSpacing: '-0.3px' }}>
            {recipe.name}
          </h2>

          {/* Allergen row */}
          {recipe.allergens.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
            </div>
          )}

          {/* Scale controls */}
          <div style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>Scale Servings</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {[10, 25, 40].map(n => (
                <button key={n} onClick={() => { setQty(n); setApplied(n) }} style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  background: applied === n ? 'var(--color-primary)' : 'var(--bg-card)',
                  color: applied === n ? 'white' : 'var(--text-primary)',
                  fontWeight: 700, fontSize: 14, padding: '6px 18px', cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number" min={1} value={qty}
                onChange={e => setQty(Math.max(1, +e.target.value))}
                style={{
                  width: 90, padding: '7px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 14, fontWeight: 600,
                }}
              />
              <button onClick={() => setApplied(qty)} style={{
                background: 'var(--color-primary)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '7px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>Apply</button>
              <button onClick={() => { setQty(recipe.baseServings); setApplied(recipe.baseServings) }} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}>Reset</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              Yield: <b>{recipe.baseServings} servings</b> → <b style={{ color: 'var(--color-primary)' }}>{applied} servings</b>
            </div>
          </div>

          {/* Ingredients */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 10 }}>Ingredients</div>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0 }}>
              {recipe.ingredients.map((ing, i) => (
                <li key={i} style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
                  <b>{scaleQty(ing.qty)}</b> {ing.item}
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          {recipe.steps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 10 }}>Instructions</div>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                {recipe.steps.map((s, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>{s.instruction}</li>
                ))}
              </ol>
            </div>
          )}

          {recipe.notes && (
            <div style={{ background: 'var(--color-info-light)', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)' }}>Notes: </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{recipe.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty ingredient/step helpers ───────────────────────────────────────────
const blankIngredient = (): RecipeIngredient => ({ qty: '', item: '' })
const blankStep = (): RecipeStep => ({ step: 1, instruction: '' })

// ── Add / Edit Modal ────────────────────────────────────────────────────────
function RecipeFormModal({
  initial, onSave, onClose,
}: {
  initial?: Recipe
  onSave: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [category, setCategory]       = useState<RecipeCategory>(initial?.category ?? 'Other')
  const [allergens, setAllergens]     = useState<RecipeAllergen[]>(initial?.allergens ?? [])
  const [baseServings, setBaseServings] = useState(initial?.baseServings ?? 10)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(initial?.ingredients?.length ? initial.ingredients : [blankIngredient()])
  const [steps, setSteps]             = useState<RecipeStep[]>(initial?.steps?.length ? initial.steps : [blankStep()])
  const [notes, setNotes]             = useState(initial?.notes ?? '')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState('')

  function toggleAllergen(a: RecipeAllergen) {
    setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function updateIngredient(i: number, field: keyof RecipeIngredient, val: string) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }

  function updateStep(i: number, val: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, instruction: val } : s))
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Recipe name is required.'); return }
    if (ingredients.every(i => !i.item.trim())) { setErr('Add at least one ingredient.'); return }
    setSaving(true); setErr('')
    try {
      await onSave({
        name: name.trim(),
        category,
        allergens,
        baseServings,
        ingredients: ingredients.filter(i => i.item.trim()),
        steps: steps.filter(s => s.instruction.trim()).map((s, idx) => ({ ...s, step: idx + 1 })),
        notes: notes.trim(),
      })
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-primary-light)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {initial ? 'Edit Recipe' : '+ New Recipe'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {err && <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 13 }}>{err}</div>}

          {/* Name */}
          <div>
            <label style={labelStyle}>Recipe Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Classic Applesauce Oatmeal Cookies" />
          </div>

          {/* Category + Servings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as RecipeCategory)}>
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Base Yield (servings)</label>
              <input type="number" min={1} style={inputStyle} value={baseServings} onChange={e => setBaseServings(+e.target.value)} />
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label style={labelStyle}>Allergens</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RECIPE_ALLERGENS.map(a => (
                <button key={a} onClick={() => toggleAllergen(a)} style={{
                  border: `1px solid ${allergens.includes(a) ? ALLERGEN_COLORS[a] : 'var(--border-color)'}`,
                  background: allergens.includes(a) ? `${ALLERGEN_COLORS[a]}18` : 'var(--bg-app)',
                  color: allergens.includes(a) ? ALLERGEN_COLORS[a] : 'var(--text-muted)',
                  borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px',
                }}>{a}</button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <label style={labelStyle}>Ingredients</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Qty (e.g. 1 cup)"
                    style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                    value={ing.qty}
                    onChange={e => updateIngredient(i, 'qty', e.target.value)}
                  />
                  <input
                    placeholder="Ingredient"
                    style={{ ...inputStyle, flex: 1 }}
                    value={ing.item}
                    onChange={e => updateIngredient(i, 'item', e.target.value)}
                  />
                  <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 4px' }}>×</button>
                </div>
              ))}
              <button onClick={() => setIngredients(prev => [...prev, blankIngredient()])} style={{
                background: 'var(--bg-app)', border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)', padding: '6px 14px',
                fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>+ Add ingredient</button>
            </div>
          </div>

          {/* Steps */}
          <div>
            <label style={labelStyle}>Instructions (optional)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', padding: '10px 0', minWidth: 18 }}>{i + 1}.</span>
                  <textarea
                    rows={2}
                    placeholder={`Step ${i + 1}`}
                    style={{ ...inputStyle, resize: 'vertical' as const, flex: 1 }}
                    value={s.instruction}
                    onChange={e => updateStep(i, e.target.value)}
                  />
                  <button onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 18, paddingTop: 8 }}>×</button>
                </div>
              ))}
              <button onClick={() => setSteps(prev => [...prev, { step: prev.length + 1, instruction: '' }])} style={{
                background: 'var(--bg-app)', border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)', padding: '6px 14px',
                fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
                cursor: 'pointer', alignSelf: 'flex-start',
              }}>+ Add step</button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Dietary notes, substitutions, etc." />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', padding: '9px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '9px 26px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Recipe')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Purge confirm ───────────────────────────────────────────────────────────
function ConfirmPurge({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onCancel}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, fontFamily: 'Outfit, sans-serif' }}>Purge Recipe?</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          <b>{name}</b> will be permanently deleted and cannot be recovered.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 22px', fontWeight: 700, cursor: 'pointer' }}>Purge</button>
        </div>
      </div>
    </div>
  )
}

// ── Recipe Card ─────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onView, onEdit, onPurge }: {
  recipe: Recipe
  onView: () => void
  onEdit: () => void
  onPurge: () => void
}) {
  const ingPreview = recipe.ingredients.slice(0, 6).map(i => `${i.qty} ${i.item}`).join(' ')

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      cursor: 'pointer',
      transition: 'box-shadow 0.15s ease',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'}
    >
      {/* Top row: name + allergens */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h4
          onClick={onView}
          style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.2px', cursor: 'pointer', flex: 1, margin: 0, lineHeight: 1.3 }}
        >{recipe.name}</h4>
        {recipe.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
            {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
          </div>
        )}
      </div>

      {/* Yield */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Yield: <b style={{ color: 'var(--text-primary)' }}>{recipe.baseServings} Servings</b>
      </div>

      {/* Ingredient preview */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px dashed var(--border-color)', paddingTop: 8 }}>
        <b style={{ color: 'var(--text-secondary)' }}>Ingr: </b>
        {ingPreview}{recipe.ingredients.length > 6 ? '…' : ''}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
        <button onClick={onEdit} style={{ border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', padding: '5px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
        <button onClick={onPurge} style={{ border: 'none', background: 'none', color: 'var(--color-danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '5px 8px' }}>Purge</button>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RecipeBookPage() {
  const { recipes, loading, error, fetch, add, update, remove } = useRecipesStore()
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const [viewRecipe, setViewRecipe]   = useState<Recipe | null>(null)
  const [editRecipe, setEditRecipe]   = useState<Recipe | null | 'new'>('new' as any)
  const [purgeTarget, setPurgeTarget] = useState<Recipe | null>(null)
  // reset editRecipe so it's not open on mount
  useEffect(() => { setEditRecipe(null) }, [])

  useEffect(() => { fetch() }, [])

  const filteredRecipes = useMemo(() => {
    let r = recipes
    if (activeCategory !== 'All') r = r.filter(x => x.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.name.toLowerCase().includes(q) ||
        x.ingredients.some(i => i.item.toLowerCase().includes(q))
      )
    }
    return r.sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, activeCategory, search])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { All: recipes.length }
    RECIPE_CATEGORIES.forEach(c => { map[c] = recipes.filter(r => r.category === c).length })
    return map
  }, [recipes])

  const tabCategories: (RecipeCategory | 'All')[] = ['All', ...RECIPE_CATEGORIES]

  async function handleSave(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) {
    if (editRecipe && editRecipe !== 'new' && typeof editRecipe === 'object') {
      await update(editRecipe.id, data)
    } else {
      await add(data)
    }
  }

  async function handlePurge() {
    if (!purgeTarget) return
    await remove(purgeTarget.id)
    setPurgeTarget(null)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px', marginBottom: 4 }}>Recipe Book</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Browse, scale, and manage kitchen recipes by category.</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, maxWidth: 380,
            padding: '9px 14px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
        <button
          onClick={() => setEditRecipe('new' as any)}
          style={{
            background: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: '9px 22px', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >+ New Recipe</button>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: 24, paddingBottom: 0,
      }}>
        {tabCategories.map(cat => {
          const count = categoryCounts[cat] ?? 0
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2,
                padding: '8px 14px',
                fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
              {count > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                  background: isActive ? 'var(--color-primary)' : 'var(--bg-app)',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '1px 6px',
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading recipes…</p>}
      {error && <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 13 }}>{error}</div>}

      {!loading && filteredRecipes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{search ? 'No recipes match your search.' : 'No recipes in this category yet.'}</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Click <b>+ New Recipe</b> to add one.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {filteredRecipes.map(r => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onView={() => setViewRecipe(r)}
            onEdit={() => setEditRecipe(r)}
            onPurge={() => setPurgeTarget(r)}
          />
        ))}
      </div>

      {/* Modals */}
      {viewRecipe && <ScalerModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
      {editRecipe !== null && (
        <RecipeFormModal
          initial={editRecipe === 'new' as any ? undefined : editRecipe as Recipe}
          onSave={handleSave}
          onClose={() => setEditRecipe(null)}
        />
      )}
      {purgeTarget && (
        <ConfirmPurge
          name={purgeTarget.name}
          onConfirm={handlePurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </div>
  )
}
