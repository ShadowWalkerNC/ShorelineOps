import { useEffect, useState, useCallback, useMemo } from 'react'
import { useMenuStore } from '@/state/menuStore'
import WeekGrid from './components/WeekGrid'
import ItemLibraryPanel from './components/ItemLibraryPanel'
import MealSlotEditor from './components/MealSlotEditor'
import type { DayOfWeek, MealSlot, MealEntry } from '@/types'
import { DAYS_OF_WEEK, MEAL_SLOTS, MEAL_SLOT_LABELS } from '@/types/menu'

// ── CSS ───────────────────────────────────────────────────────────────────────
const MENU_CSS = `
  /* Cycle pill tabs */
  .menu-cycle-pills {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .menu-cycle-pills::-webkit-scrollbar { display: none; }
  .menu-cycle-pill {
    flex-shrink: 0;
    padding: 7px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    font-family: 'Outfit', sans-serif;
  }
  .menu-cycle-pill.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }
  .menu-cycle-pill .live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--color-success);
    margin-left: 6px;
    vertical-align: middle;
    animation: dot-pulse 2.2s ease-in-out infinite;
  }

  /* Day nav (mobile only) */
  .menu-day-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }
  .menu-day-arrow {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-secondary);
    flex-shrink: 0;
    font-size: 18px;
    transition: all 0.15s ease;
  }
  .menu-day-arrow:active { background: var(--color-primary-light); color: var(--color-primary); }
  .menu-day-label {
    flex: 1;
    text-align: center;
    font-size: 17px;
    font-weight: 800;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    letter-spacing: -0.3px;
  }
  .menu-day-label span {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    margin-top: 1px;
  }

  /* Meal slot card */
  .meal-slot-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    margin-bottom: 12px;
  }
  .meal-slot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--color-primary-light);
    border-bottom: 1px solid var(--border-color);
  }
  .meal-slot-title {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .meal-slot-edit-btn {
    padding: 5px 12px;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    transition: opacity 0.15s;
  }
  .meal-slot-edit-btn:active { opacity: 0.8; }
  .meal-slot-body {
    padding: 14px 16px;
  }
  .meal-slot-empty {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }
  .meal-item-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 3px 4px 3px 0;
  }
  .meal-item-tm {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 8px;
    background: var(--color-warning-light);
    color: var(--color-warning-hover);
    border: 1px solid rgba(201,146,88,.3);
    text-transform: uppercase;
  }

  /* Desktop: hide mobile day nav, show week grid */
  .menu-mobile { display: block; }
  .menu-desktop { display: none; }
  @media (min-width: 768px) {
    .menu-mobile  { display: none; }
    .menu-desktop { display: block; }
  }

  /* Modal overlay */
  .menu-modal-overlay {
    position: fixed; inset: 0;
    z-index: 500;
    background: rgba(13,27,42,0.5);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .menu-modal-box {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 60px rgba(13,27,42,0.3);
    width: 100%;
    max-width: 480px;
    max-height: 90dvh;
    overflow-y: auto;
    padding: 20px;
  }
  .menu-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border-color);
  }
  .menu-modal-title {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
  }
  .menu-modal-close {
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-muted);
    font-size: 16px;
    transition: all 0.15s;
  }
  .menu-modal-close:hover { color: var(--color-danger-hover); border-color: var(--color-danger-hover); }

  /* New week / copy inline form */
  .menu-inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 10px;
    padding: 12px 14px;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
  }
  .menu-inline-form input {
    flex: 1;
    min-width: 120px;
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
  }
  .menu-inline-form input:focus { border-color: var(--color-primary); }
`

