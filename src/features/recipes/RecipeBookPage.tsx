import { useEffect, useMemo, useRef, useState } from 'react'
import { useRecipesStore } from '@/state/recipesStore'
import { RECIPE_CATEGORIES, RECIPE_ALLERGENS } from '@/types/recipe'
import type { Recipe, RecipeCategory, RecipeAllergen, RecipeIngredient, RecipeStep } from '@/types/recipe'
import { parseQuantity } from '@/lib/parseQuantity'

// ────────────────────────────────────────────────────────────────────────────
// ALLERGEN COLOURS
// ────────────────────────────────────────────────────────────────────────────
const ALLERGEN_COLORS: Record<string, string> = {
  Gluten: '#d97706',
  Dairy:  '#7c3aed',
  Nuts:   '#b45309',
  Eggs:   '#d97706',
  Soy:    '#059669',
  Seeds:  '#6b7280',
}

function AllergenBadge({ label }: { label: string }) {
  const color = ALLERGEN_COLORS[label] ?? '#6b7280'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
      textTransform: 'uppercase', color,
      border: `1px solid ${color}22`,
      borderRadius: 4, padding: '2px 7px',
      background: `${color}14`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// SERVING SCALER SHEET
// ────────────────────────────────────────────────────────────────────────────
const STEP = 10 // increment / decrement step

function ScalerModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  // Start snapped to nearest multiple of STEP >= baseServings
  const snap = (n: number) => Math.max(STEP, Math.ceil(n / STEP) * STEP)
  const [servings, setServings] = useState(() => snap(recipe.baseServings))

  const ratio = servings / (recipe.baseServings || 1)

  // Generate quick-select buttons: 10, 20, 30 … up to max(120, servings)
  const maxQuick = Math.max(120, Math.ceil(servings / STEP) * STEP)
  const quickOptions: number[] = []
  for (let n = STEP; n <= maxQuick; n += STEP) quickOptions.push(n)

  function scaleQty(raw: string): string {
    const match = raw.match(/^([\d./]+)(.*)$/)
    if (!match) return raw
    const num = parseQuantity(match[1])
    if (num === null) return raw
    const scaled = +(num * ratio).toFixed(2)
    return `${scaled}${match[2]}`
  }

  const dec = () => setServings(s => Math.max(STEP, s - STEP))
  const inc = () => setServings(s => s + STEP)

  return (
    <div className="sl-sheet-backdrop" onClick={onClose}>
      <div className="sl-sheet" onClick={e => e.stopPropagation()}>
        <div className="sl-sheet-handle" />

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <span className="sl-eyebrow">{recipe.category}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-muted)', lineHeight:1 }}>×</button>
        </div>

        <h2 style={{ fontSize:'var(--text-2xl)', fontFamily:'var(--font-display)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', textAlign:'center', margin:'0 0 12px', letterSpacing:'var(--tracking-tight)' }}>
          {recipe.name}
        </h2>

        {recipe.allergens.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', marginBottom:14 }}>
            {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
          </div>
        )}

        {/* ── Scaler ── */}
        <div className="sl-card-sm" style={{ marginBottom:24 }}>
          <div className="sl-eyebrow" style={{ marginBottom:12 }}>Scale Servings</div>

          {/* Stepper row */}
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', marginBottom:14, justifyContent:'center' }}>
            <button onClick={dec} className="btn btn-outline" disabled={servings <= STEP}
              style={{ fontSize:20, fontWeight:700, width:44, height:44, padding:0, borderRadius:'var(--radius-full)' }}>
              −
            </button>
            <div style={{ textAlign:'center', minWidth:80 }}>
              <div style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-black)', fontFamily:'var(--font-display)', color:'var(--color-primary)', lineHeight:1 }}>
                {servings}
              </div>
              <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:2 }}>servings</div>
            </div>
            <button onClick={inc} className="btn btn-outline"
              style={{ fontSize:20, fontWeight:700, width:44, height:44, padding:0, borderRadius:'var(--radius-full)' }}>
              +
            </button>
          </div>

          {/* Quick-select strip — scrollable */}
          <div style={{ display:'flex', gap:'var(--space-2)', overflowX:'auto', paddingBottom:4 }}>
            {quickOptions.map(n => (
              <button key={n}
                onClick={() => setServings(n)}
                className={servings === n ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                style={{ flexShrink:0, minWidth:44 }}
              >{n}</button>
            ))}
          </div>

          <p style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', marginTop:10 }}>
            Base: <b>{recipe.baseServings} servings</b> → Scaled: <b style={{ color:'var(--color-primary)' }}>{servings} servings</b> · <b>{ratio.toFixed(2)}×</b>
          </p>
        </div>

        {/* ── Ingredients ── */}
        <div className="sl-eyebrow" style={{ color:'var(--color-primary)', marginBottom:8 }}>Ingredients</div>
        <ul style={{ listStyle:'disc', paddingLeft:20, margin:'0 0 22px' }}>
          {recipe.ingredients.map((ing, i) => (
            <li key={i} style={{ fontSize:'var(--text-base)', color:'var(--text-primary)', marginBottom:6, lineHeight:'var(--leading-snug)' }}>
              <b>{scaleQty(ing.qty)}</b> {ing.item}
            </li>
          ))}
        </ul>

        {/* ── Steps ── */}
        {recipe.steps.length > 0 && (
          <>
            <div className="sl-eyebrow" style={{ color:'var(--color-primary)', marginBottom:8 }}>Instructions</div>
            <ol style={{ paddingLeft:20, margin:'0 0 20px' }}>
              {recipe.steps.map((s, i) => (
                <li key={i} style={{ fontSize:'var(--text-base)', color:'var(--text-secondary)', marginBottom:8, lineHeight:'var(--leading-normal)' }}>{s.instruction}</li>
              ))}
            </ol>
          </>
        )}

        {/* ── Notes ── */}
        {recipe.notes && (
          <div className="sl-alert sl-alert-info">
            <b>Notes: </b>{recipe.notes}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ADD / EDIT FORM
// ────────────────────────────────────────────────────────────────────────────
const blankIngredient = (): RecipeIngredient => ({ qty: '', item: '' })
const blankStep       = (): RecipeStep       => ({ step: 1, instruction: '' })

function RecipeFormModal({
  initial, onSave, onClose,
}: {
  initial?: Recipe
  onSave: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
}) {
  const [name,         setName]         = useState(initial?.name         ?? '')
  const [category,     setCategory]     = useState<RecipeCategory>(initial?.category ?? 'Other')
  const [allergens,    setAllergens]    = useState<RecipeAllergen[]>(initial?.allergens ?? [])
  const [baseServings, setBaseServings] = useState(initial?.baseServings ?? 10)
  const [ingredients,  setIngredients]  = useState<RecipeIngredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [blankIngredient()]
  )
  const [steps,  setSteps]  = useState<RecipeStep[]>(
    initial?.steps?.length ? initial.steps : [blankStep()]
  )
  const [notes,  setNotes]  = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  function toggleAllergen(a: RecipeAllergen) {
    setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function detectAllergen(itemName: string) {
    const lower = itemName.toLowerCase()
    const detected: RecipeAllergen[] = []
    if (lower.includes('milk') || lower.includes('cheese') || lower.includes('butter') || lower.includes('cream') || lower.includes('dairy')) detected.push('Dairy')
    if (lower.includes('flour') || lower.includes('wheat') || lower.includes('bread') || lower.includes('gluten') || lower.includes('oat')) detected.push('Gluten')
    if (lower.includes('egg')) detected.push('Eggs')
    if (lower.includes('peanut') || lower.includes('walnut') || lower.includes('almond') || lower.includes('nut') || lower.includes('pecan')) detected.push('Nuts')
    if (lower.includes('soy') || lower.includes('tofu') || lower.includes('edamame')) detected.push('Soy')
    if (lower.includes('sesame') || lower.includes('seed') || lower.includes('flax')) detected.push('Seeds')

    if (detected.length > 0) {
      setAllergens(prev => Array.from(new Set([...prev, ...detected])))
    }
  }

  function updateIngredient(i: number, field: keyof RecipeIngredient, val: string) {
    if (field === 'item') {
      detectAllergen(val)
    }
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
        name: name.trim(), category, allergens, baseServings,
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

  return (
    <div className="sl-modal-backdrop" onClick={onClose}>
      <div className="sl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:620 }}>
        <div className="sl-modal-header">
          <h3 className="sl-modal-title">{initial ? 'Edit Recipe' : '+ New Recipe'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-muted)', lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>
          {err && <div className="sl-alert sl-alert-danger">{err}</div>}

          <div>
            <label>Recipe Name *</label>
            <input className="sl-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Classic Applesauce Oatmeal Cookies" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-4)' }}>
            <div>
              <label>Category</label>
              <select className="sl-select" value={category} onChange={e => setCategory(e.target.value as RecipeCategory)}>
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Base Yield (servings)</label>
              <input type="number" min={1} className="sl-input" value={baseServings} onChange={e => setBaseServings(+e.target.value)} />
            </div>
          </div>

          <div>
            <label>Allergens</label>
            <div style={{ display:'flex', gap:'var(--space-2)', flexWrap:'wrap' }}>
              {RECIPE_ALLERGENS.map(a => {
                const active = allergens.includes(a)
                const color  = ALLERGEN_COLORS[a] ?? '#6b7280'
                return (
                  <button key={a} onClick={() => toggleAllergen(a)} style={{
                    border:     `1px solid ${active ? color : 'var(--border-color)'}`,
                    background: active ? `${color}18` : 'var(--bg-app)',
                    color:      active ? color : 'var(--text-muted)',
                    borderRadius: 6, padding:'4px 12px',
                    fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)',
                    cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.4px',
                  }}>{a}</button>
                )
              })}
            </div>
          </div>

          <div>
            <label>Ingredients</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display:'flex', gap:'var(--space-2)' }}>
                  <input placeholder="Qty" className="sl-input" style={{ width:120, flexShrink:0 }}
                    value={ing.qty} onChange={e => updateIngredient(i, 'qty', e.target.value)} />
                  <input placeholder="Ingredient" className="sl-input" style={{ flex:1 }}
                    value={ing.item} onChange={e => updateIngredient(i, 'item', e.target.value)} />
                  <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:18, flexShrink:0, padding:'0 4px' }}>×</button>
                </div>
              ))}
              <button onClick={() => setIngredients(prev => [...prev, blankIngredient()])}
                className="btn btn-outline btn-sm" style={{ alignSelf:'flex-start', borderStyle:'dashed', color:'var(--color-primary)' }}>
                + Add ingredient
              </button>
            </div>
          </div>

          <div>
            <label>Instructions (optional)</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display:'flex', gap:'var(--space-2)', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)', color:'var(--color-primary)', padding:'12px 0', minWidth:18 }}>{i + 1}.</span>
                  <textarea rows={2} placeholder={`Step ${i + 1}`} className="sl-textarea" style={{ flex:1 }}
                    value={s.instruction} onChange={e => updateStep(i, e.target.value)} />
                  <button onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background:'none', border:'none', color:'var(--color-danger)', cursor:'pointer', fontSize:18, paddingTop:10 }}>×</button>
                </div>
              ))}
              <button onClick={() => setSteps(prev => [...prev, { step: prev.length + 1, instruction: '' }])}
                className="btn btn-outline btn-sm" style={{ alignSelf:'flex-start', borderStyle:'dashed', color:'var(--color-primary)' }}>
                + Add step
              </button>
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea rows={3} className="sl-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Dietary notes, substitutions, etc." />
          </div>

          <div style={{ display:'flex', gap:'var(--space-3)', justifyContent:'flex-end', paddingTop:'var(--space-1)' }}>
            <button onClick={onClose}  className="btn btn-outline">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Recipe')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// PURGE CONFIRM
