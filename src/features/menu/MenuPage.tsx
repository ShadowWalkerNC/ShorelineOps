import { useEffect, useState, useCallback, useMemo } from 'react'
import { useMenuStore } from '@/state/menuStore'
import WeekGrid from './components/WeekGrid'
import ItemLibraryPanel from './components/ItemLibraryPanel'
import MealSlotEditor from './components/MealSlotEditor'
import type { DayOfWeek, MealSlot, MealEntry, MenuItem } from '@/types'
import { DAYS_OF_WEEK, MEAL_GROUPS } from '@/types/menu'

// ── CSS ───────────────────────────────────────────────────────────────────────
const MENU_CSS = `
  .menu-cycle-pills { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
  .menu-cycle-pills::-webkit-scrollbar { display:none; }
  .menu-cycle-pill {
    flex-shrink:0; padding:7px 16px; border-radius:20px; font-size:13px; font-weight:700;
    border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary);
    cursor:pointer; white-space:nowrap; transition:all 0.15s ease; font-family:'Outfit',sans-serif;
  }
  .menu-cycle-pill.active { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }
  .menu-cycle-pill .live-dot {
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:var(--color-success); margin-left:6px; vertical-align:middle;
  }
  .menu-day-nav { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
  .menu-day-arrow {
    width:40px; height:40px; display:flex; align-items:center; justify-content:center;
    background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md);
    cursor:pointer; color:var(--text-secondary); flex-shrink:0; font-size:18px; transition:all 0.15s ease;
  }
  .menu-day-arrow:active { background:var(--color-primary-light); color:var(--color-primary); }
  .menu-day-label { flex:1; text-align:center; font-size:17px; font-weight:800; color:var(--text-primary); font-family:'Outfit',sans-serif; letter-spacing:-0.3px; }
  .menu-day-label span { display:block; font-size:11px; font-weight:500; color:var(--text-muted); margin-top:1px; }

  /* Meal group card */
  .meal-group-card { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden; margin-bottom:14px; }
  .meal-group-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--color-primary-light); border-bottom:1px solid var(--border-color); }
  .meal-group-title { font-size:14px; font-weight:800; color:var(--text-primary); font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.5px; }

  /* Option block inside a meal card */
  .meal-option-block { padding:12px 16px; border-bottom:1px solid var(--border-color); }
  .meal-option-block:last-child { border-bottom:none; }
  .meal-option-label { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:8px; }
  .meal-option-grid { display:flex; flex-direction:column; gap:6px; }
  .meal-slot-row { display:flex; align-items:center; gap:8px; }
  .meal-slot-tag { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-muted); min-width:40px; flex-shrink:0; }
  .meal-slot-value { flex:1; font-size:13px; font-weight:600; color:var(--text-primary); }
  .meal-slot-empty-text { color:var(--text-muted); font-style:italic; font-weight:400; font-size:12px; }
  .meal-slot-edit-inline {
    padding:3px 9px; background:var(--bg-app); border:1px solid var(--border-color);
    border-radius:10px; font-size:10px; font-weight:700; cursor:pointer; color:var(--text-secondary);
    font-family:'Outfit',sans-serif; transition:all 0.15s; flex-shrink:0;
  }
  .meal-slot-edit-inline:active { background:var(--color-primary-light); color:var(--color-primary); }

  /* Dessert row */
  .meal-dessert-block { padding:10px 16px; background:var(--bg-app); border-top:1px dashed var(--border-color); display:flex; align-items:center; gap:8px; }
  .meal-dessert-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); min-width:50px; flex-shrink:0; }
  .meal-dessert-value { flex:1; font-size:13px; font-weight:600; color:var(--text-primary); }

  .menu-mobile { display:block; }
  .menu-desktop { display:none; }
  @media (min-width:768px) { .menu-mobile { display:none; } .menu-desktop { display:block; } }

  .menu-modal-overlay { position:fixed; inset:0; z-index:500; background:rgba(13,27,42,0.5); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; }
  .menu-modal-box { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); box-shadow:0 20px 60px rgba(13,27,42,0.3); width:100%; max-width:480px; max-height:90dvh; overflow-y:auto; padding:20px; }
  .menu-modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border-color); }
  .menu-modal-title { font-size:15px; font-weight:800; color:var(--text-primary); font-family:'Outfit',sans-serif; }
  .menu-modal-close { width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; color:var(--text-muted); font-size:16px; transition:all 0.15s; }
  .menu-modal-close:hover { color:var(--color-danger-hover); border-color:var(--color-danger-hover); }

  .menu-inline-form { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; padding:12px 14px; background:var(--bg-app); border:1px solid var(--border-color); border-radius:var(--radius-lg); }
  .menu-inline-form input { flex:1; min-width:120px; padding:8px 12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); font-size:13px; color:var(--text-primary); outline:none; }
  .menu-inline-form input:focus { border-color:var(--color-primary); }
`

