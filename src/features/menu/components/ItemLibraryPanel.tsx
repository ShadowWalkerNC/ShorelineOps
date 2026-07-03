/**
 * Item Library — full-page overlay with meal-category tabs, dietary tag filtering,
 * recipe linking indicator, and inline add/edit form.
 */
import { useState, useMemo } from 'react'
import type { MenuItem } from '@/types'
import { ITEM_MEAL_CATEGORIES, DIETARY_TAGS } from '@/types/menu'
import type { ItemMealCategory, DietaryTag } from '@/types/menu'
import { useRecipesStore } from '@/state/recipesStore'
import MenuItemForm from './MenuItemForm'

type Props = {
  items: MenuItem[]
  onAdd: (payload: Omit<MenuItem, 'id'>) => Promise<void>
  onUpdate: (id: string, payload: Partial<MenuItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const LIBRARY_CSS = `
  .lib-overlay {
    position:fixed; inset:0; z-index:100;
    background:var(--bg-app); display:flex; flex-direction:column;
    font-family:'Outfit',sans-serif;
    animation:libFadeIn 0.18s ease;
  }
  @keyframes libFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }

  /* Header */
  .lib-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; border-bottom:1px solid var(--border-color);
    background:var(--bg-card); flex-shrink:0;
  }
  .lib-title { font-size:18px; font-weight:800; color:var(--text-primary); letter-spacing:-0.3px; }
  .lib-close-btn {
    padding:6px 14px; border-radius:var(--radius-md); font-size:13px; font-weight:700;
    background:transparent; border:1px solid var(--border-color);
    color:var(--text-muted); cursor:pointer; transition:all 0.12s ease;
  }
  .lib-close-btn:active { background:var(--color-danger-light); color:var(--color-danger-hover); border-color:var(--color-danger-hover); }

  /* Tabs */
  .lib-tabs { display:flex; gap:0; overflow-x:auto; scrollbar-width:none; flex-shrink:0; border-bottom:1px solid var(--border-color); background:var(--bg-card); }
  .lib-tabs::-webkit-scrollbar { display:none; }
  .lib-tab {
    flex-shrink:0; padding:12px 18px; font-size:13px; font-weight:700;
    color:var(--text-muted); background:transparent; border:none;
    border-bottom:2px solid transparent; cursor:pointer;
    transition:all 0.15s ease; white-space:nowrap;
  }
  .lib-tab.active { color:var(--color-primary); border-bottom-color:var(--color-primary); }
  .lib-tab-count {
    display:inline-block; margin-left:5px; padding:1px 7px;
    border-radius:10px; font-size:11px; font-weight:800;
    background:var(--border-color); color:var(--text-muted);
  }
  .lib-tab.active .lib-tab-count { background:var(--color-primary-light); color:var(--color-primary); }

  /* Body */
  .lib-body { flex:1; overflow-y:auto; padding:16px 20px; }

  /* Filter bar */
  .lib-filter-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
  .lib-search {
    flex:1; min-width:140px; padding:9px 12px;
    background:var(--bg-card); border:1px solid var(--border-color);
    border-radius:var(--radius-md); font-size:13px; color:var(--text-primary);
    outline:none; font-family:'Outfit',sans-serif;
  }
  .lib-search:focus { border-color:var(--color-primary); }
  .lib-diet-filter {
    padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700;
    border:1.5px solid var(--border-color); background:var(--bg-card);
    color:var(--text-secondary); cursor:pointer; white-space:nowrap;
    transition:all 0.12s ease; font-family:'Outfit',sans-serif;
  }
  .lib-diet-filter.active { background:var(--color-danger-light); border-color:var(--color-danger-hover); color:var(--color-danger-hover); }

  /* Item card */
  .lib-item-card {
    background:var(--bg-card); border:1px solid var(--border-color);
    border-radius:var(--radius-lg); padding:14px 16px; margin-bottom:10px;
  }
  .lib-item-name { font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
  .lib-item-meta { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; align-items:center; }
  .lib-badge {
    display:inline-block; padding:3px 9px; border-radius:12px;
    font-size:11px; font-weight:700; letter-spacing:0.2px;
  }
  .lib-badge-meal { background:var(--color-primary-light); color:var(--color-primary); }
  .lib-badge-diet { background:var(--color-danger-light); color:var(--color-danger-hover); }
  .lib-badge-tm   { background:var(--color-teal-light); color:var(--color-teal-hover); }
  .lib-badge-recipe { background:var(--color-success-light); color:var(--color-success-hover); }
  .lib-item-notes { font-size:12px; color:var(--text-muted); margin-top:4px; line-height:1.4; }
  .lib-item-actions { display:flex; gap:6px; margin-top:10px; }
  .lib-btn-edit {
    padding:5px 14px; font-size:12px; font-weight:700;
    background:var(--bg-app); border:1px solid var(--border-color);
    border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer;
    transition:all 0.12s ease;
  }
  .lib-btn-edit:active { background:var(--color-primary-light); color:var(--color-primary); }
  .lib-btn-delete {
    padding:5px 14px; font-size:12px; font-weight:700;
    background:transparent; border:1px solid rgba(188,106,88,.35);
    border-radius:var(--radius-md); color:var(--color-danger-hover); cursor:pointer;
    transition:all 0.12s ease;
  }
  .lib-btn-delete:active { background:var(--color-danger-light); }

  /* Add button */
  .lib-add-btn {
    width:100%; padding:12px; margin-bottom:14px;
    border:2px dashed var(--border-color); border-radius:var(--radius-lg);
    background:transparent; font-size:14px; font-weight:700;
    color:var(--color-primary); cursor:pointer; font-family:'Outfit',sans-serif;
    transition:all 0.12s ease;
  }
  .lib-add-btn:active { background:var(--color-primary-light); }

  /* Form wrap */
  .lib-form-wrap {
    background:var(--bg-card); border:1px solid var(--border-color);
    border-radius:var(--radius-lg); padding:18px 16px; margin-bottom:14px;
  }
  .lib-form-heading { font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:14px; text-transform:uppercase; letter-spacing:0.4px; }

  /* Empty */
  .lib-empty { text-align:center; padding:48px 0; color:var(--text-muted); font-size:14px; }
`

function InjectLibraryStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('sl-lib-css')) {
    const el = document.createElement('style')
    el.id = 'sl-lib-css'; el.textContent = LIBRARY_CSS
    document.head.appendChild(el)
  }
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ItemLibraryPanel({ items, onAdd, onUpdate, onDelete, onClose }: Props) {
  const { recipes } = useRecipesStore()

  const [tab,         setTab]         = useState<ItemMealCategory>('All')
  const [search,      setSearch]      = useState('')
  const [dietFilter,  setDietFilter]  = useState<DietaryTag[]>([])
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [adding,      setAdding]      = useState(false)

  function toggleDietFilter(tag: DietaryTag) {
    setDietFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<ItemMealCategory, number> = { All: items.length, Breakfast: 0, Lunch: 0, Dinner: 0, Dessert: 0 }
    for (const item of items) {
      if (item.mealCategory && item.mealCategory !== 'All') counts[item.mealCategory]++
    }
    return counts
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchesTab   = tab === 'All' || item.mealCategory === tab
      const matchSearch  = item.name.toLowerCase().includes(search.toLowerCase())
      const matchesDiet  = dietFilter.length === 0 || dietFilter.every(t => item.dietaryTags?.includes(t))
      return matchesTab && matchSearch && matchesDiet
    })
  }, [items, tab, search, dietFilter])

  async function handleDelete(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}" from the library?`)) return
    await onDelete(item.id)
  }

  function recipeNameFor(recipeId?: string) {
    if (!recipeId) return null
    return recipes.find(r => r.id === recipeId)?.name ?? null
  }

  return (
    <div className="lib-overlay">
      <InjectLibraryStyles />

      {/* Header */}
      <div className="lib-header">
        <span className="lib-title">Item Library</span>
        <button className="lib-close-btn" onClick={onClose}>Back to Menu</button>
      </div>

      {/* Meal-category tabs */}
      <div className="lib-tabs">
        {ITEM_MEAL_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`lib-tab${tab === cat ? ' active' : ''}`}
            onClick={() => setTab(cat)}
          >
            {cat}
            <span className="lib-tab-count">{tabCounts[cat]}</span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="lib-body">

        {/* Filter bar */}
        <div className="lib-filter-bar">
          <input
            className="lib-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
          />
          {DIETARY_TAGS.map(tag => (
            <button
              key={tag}
              className={`lib-diet-filter${dietFilter.includes(tag) ? ' active' : ''}`}
              onClick={() => toggleDietFilter(tag)}
            >{tag}</button>
          ))}
        </div>

        {/* Add form / button */}
        {adding ? (
          <div className="lib-form-wrap">
            <div className="lib-form-heading">New Item</div>
            <MenuItemForm
              onSave={async v => { await onAdd(v); setAdding(false) }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button className="lib-add-btn" onClick={() => { setAdding(true); setEditingItem(null) }}>
            + Add New Item
          </button>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="lib-empty">
            {items.length === 0
              ? 'No items in the library yet. Add one above.'
              : 'No items match the current filters.'}
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="lib-item-card">

              {editingItem?.id === item.id ? (
                <>
                  <div className="lib-form-heading">Edit Item</div>
                  <MenuItemForm
                    initial={item}
                    onSave={async v => { await onUpdate(item.id, v); setEditingItem(null) }}
                    onCancel={() => setEditingItem(null)}
                  />
                </>
              ) : (
                <>
                  <div className="lib-item-name">{item.name}</div>

                  {/* Badge row */}
                  <div className="lib-item-meta">
                    {item.mealCategory && item.mealCategory !== 'All' && (
                      <span className="lib-badge lib-badge-meal">{item.mealCategory}</span>
                    )}
                    {item.textureModified && (
                      <span className="lib-badge lib-badge-tm">Texture Modified</span>
                    )}
                    {(() => { const rn = recipeNameFor(item.recipeId); return rn ? <span className="lib-badge lib-badge-recipe">Recipe: {rn}</span> : null })()}
                    {item.dietaryTags?.map(tag => (
                      <span key={tag} className="lib-badge lib-badge-diet">{tag}</span>
                    ))}
                  </div>

                  {item.notes && <div className="lib-item-notes">{item.notes}</div>}

                  <div className="lib-item-actions">
                    <button className="lib-btn-edit" onClick={() => { setEditingItem(item); setAdding(false) }}>Edit</button>
                    <button className="lib-btn-delete" onClick={() => handleDelete(item)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