// ────────────────────────────────────────────────────────────────────────────
function ConfirmPurge({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="sl-modal-backdrop" style={{ zIndex:1100 }} onClick={onCancel}>
      <div className="sl-modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize:'var(--text-xl)', fontFamily:'var(--font-display)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)', marginBottom:'var(--space-3)' }}>Purge Recipe?</h3>
        <p style={{ fontSize:'var(--text-base)', color:'var(--text-secondary)', marginBottom:'var(--space-6)', lineHeight:'var(--leading-normal)' }}>
          <b>{name}</b> will be permanently deleted and cannot be recovered.
        </p>
        <div style={{ display:'flex', gap:'var(--space-3)', justifyContent:'flex-end' }}>
          <button onClick={onCancel}  className="btn btn-outline">Cancel</button>
          <button onClick={onConfirm} className="btn btn-danger">Purge</button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// RECIPE CARD
// ────────────────────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onView, onEdit, onPurge }: {
  recipe: Recipe
  onView:  () => void
  onEdit:  () => void
  onPurge: () => void
}) {
  const ingPreview = recipe.ingredients.slice(0, 5).map(i => `${i.qty} ${i.item}`).join(' · ')

  return (
    <div className="recipe-card" style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)', cursor:'default' }}>

      {/* Name row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'var(--space-2)' }}>
        <h4 className="recipe-card-title"
          style={{ textTransform:'uppercase', letterSpacing:'0.3px', margin:0, lineHeight:'var(--leading-snug)' }}>
          {recipe.name}
        </h4>
        {recipe.allergens.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end', flexShrink:0 }}>
            {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="recipe-card-meta">
        {recipe.category} · <b style={{ color:'var(--text-primary)' }}>{recipe.baseServings} servings</b>
      </div>

      {/* Ingredient preview */}
      {ingPreview && (
        <div className="recipe-card-ingr" style={{ borderTop:'1px dashed var(--border-color)', paddingTop:'var(--space-2)' }}>
          {ingPreview}{recipe.ingredients.length > 5 ? '…' : ''}
        </div>
      )}

      {/* Action row: View (primary), Edit (outline), Purge (ghost danger) */}
      <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center', paddingTop:'var(--space-2)', borderTop:'1px solid var(--border-color)', marginTop:'auto' }}>
        {/* VIEW is the primary CTA — full-width on the left */}
        <button onClick={onView} className="btn btn-primary btn-sm" style={{ flex:1 }}>
          📖 View &amp; Scale
        </button>
        <button onClick={onEdit}  className="btn btn-outline btn-sm">Edit</button>
        <button onClick={onPurge} className="btn btn-ghost btn-sm" style={{ color:'var(--color-danger)' }}>Purge</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────────────────
export default function RecipeBookPage() {
  const { recipes, loading, error, fetch, add, update, remove } = useRecipesStore()

  const [search,             setSearch]             = useState('')
  const [activeCategory,     setActiveCategory]     = useState<RecipeCategory | 'All'>('All')
  const [activeAllergen,     setActiveAllergen]     = useState<RecipeAllergen | null>(null)
  const [showAllergenFilter, setShowAllergenFilter] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const [viewRecipe,  setViewRecipe]  = useState<Recipe | null>(null)
  const [editRecipe,  setEditRecipe]  = useState<Recipe | null | 'new'>(null)
  const [purgeTarget, setPurgeTarget] = useState<Recipe | null>(null)

  useEffect(() => { fetch() }, []) // eslint-disable-line

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { All: recipes.length }
    RECIPE_CATEGORIES.forEach(c => { m[c] = recipes.filter(r => r.category === c).length })
    return m
  }, [recipes])

  const filteredRecipes = useMemo(() => {
    let r = recipes
    if (activeCategory !== 'All') r = r.filter(x => x.category === activeCategory)
    if (activeAllergen) r = r.filter(x => x.allergens.includes(activeAllergen))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.name.toLowerCase().includes(q) ||
        x.ingredients.some(i => i.item.toLowerCase().includes(q)) ||
        x.notes?.toLowerCase().includes(q)
      )
    }
    return r.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, activeCategory, activeAllergen, search])

  const hasActiveFilter = !!(search.trim() || activeCategory !== 'All' || activeAllergen)

  function clearAll() {
    setSearch(''); setActiveCategory('All'); setActiveAllergen(null); setShowAllergenFilter(false)
    searchRef.current?.focus()
  }

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

  const tabCategories: (RecipeCategory | 'All')[] = ['All', ...RECIPE_CATEGORIES]

  return (
    <div className="sl-page fade-in">

      {/* PAGE HEADER */}
      <div className="sl-page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'var(--space-4)', flexWrap:'wrap' }}>
        <div>
          <h1 className="sl-page-title">Recipe Book</h1>
          <p className="sl-page-subtitle">Browse, scale, and manage kitchen recipes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditRecipe('new')}>+ New Recipe</button>
      </div>

      {/* SEARCH + FILTER BAR */}
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border-color)',
        borderRadius:'var(--radius-lg)', padding:'var(--space-4)',
        marginBottom:'var(--space-5)', boxShadow:'var(--shadow-sm)',
        display:'flex', flexDirection:'column', gap:'var(--space-3)',
      }}>
        {/* Row 1: search + controls */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'var(--text-muted)', pointerEvents:'none', lineHeight:1 }}>&#x1F50D;</span>
          <input ref={searchRef} type="search"
            placeholder="Search by name, ingredient, or notes…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="sl-input" style={{ paddingLeft:42, flex:1 }} />
          <span style={{ flexShrink:0, fontSize:'var(--text-sm)', color:'var(--text-muted)', fontWeight:'var(--weight-semi)', whiteSpace:'nowrap' }}>
            {filteredRecipes.length} of {recipes.length}
          </span>
          <button
            onClick={() => setShowAllergenFilter(v => !v)}
            className={showAllergenFilter || activeAllergen ? 'btn btn-teal-soft btn-sm' : 'btn btn-outline btn-sm'}
            title="Filter by allergen"
          >
            {activeAllergen ? `⚠️ ${activeAllergen}` : '⚠️ Allergen'}
          </button>
          {hasActiveFilter && (
            <button onClick={clearAll} className="btn btn-ghost btn-sm">✕ Clear</button>
          )}
        </div>

        {/* Row 2: allergen chips */}
        {showAllergenFilter && (
          <div style={{ display:'flex', gap:'var(--space-2)', flexWrap:'wrap' }}>
            {RECIPE_ALLERGENS.map(a => {
              const active = activeAllergen === a
              const color  = ALLERGEN_COLORS[a] ?? '#6b7280'
              return (
                <button key={a} onClick={() => setActiveAllergen(active ? null : a)} style={{
                  border:     `1px solid ${active ? color : 'var(--border-color)'}`,
                  background: active ? `${color}18` : 'var(--bg-app)',
                  color:      active ? color : 'var(--text-muted)',
                  borderRadius:20, padding:'4px 14px',
                  fontSize:'var(--text-sm)', fontWeight:'var(--weight-bold)',
                  cursor:'pointer', transition:'all 0.15s ease',
                }}>{a}</button>
              )
            })}
          </div>
        )}

        {/* Row 3: category pills */}
        <div className="sl-pills" style={{ gap:'var(--space-1)' }}>
          {tabCategories.map(cat => {
            const count    = categoryCounts[cat] ?? 0
            const isActive = activeCategory === cat
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={isActive ? 'sl-pill active' : 'sl-pill'}
                style={{ fontSize:'var(--text-sm)' }}
              >
                {cat}
                {count > 0 && (
                  <span style={{ marginLeft:5, fontSize:10, fontWeight:800, background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--border-color)', color: isActive ? '#fff' : 'var(--text-muted)', borderRadius:10, padding:'1px 6px' }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {error   && <div className="sl-alert sl-alert-danger" style={{ marginBottom:'var(--space-4)' }}>{error}</div>}

      {loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'var(--space-4)' }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="sl-skeleton" style={{ height:160 }} />)}
        </div>
      )}

      {!loading && filteredRecipes.length === 0 && (
        <div className="sl-empty">
          <div style={{ fontSize:40, marginBottom:'var(--space-3)' }}>📖</div>
          <div className="sl-empty-title">{hasActiveFilter ? 'No recipes match your filters.' : 'No recipes yet.'}</div>
          <div className="sl-empty-subtitle">
            {hasActiveFilter
              ? <><button onClick={clearAll} className="btn btn-ghost btn-sm">Clear filters</button> or add a new recipe.</>
              : <>Click <b>+ New Recipe</b> to get started.</> }
          </div>
        </div>
      )}

      {!loading && filteredRecipes.length > 0 && (
        <div className="recipe-grid">
          {filteredRecipes.map(r => (
            <RecipeCard key={r.id} recipe={r}
              onView={() => setViewRecipe(r)}
              onEdit={() => setEditRecipe(r)}
              onPurge={() => setPurgeTarget(r)}
            />
          ))}
        </div>
      )}

      {viewRecipe && <ScalerModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
      {editRecipe !== null && (
        <RecipeFormModal
          initial={editRecipe === 'new' ? undefined : editRecipe as Recipe}
          onSave={handleSave}
          onClose={() => setEditRecipe(null)}
        />
      )}
      {purgeTarget && (
        <ConfirmPurge name={purgeTarget.name} onConfirm={handlePurge} onCancel={() => setPurgeTarget(null)} />
      )}
    </div>
  )
}