function InjectMenuStyles() {
  useEffect(() => {
    const id = 'sl-menu-css'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id; el.textContent = MENU_CSS
    document.head.appendChild(el)
  }, [])
  return null
}

// ── Helper ───────────────────────────────────────────────────────────────────
function entryLabel(entry: MealEntry, items: MenuItem[]): string {
  if (entry.label) return entry.label
  return entry.itemIds.map((id: string) => items.find((i: MenuItem) => i.id === id)?.name).filter(Boolean).join(', ')
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const {
    weeks, items, selectedWeekId, loading, error,
    fetchWeeks, fetchItems,
    addWeek, updateWeek, deleteWeek, setActiveWeek, selectWeek,
    updateMealEntry, addItem, updateItem, deleteItem,
  } = useMenuStore()

  const [showLibrary, setShowLibrary] = useState(false)
  const [addingWeek,  setAddingWeek]  = useState(false)
  const [newWeekName, setNewWeekName] = useState('')
  const [weekSaving,  setWeekSaving]  = useState(false)
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null)
  const [copyName,    setCopyName]    = useState('')
  const [dayIdx,      setDayIdx]      = useState(() => {
    const t = new Date().getDay(); return Math.min(t === 0 ? 6 : t - 1, DAYS_OF_WEEK.length - 1)
  })
  const [editSlot, setEditSlot] = useState<{ day: DayOfWeek; slot: MealSlot; label: string } | null>(null)

  useEffect(() => { fetchWeeks(); fetchItems() }, []) // eslint-disable-line

  const selectedWeek = useMemo(() => weeks.find(w => w.id === selectedWeekId) ?? null, [weeks, selectedWeekId])
  const currentDay   = DAYS_OF_WEEK[dayIdx] as DayOfWeek

  const handleAddWeek = useCallback(async () => {
    if (!newWeekName.trim()) return
    setWeekSaving(true)
    try { await addWeek(newWeekName.trim()); setNewWeekName(''); setAddingWeek(false) }
    finally { setWeekSaving(false) }
  }, [newWeekName, addWeek])

  const handleCopyWeek = useCallback(async () => {
    if (!copyingFrom || !copyName.trim()) return
    const src = weeks.find(w => w.id === copyingFrom)
    if (!src) return
    setWeekSaving(true)
    try {
      const nw = await addWeek(copyName.trim())
      await updateWeek(nw.id, { days: JSON.parse(JSON.stringify(src.days)) })
      setCopyName(''); setCopyingFrom(null); setAddingWeek(false)
    } finally { setWeekSaving(false) }
  }, [copyingFrom, copyName, weeks, addWeek, updateWeek])

  const handleDeleteWeek  = useCallback(async () => {
    if (!selectedWeek || !window.confirm(`Delete "${selectedWeek.name}"? This cannot be undone.`)) return
    await deleteWeek(selectedWeek.id)
  }, [selectedWeek, deleteWeek])

  const handleSetActive   = useCallback(async () => { if (selectedWeek) await setActiveWeek(selectedWeek.id) }, [selectedWeek, setActiveWeek])

  const handleUpdateSlot  = useCallback(
    (day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) => updateMealEntry(selectedWeekId!, day, slot, entry),
    [selectedWeekId, updateMealEntry]
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <InjectMenuStyles />

      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.4px', margin: 0 }}>Weekly Menu</h1>
        {selectedWeek && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{selectedWeek.active ? '🟢 Live — currently active cycle' : 'Viewing: ' + selectedWeek.name}</p>}
      </div>

      {/* Cycle selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Menu Cycles</div>
        <div className="menu-cycle-pills">
          {weeks.map(w => (
            <button key={w.id} className={`menu-cycle-pill${w.id === selectedWeekId ? ' active' : ''}`} onClick={() => selectWeek(w.id)}>
              {w.name}{w.active && <span className="live-dot" />}
            </button>
          ))}
          <button className="menu-cycle-pill" onClick={() => { setAddingWeek(v => !v); setCopyingFrom(null) }}
            style={{ borderStyle: 'dashed', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>+ New cycle</button>
        </div>
        {addingWeek && (
          <div className="menu-inline-form">
            <input autoFocus value={newWeekName} onChange={e => setNewWeekName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') copyingFrom ? handleCopyWeek() : handleAddWeek(); if (e.key === 'Escape') { setAddingWeek(false); setNewWeekName('') } }}
              placeholder="Cycle name e.g. Cycle 3…" />
            {weeks.length > 0 && (
              <select value={copyingFrom ?? ''} onChange={e => setCopyingFrom(e.target.value || null)}
                style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">Blank week</option>
                {weeks.map(w => <option key={w.id} value={w.id}>Copy from: {w.name}</option>)}
              </select>
            )}
            <button onClick={copyingFrom ? handleCopyWeek : handleAddWeek} disabled={weekSaving || !newWeekName.trim()}
              style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (weekSaving || !newWeekName.trim()) ? 0.5 : 1 }}>
              {weekSaving ? '…' : 'Create'}
            </button>
            <button onClick={() => { setAddingWeek(false); setNewWeekName(''); setCopyingFrom(null) }}
              style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}
      </div>

      {/* Actions row */}
      {selectedWeek && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
          {!selectedWeek.active && <button onClick={handleSetActive} style={{ padding: '8px 14px', background: 'var(--color-success-light)', color: 'var(--color-success-hover)', border: '1px solid rgba(74,163,104,.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🟢 Set as Live</button>}
          <button onClick={() => { setCopyingFrom(selectedWeek.id); setCopyName('Copy of ' + selectedWeek.name); setAddingWeek(true) }}
            style={{ padding: '8px 14px', background: 'var(--color-teal-light)', color: 'var(--color-teal-hover)', border: '1px solid rgba(58,157,168,.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 Copy cycle</button>
          <button onClick={() => setShowLibrary(true)}
            style={{ padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📚 Item Library</button>
          <button onClick={handleDeleteWeek}
            style={{ padding: '8px 14px', background: 'var(--color-danger-light)', color: 'var(--color-danger-hover)', border: '1px solid rgba(188,106,88,.35)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Delete cycle</button>
        </div>
      )}

      {/* Error */}
      {error && <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--color-danger-light)', border: '1px solid rgba(188,106,88,.35)', color: 'var(--color-danger-hover)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><span>{error}</span><button onClick={fetchWeeks} style={{ fontWeight: 700, fontSize: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></div>}

      {/* Loading */}
      {loading && weeks.length === 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[80,55,55].map((h,i) => <div key={i} style={{ height: h, borderRadius: 'var(--radius-lg)', background: 'var(--border-color)', opacity: 0.5 }} />)}</div>}

      {/* Empty */}
      {!loading && weeks.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}><div style={{ fontSize: 44, marginBottom: 12 }}>📅</div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>No menu cycles yet</div><div style={{ fontSize: 13 }}>Click "+ New cycle" above to get started.</div></div>}

      {/* ══ MOBILE ══ */}
      {selectedWeek && (
        <div className="menu-mobile">
          {/* Day nav */}
          <div className="menu-day-nav">
            <button className="menu-day-arrow" onClick={() => setDayIdx(i => Math.max(0,i-1))} disabled={dayIdx===0} style={{ opacity: dayIdx===0 ? 0.3:1 }}>‹</button>
            <div className="menu-day-label">{currentDay}<span>Cycle: {selectedWeek.name}{selectedWeek.active?' 🟢':''}</span></div>
            <button className="menu-day-arrow" onClick={() => setDayIdx(i => Math.min(DAYS_OF_WEEK.length-1,i+1))} disabled={dayIdx===DAYS_OF_WEEK.length-1} style={{ opacity: dayIdx===DAYS_OF_WEEK.length-1 ? 0.3:1 }}>›</button>
          </div>
          {/* Day dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:5, marginBottom:16 }}>
            {DAYS_OF_WEEK.map((d,i) => <button key={d} onClick={() => setDayIdx(i)} style={{ width:i===dayIdx?20:7, height:7, borderRadius:4, background:i===dayIdx?'var(--color-primary)':'var(--border-color)', border:'none', cursor:'pointer', padding:0, transition:'all 0.2s ease' }} />)}
          </div>

          {/* Meal group cards */}
          {MEAL_GROUPS.map(group => (
            <div key={group.id} className="meal-group-card">
              <div className="meal-group-header">
                <span className="meal-group-title">{group.label}</span>
              </div>

              {/* Breakfast — single slot */}
              {group.singleSlot && (() => {
                const entry = selectedWeek.days[currentDay]?.[group.singleSlot] ?? { itemIds: [] }
                const text = entryLabel(entry, items)
                return (
                  <div className="meal-option-block">
                    <div className="meal-slot-row">
                      <span className={`meal-slot-value${!text?' meal-slot-empty-text':''}`}>{text || 'Nothing planned'}</span>
                      <button className="meal-slot-edit-inline" onClick={() => setEditSlot({ day: currentDay, slot: group.singleSlot!, label: `${group.label}` })}>✏️ Edit</button>
                    </div>
                  </div>
                )
              })()}

              {/* Lunch / Dinner — two options */}
              {group.options?.map(opt => (
                <div key={opt.label} className="meal-option-block">
                  <div className="meal-option-label">{opt.label}</div>
                  <div className="meal-option-grid">
                    {opt.slots.map(({ slot, label }) => {
                      const entry = selectedWeek.days[currentDay]?.[slot] ?? { itemIds: [] }
                      const text = entryLabel(entry, items)
                      return (
                        <div key={slot} className="meal-slot-row">
                          <span className="meal-slot-tag">{label}</span>
                          <span className={`meal-slot-value${!text?' meal-slot-empty-text':''}`}>{text || '—'}</span>
                          <button className="meal-slot-edit-inline" onClick={() => setEditSlot({ day: currentDay, slot, label: `${group.label} ${opt.label} — ${label}` })}>✏️</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Dessert */}
              {group.dessertSlot && (() => {
                const entry = selectedWeek.days[currentDay]?.[group.dessertSlot] ?? { itemIds: [] }
                const text = entryLabel(entry, items)
                return (
                  <div className="meal-dessert-block">
                    <span className="meal-dessert-label">🍰 Dessert</span>
                    <span className={`meal-dessert-value${!text?' meal-slot-empty-text':''}`}>{text || 'None planned'}</span>
                    <button className="meal-slot-edit-inline" onClick={() => setEditSlot({ day: currentDay, slot: group.dessertSlot!, label: `${group.label} — Dessert` })}>✏️</button>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {/* ══ DESKTOP ══ */}
      {selectedWeek && <div className="menu-desktop"><WeekGrid week={selectedWeek} items={items} onUpdateSlot={handleUpdateSlot} /></div>}

      {/* Mobile edit modal */}
      {editSlot && selectedWeek && (() => {
        const entry = selectedWeek.days[editSlot.day]?.[editSlot.slot] ?? { itemIds: [] }
        return (
          <div className="menu-modal-overlay" onClick={e => { if (e.target===e.currentTarget) setEditSlot(null) }}>
            <div className="menu-modal-box">
              <div className="menu-modal-header">
                <span className="menu-modal-title">{editSlot.label}</span>
                <button className="menu-modal-close" onClick={() => setEditSlot(null)}>✕</button>
              </div>
              <MealSlotEditor entry={entry} allItems={items}
                onSave={async e => { await handleUpdateSlot(editSlot.day, editSlot.slot, e); setEditSlot(null) }}
                onClose={() => setEditSlot(null)} />
            </div>
          </div>
        )
      })()}

      {showLibrary && <ItemLibraryPanel items={items} onAdd={async p => { await addItem(p) }} onUpdate={updateItem} onDelete={deleteItem} onClose={() => setShowLibrary(false)} />}
    </div>
  )
}