function InjectMenuStyles() {
  useEffect(() => {
    const id = 'sl-menu-css'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = MENU_CSS
    document.head.appendChild(el)
  }, [])
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAY_IDX = Object.fromEntries(DAYS_OF_WEEK.map((d, i) => [d, i])) as Record<DayOfWeek, number>

function cellLabel(entry: MealEntry, items: ReturnType<typeof useMenuStore>['items']): string {
  if (entry.label) return entry.label
  return entry.itemIds.map(id => items.find(i => i.id === id)?.name).filter(Boolean).join(', ')
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MenuPage() {
  const {
    weeks, items, selectedWeekId, loading, error,
    fetchWeeks, fetchItems,
    addWeek, deleteWeek, setActiveWeek, selectWeek,
    updateMealEntry, addItem, updateItem, deleteItem,
  } = useMenuStore()

  const [showLibrary,  setShowLibrary]  = useState(false)
  const [addingWeek,   setAddingWeek]   = useState(false)
  const [newWeekName,  setNewWeekName]  = useState('')
  const [weekSaving,   setWeekSaving]   = useState(false)
  const [copyingFrom,  setCopyingFrom]  = useState<string | null>(null)
  const [copyName,     setCopyName]     = useState('')

  // Mobile: which day is currently shown
  const [dayIdx, setDayIdx] = useState(() => {
    const today = new Date().getDay() // 0=Sun
    // Map JS Sunday=0 → our DAYS_OF_WEEK index (Mon=0)
    const mapped = today === 0 ? 6 : today - 1
    return Math.min(mapped, DAYS_OF_WEEK.length - 1)
  })

  // Mobile: which slot modal is open
  const [editSlot, setEditSlot] = useState<{ day: DayOfWeek; slot: MealSlot } | null>(null)

  useEffect(() => { fetchWeeks(); fetchItems() }, []) // eslint-disable-line

  const selectedWeek = useMemo(() => weeks.find(w => w.id === selectedWeekId) ?? null, [weeks, selectedWeekId])
  const currentDay   = DAYS_OF_WEEK[dayIdx] as DayOfWeek

  // ── Week actions ─────────────────────────────────────────────────────────
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
      await addWeek(copyName.trim(), src.days)
      setCopyName(''); setCopyingFrom(null)
    } finally { setWeekSaving(false) }
  }, [copyingFrom, copyName, weeks, addWeek])

  const handleDeleteWeek = useCallback(async () => {
    if (!selectedWeek) return
    if (!window.confirm(`Delete week "${selectedWeek.name}"? This cannot be undone.`)) return
    await deleteWeek(selectedWeek.id)
  }, [selectedWeek, deleteWeek])

  const handleSetActive = useCallback(async () => {
    if (!selectedWeek) return
    await setActiveWeek(selectedWeek.id)
  }, [selectedWeek, setActiveWeek])

  const handleUpdateSlot = useCallback(
    (day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) =>
      updateMealEntry(selectedWeekId!, day, slot, entry),
    [selectedWeekId, updateMealEntry]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <InjectMenuStyles />

      {/* Page title */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.4px', margin: 0 }}>Weekly Menu</h1>
        {selectedWeek && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {selectedWeek.active ? '🟢 Live — currently active cycle' : 'Viewing cycle: ' + selectedWeek.name}
          </p>
        )}
      </div>

      {/* ── Cycle selector ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>Menu Cycles</div>
        <div className="menu-cycle-pills">
          {weeks.map(w => (
            <button key={w.id} className={`menu-cycle-pill${w.id === selectedWeekId ? ' active' : ''}`} onClick={() => selectWeek(w.id)}>
              {w.name}{w.active && <span className="live-dot" />}
            </button>
          ))}
          <button
            className="menu-cycle-pill"
            onClick={() => { setAddingWeek(v => !v); setCopyingFrom(null) }}
            style={{ borderStyle: 'dashed', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
          >+ New cycle</button>
        </div>

        {/* New week inline form */}
        {addingWeek && (
          <div className="menu-inline-form">
            <input
              autoFocus
              value={newWeekName}
              onChange={e => setNewWeekName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddWeek(); if (e.key === 'Escape') { setAddingWeek(false); setNewWeekName('') } }}
              placeholder="Cycle name e.g. Cycle 1…"
            />
            {weeks.length > 0 && (
              <select
                style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                value={copyingFrom ?? ''}
                onChange={e => setCopyingFrom(e.target.value || null)}
              >
                <option value="">Blank week</option>
                {weeks.map(w => <option key={w.id} value={w.id}>Copy from: {w.name}</option>)}
              </select>
            )}
            <button
              onClick={copyingFrom ? handleCopyWeek : handleAddWeek}
              disabled={weekSaving || !newWeekName.trim()}
              style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (weekSaving || !newWeekName.trim()) ? 0.5 : 1 }}
            >{weekSaving ? '…' : 'Create'}</button>
            <button
              onClick={() => { setAddingWeek(false); setNewWeekName(''); setCopyingFrom(null) }}
              style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}
            >Cancel</button>
          </div>
        )}
      </div>

      {/* ── Week actions row ── */}
      {selectedWeek && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
          {!selectedWeek.active && (
            <button onClick={handleSetActive} style={{ padding: '8px 14px', background: 'var(--color-success-light)', color: 'var(--color-success-hover)', border: '1px solid rgba(74,163,104,.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🟢 Set as Live
            </button>
          )}
          <button onClick={() => { setCopyingFrom(selectedWeek.id); setCopyName('Copy of ' + selectedWeek.name); setAddingWeek(true) }}
            style={{ padding: '8px 14px', background: 'var(--color-teal-light)', color: 'var(--color-teal-hover)', border: '1px solid rgba(58,157,168,.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📋 Copy cycle
          </button>
          <button onClick={() => setShowLibrary(true)}
            style={{ padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📚 Item Library
          </button>
          <button onClick={handleDeleteWeek}
            style={{ padding: '8px 14px', background: 'var(--color-danger-light)', color: 'var(--color-danger-hover)', border: '1px solid rgba(188,106,88,.35)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
            Delete cycle
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--color-danger-light)', border: '1px solid rgba(188,106,88,.35)', color: 'var(--color-danger-hover)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={fetchWeeks} style={{ fontWeight: 700, fontSize: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && weeks.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[80, 55, 55].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 'var(--radius-lg)', background: 'var(--border-color)', opacity: 0.5 }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && weeks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>No menu cycles yet</div>
          <div style={{ fontSize: 13 }}>Click "+ New cycle" above to create your first menu.</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MOBILE VIEW — one day at a time
          ══════════════════════════════════════════════════════════════ */}
      {selectedWeek && (
        <div className="menu-mobile">
          {/* Day navigation */}
          <div className="menu-day-nav">
            <button className="menu-day-arrow" onClick={() => setDayIdx(i => Math.max(0, i - 1))} disabled={dayIdx === 0}
              style={{ opacity: dayIdx === 0 ? 0.3 : 1 }}>
              ‹
            </button>
            <div className="menu-day-label">
              {currentDay}
              <span>Cycle: {selectedWeek.name}{selectedWeek.active ? ' 🟢' : ''}</span>
            </div>
            <button className="menu-day-arrow" onClick={() => setDayIdx(i => Math.min(DAYS_OF_WEEK.length - 1, i + 1))} disabled={dayIdx === DAYS_OF_WEEK.length - 1}
              style={{ opacity: dayIdx === DAYS_OF_WEEK.length - 1 ? 0.3 : 1 }}>
              ›
            </button>
          </div>

          {/* Day dots indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={d} onClick={() => setDayIdx(i)} style={{
                width: i === dayIdx ? 20 : 7, height: 7,
                borderRadius: 4,
                background: i === dayIdx ? 'var(--color-primary)' : 'var(--border-color)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.2s ease',
              }} />
            ))}
          </div>

          {/* Meal slot cards */}
          {MEAL_SLOTS.map(slot => {
            const entry = selectedWeek.days[currentDay]?.[slot] ?? { itemIds: [] }
            const label = cellLabel(entry, items)
            const slotItems = entry.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean)
            return (
              <div key={slot} className="meal-slot-card">
                <div className="meal-slot-header">
                  <span className="meal-slot-title">{MEAL_SLOT_LABELS[slot]}</span>
                  <button className="meal-slot-edit-btn" onClick={() => setEditSlot({ day: currentDay, slot })}>✏️ Edit</button>
                </div>
                <div className="meal-slot-body">
                  {!label && slotItems.length === 0 ? (
                    <span className="meal-slot-empty">Nothing planned yet — tap Edit to add items.</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                      {entry.label ? (
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.label}</span>
                      ) : (
                        slotItems.map(item => item && (
                          <span key={item.id} className="meal-item-chip">
                            {item.name}
                            {item.textureModified && <span className="meal-item-tm">TM</span>}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP VIEW — 7-day grid
          ══════════════════════════════════════════════════════════════ */}
      {selectedWeek && (
        <div className="menu-desktop">
          <WeekGrid week={selectedWeek} items={items} onUpdateSlot={handleUpdateSlot} />
        </div>
      )}

      {/* ── Mobile edit modal ── */}
      {editSlot && selectedWeek && (() => {
        const entry = selectedWeek.days[editSlot.day]?.[editSlot.slot] ?? { itemIds: [] }
        return (
          <div className="menu-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditSlot(null) }}>
            <div className="menu-modal-box">
              <div className="menu-modal-header">
                <span className="menu-modal-title">{editSlot.day} — {MEAL_SLOT_LABELS[editSlot.slot]}</span>
                <button className="menu-modal-close" onClick={() => setEditSlot(null)}>✕</button>
              </div>
              <MealSlotEditor
                entry={entry}
                allItems={items}
                onSave={async (e) => { await handleUpdateSlot(editSlot.day, editSlot.slot, e); setEditSlot(null) }}
                onClose={() => setEditSlot(null)}
              />
            </div>
          </div>
        )
      })()}

      {/* Item library panel */}
      {showLibrary && (
        <ItemLibraryPanel
          items={items}
          onAdd={async payload => { await addItem(payload) }}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}
