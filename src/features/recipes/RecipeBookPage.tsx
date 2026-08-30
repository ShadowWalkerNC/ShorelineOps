import { useEffect, useMemo, useRef, useState } from 'react'
import { useRecipesStore } from '@/state/recipesStore'
import { RECIPE_CATEGORIES, RECIPE_ALLERGENS } from '@/types/recipe'
import type { Recipe, RecipeCategory, RecipeAllergen, RecipeIngredient, RecipeStep } from '@/types/recipe'
import { parseQuantity } from '@/lib/parseQuantity'
import { AppleBadge, AppleButton, AppleCard, type AppleBadgeColor } from '@/apple-ui'
import {
  BookOpen,
  Plus,
  Search,
  Scale,
  Edit2,
  Trash2,
  X,
  ChefHat,
  ShieldAlert,
  Layers,
  Sparkles,
  Flame,
  CheckCircle2,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
// ALLERGEN BADGES
// ────────────────────────────────────────────────────────────────────────────
const ALLERGEN_COLORS: Record<string, AppleBadgeColor> = {
  Gluten: 'orange',
  Dairy: 'purple',
  Nuts: 'red',
  Eggs: 'orange',
  Soy: 'green',
  Seeds: 'blue',
}

function AllergenBadge({ label }: { label: string }) {
  const color = (ALLERGEN_COLORS[label] || 'gray') as any
  return (
    <AppleBadge color={color} dot>
      {label}
    </AppleBadge>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// SERVING SCALER SHEET
// ────────────────────────────────────────────────────────────────────────────
const STEP = 10

function ScalerModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const snap = (n: number) => Math.max(STEP, Math.ceil(n / STEP) * STEP)
  const [servings, setServings] = useState(() => snap(recipe.baseServings))

  const ratio = servings / (recipe.baseServings || 1)

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">{recipe.category}</div>
              <h2 className="text-xl font-bold tracking-tight text-white">{recipe.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {recipe.allergens.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 p-3 rounded-2xl bg-rose-950/30 border border-rose-900/40">
            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Contains Allergens:
            </span>
            {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
          </div>
        )}

        {/* Scaler Controller */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-6 flex flex-col items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Dynamic Portion Yield Scaler</div>
          <div className="flex items-center gap-6">
            <button
              onClick={dec}
              disabled={servings <= STEP}
              className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold text-2xl flex items-center justify-center transition-all"
            >
              −
            </button>
            <div className="text-center min-w-[100px]">
              <div className="text-4xl font-black text-blue-400 font-mono">{servings}</div>
              <div className="text-xs text-slate-400 font-semibold uppercase mt-0.5">Portions ({ratio.toFixed(2)}x Yield)</div>
            </div>
            <button
              onClick={inc}
              className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Scaled Ingredients Table */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Scaled Ingredients Bill of Materials</div>
          <div className="divide-y divide-slate-800 rounded-2xl bg-slate-800/30 border border-slate-800 overflow-hidden">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="p-3.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200">{ing.item}</span>
                <span className="font-mono font-bold text-emerald-400">{scaleQty(ing.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Preparation Instructions</div>
            <div className="space-y-2">
              {recipe.steps.map((st, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-800/40 text-xs text-slate-300 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{st.instruction}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-800 pt-5 mt-6 flex justify-end">
          <AppleButton variant="secondary" onClick={onClose}>
            Close Scaler
          </AppleButton>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ADD / EDIT FORM MODAL
// ────────────────────────────────────────────────────────────────────────────
const blankIngredient = (): RecipeIngredient => ({ qty: '', item: '' })
const blankStep = (): RecipeStep => ({ step: 1, instruction: '' })

function RecipeFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Recipe
  onSave: (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<RecipeCategory>(initial?.category ?? 'Other')
  const [allergens, setAllergens] = useState<RecipeAllergen[]>(initial?.allergens ?? [])
  const [baseServings, setBaseServings] = useState(initial?.baseServings ?? 10)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [blankIngredient()]
  )
  const [steps, setSteps] = useState<RecipeStep[]>(
    initial?.steps?.length ? initial.steps : [blankStep()]
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function toggleAllergen(a: RecipeAllergen) {
    setAllergens(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]))
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
    setIngredients(prev => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: val } : ing)))
  }

  function updateStep(i: number, val: string) {
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, instruction: val } : s)))
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <h3 className="text-xl font-bold tracking-tight">{initial ? 'Edit Recipe' : 'New Standardized Recipe'}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {err && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-semibold">
              {err}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Recipe Name *</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Classic Roast Turkey Breast with Pan Gravy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Category</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
                value={category}
                onChange={e => setCategory(e.target.value as RecipeCategory)}
              >
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Base Yield (Servings)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-medium focus:ring-2 focus:ring-blue-500"
                value={baseServings}
                onChange={e => setBaseServings(+e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Allergen Flags</label>
            <div className="flex gap-2 flex-wrap">
              {RECIPE_ALLERGENS.map(a => {
                const active = allergens.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={`py-1.5 px-3 rounded-xl font-bold text-xs transition-all ${
                      active ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Ingredients</label>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Qty (e.g. 5 lbs)"
                    className="w-32 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    value={ing.qty}
                    onChange={e => updateIngredient(i, 'qty', e.target.value)}
                  />
                  <input
                    placeholder="Ingredient Name"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    value={ing.item}
                    onChange={e => updateIngredient(i, 'item', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))}
                    className="w-8 h-8 rounded-lg text-rose-400 hover:bg-rose-950 flex items-center justify-center shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setIngredients(prev => [...prev, blankIngredient()])}
                className="py-2 px-3 text-xs font-bold text-blue-400 border border-dashed border-blue-500/40 rounded-xl hover:bg-blue-500/10 transition-colors"
              >
                + Add Ingredient
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Instructions</label>
            <div className="space-y-2">
              {steps.map((st, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                    {i + 1}
                  </span>
                  <input
                    placeholder={`Step ${i + 1} instruction…`}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    value={st.instruction}
                    onChange={e => updateStep(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}
                    className="w-8 h-8 rounded-lg text-rose-400 hover:bg-rose-950 flex items-center justify-center shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSteps(prev => [...prev, blankStep()])}
                className="py-2 px-3 text-xs font-bold text-blue-400 border border-dashed border-blue-500/40 rounded-xl hover:bg-blue-500/10 transition-colors"
              >
                + Add Step
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-5 mt-6 flex justify-end gap-3">
          <AppleButton variant="secondary" onClick={onClose}>
            Cancel
          </AppleButton>
          <AppleButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Recipe'}
          </AppleButton>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ────────────────────────────────────────────────────────────────────────────
export default function RecipeBookPage() {
  const { recipes, loading, error, fetch, add, update, remove } = useRecipesStore()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | 'All'>('All')
  const [activeAllergen, setActiveAllergen] = useState<RecipeAllergen | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null)
  const [editRecipe, setEditRecipe] = useState<Recipe | null | 'new'>(null)
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
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4 py-2">
      {/* ── Apple Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Standardized Recipe Book
            </h1>
            <AppleBadge color="purple" dot>
              {recipes.length} Master Recipes
            </AppleBadge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Institutional scaled recipes, HACCP preparation guidelines, and automatic allergen explosion.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <AppleButton
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setEditRecipe('new')}
          >
            New Recipe
          </AppleButton>
        </div>
      </div>

      {/* ── Metric Telemetry Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Catalog Master</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{recipes.length} Recipes</div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Main Entrees</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {recipes.filter(r => r.category === 'Proteins').length} Formulations
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">IDDSI Compliant</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">100% Tested</div>
            </div>
          </div>
        </AppleCard>

        <AppleCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">HACCP 165°F Core</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">Enforced</div>
            </div>
          </div>
        </AppleCard>
      </div>

      {/* ── Search & Filter Controls ── */}
      <AppleCard className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search recipes by name, ingredient, or preparation notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabCategories.map(cat => {
            const count = categoryCounts[cat] ?? 0
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </AppleCard>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecipes.map(recipe => (
          <AppleCard key={recipe.id} className="p-5 flex flex-col justify-between hover:border-blue-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    {recipe.category} &middot; {recipe.baseServings} Servings Base
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
                    {recipe.name}
                  </h3>
                </div>
              </div>

              {recipe.allergens.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipe.allergens.map(a => <AllergenBadge key={a} label={a} />)}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {recipe.ingredients.map(i => `${i.qty} ${i.item}`).join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-4">
              <AppleButton
                variant="primary"
                size="sm"
                className="flex-1"
                icon={<Scale className="w-3.5 h-3.5" />}
                onClick={() => setViewRecipe(recipe)}
              >
                View &amp; Scale
              </AppleButton>
              <AppleButton
                variant="secondary"
                size="sm"
                icon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => setEditRecipe(recipe)}
              >
                Edit
              </AppleButton>
              <button
                onClick={() => setPurgeTarget(recipe)}
                className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                title="Delete Recipe"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </AppleCard>
        ))}
      </div>

      {/* Scaler Sheet Modal */}
      {viewRecipe && <ScalerModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}

      {/* Add / Edit Form Modal */}
      {editRecipe !== null && (
        <RecipeFormModal
          initial={editRecipe === 'new' ? undefined : (editRecipe as Recipe)}
          onSave={handleSave}
          onClose={() => setEditRecipe(null)}
        />
      )}

      {/* Confirm Delete */}
      {purgeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Delete Recipe?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong>{purgeTarget.name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <AppleButton variant="secondary" onClick={() => setPurgeTarget(null)}>
                Cancel
              </AppleButton>
              <AppleButton variant="destructive" onClick={handlePurge}>
                Delete
              </AppleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
