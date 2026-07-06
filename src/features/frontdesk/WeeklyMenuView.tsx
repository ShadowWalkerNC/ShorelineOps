/**
 * ============================================================
 * WEEKLY MENU VIEW — Front Desk Read-Only
 * ============================================================
 * Route: /menu/weekly
 * Access: all authenticated staff (RequireAuth only, no role gate)
 *
 * Shows the ACTIVE menu week in a full 7-day grid.
 * A resident panel on the left lets front desk quickly filter
 * residents by name, diet type, texture, or allergy — so they
 * can confirm at a glance what a specific resident may eat.
 *
 * No edit controls are present on this page.
 * ============================================================
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useMenuStore } from '@/state/menuStore'
import { useResidentsStore } from '@/state/residentsStore'
import { DAYS_OF_WEEK, MEAL_GROUPS } from '@/types/menu'
import type { DayOfWeek, MealSlot, MenuItem, MenuWeek, Resident } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemNames(slotIds: string[], items: MenuItem[]): string {
  return slotIds
    .map(id => items.find(i => i.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

/**
 * Returns true if a resident has any dietary flag that conflicts with
 * standard menu items — used to show a warning chip on their card.
 */
function hasFlag(r: Resident): boolean {
  return (
    r.texture !== 'Regular' ||
    r.dietType !== 'Regular' ||
    r.allergies.length > 0
  )
}

// ── Colour palette (matches app CSS vars via inline fallbacks) ────────────────

const MEAL_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  breakfast: { bg: '#f0fdfa', border: '#5eead4', label: '#0d9488' },
  lunch:     { bg: '#eff6ff', border: '#93c5fd', label: '#2563eb' },
  dinner:    { bg: '#f0fdf4', border: '#86efac', label: '#16a34a' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResidentChip({
  r,
  selected,
  onClick,
}: {
  r: Resident
  selected: boolean
  onClick: () => void
}) {
  const flagged = hasFlag(r)
  return (
    <button
      onClick={onClick}
      title={r.allergies.length ? `Allergies: ${r.allergies.join(', ')}` : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 8,
        border: selected ? '1.5px solid #2563eb' : '1px solid var(--border-color, #e2e8f0)',
        background: selected ? '#eff6ff' : 'var(--bg-card, #fff)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        marginBottom: 4,
      }}
    >
      {/* Avatar initial */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: selected ? '#2563eb' : '#e2e8f0',
        color: selected ? '#fff' : '#64748b',
        fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Outfit, sans-serif',
      }}>
        {r.name.charAt(0).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--text-primary, #1e293b)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'Outfit, sans-serif',
        }}>
          {r.name}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted, #94a3b8)',
          fontFamily: 'Outfit, sans-serif',
        }}>
          Rm {r.room} · {r.dietType}{r.texture !== 'Regular' ? ` · ${r.texture}` : ''}
        </div>
      </div>

      {flagged && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px',
          borderRadius: 6, background: '#fef3c7', color: '#d97706',
          border: '1px solid #fcd34d', whiteSpace: 'nowrap',
          fontFamily: 'Outfit, sans-serif',
        }}>
          ⚠ Flags
        </span>
      )}
    </button>
  )
}

/**
 * Resident detail panel — shown below the list when a resident is selected.
 * Surfaces diet, texture, allergies, and special instructions as a quick reference.
 */
function ResidentDetail({ r }: { r: Resident }) {
  return (
    <div style={{
      margin: '8px 0 12px',
      padding: '10px 12px',
      borderRadius: 8,
      background: '#eff6ff',
      border: '1px solid #93c5fd',
      fontSize: 12,
      fontFamily: 'Outfit, sans-serif',
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 6 }}>
        {r.name} — Room {r.room}
      </div>
      <div><strong>Diet:</strong> {r.dietType}</div>
      <div><strong>Texture:</strong> {r.texture}</div>
      <div><strong>Portion:</strong> {r.portionSize}</div>
      {r.allergies.length > 0 && (
        <div style={{ color: '#b45309', fontWeight: 600 }}>
          ⚠ Allergies: {r.allergies.join(', ')}
        </div>
      )}
      {r.beverages.length > 0 && (
        <div><strong>Beverages:</strong> {r.beverages.join(', ')}</div>
      )}
      {r.specialInstructions && (
        <div style={{ marginTop: 4, color: '#475569', fontStyle: 'italic' }}>
          {r.specialInstructions}
        </div>
      )}
    </div>
  )
}

/** 7-day read-only meal grid for the active week. */
function MenuGrid({ week, items }: { week: MenuWeek; items: MenuItem[] }) {
  type RowDef =
    | { kind: 'header'; groupId: string; label: string }
    | { kind: 'slot'; slot: MealSlot; rowLabel: string; isDessert: boolean }

  const rows: RowDef[] = []
  for (const group of MEAL_GROUPS) {
    rows.push({ kind: 'header', groupId: group.id, label: group.label })
    if (group.singleSlot) {
      rows.push({ kind: 'slot', slot: group.singleSlot, rowLabel: 'Items', isDessert: false })
    }
    if (group.options) {
      for (const opt of group.options) {
        for (const { slot, label } of opt.slots) {
          rows.push({ kind: 'slot', slot, rowLabel: `${opt.label} — ${label}`, isDessert: false })
        }
      }
    }
    if (group.dessertSlot) {
      rows.push({ kind: 'slot', slot: group.dessertSlot, rowLabel: '🍰 Dessert', isDessert: true })
    }
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, background: 'var(--bg-card, #fff)', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 130 }} />
          {DAYS_OF_WEEK.map(d => <col key={d} />)}
        </colgroup>
        <thead>
          <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
            <th style={{
              padding: '10px 12px', textAlign: 'left',
              fontSize: 10, fontWeight: 800, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              borderRight: '1px solid #e2e8f0',
              fontFamily: 'Outfit, sans-serif',
            }}>
              Meal
            </th>
            {DAYS_OF_WEEK.map((day, di) => (
              <th key={day} style={{
                padding: '10px 6px', textAlign: 'center',
                fontSize: 11, fontWeight: 800, color: '#1e293b',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                borderRight: di < DAYS_OF_WEEK.length - 1 ? '1px solid #e2e8f0' : 'none',
                fontFamily: 'Outfit, sans-serif',
              }}>
                {day.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.kind === 'header') {
              const c = MEAL_COLORS[row.groupId] ?? MEAL_COLORS.breakfast
              return (
                <tr key={`h-${row.groupId}`}>
                  <td colSpan={DAYS_OF_WEEK.length + 1} style={{
                    padding: '6px 12px',
                    background: c.bg,
                    borderTop: ri > 0 ? `2px solid ${c.border}` : 'none',
                    borderBottom: `1px solid ${c.border}`,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      color: c.label, textTransform: 'uppercase',
                      letterSpacing: '0.5px', fontFamily: 'Outfit, sans-serif',
                    }}>
                      {row.label}
                    </span>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={row.slot} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{
                  padding: '7px 12px',
                  background: row.isDessert ? '#f8fafc' : '#eff6ff',
                  borderRight: '1px solid #e2e8f0',
                  fontSize: 10, fontWeight: 700,
                  color: row.isDessert ? '#16a34a' : '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.3px',
                  fontStyle: row.isDessert ? 'italic' : 'normal',
                  fontFamily: 'Outfit, sans-serif',
                  whiteSpace: 'nowrap',
                }}>
                  {row.rowLabel}
                </td>
                {DAYS_OF_WEEK.map((day, di) => {
                  const entry = week.days[day as DayOfWeek]?.[row.slot] ?? { itemIds: [] }
                  const text = itemNames(entry.itemIds, items)
                  return (
                    <td key={day} style={{
                      padding: '7px 8px',
                      borderRight: di < DAYS_OF_WEEK.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: 12,
                      fontWeight: text ? 500 : 400,
                      color: text ? '#1e293b' : '#cbd5e1',
                      fontStyle: text ? 'normal' : 'italic',
                      fontFamily: 'Outfit, sans-serif',
                      verticalAlign: 'top',
                      lineHeight: 1.4,
                    }}>
                      {text || '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WeeklyMenuView() {
  const weeks    = useMenuStore(s => s.weeks)
  const items    = useMenuStore(s => s.items)
  const fetchWeeks = useMenuStore(s => s.fetchWeeks)
  const fetchItems = useMenuStore(s => s.fetchItems)

  const residents    = useResidentsStore(s => s.residents)
  const fetchResidents = useResidentsStore(s => s.fetch)

  const [search, setSearch]         = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void fetchWeeks()
    void fetchItems()
    void fetchResidents()
  }, [fetchWeeks, fetchItems, fetchResidents])

  // Active week — fall back to most recently created if none flagged active
  const activeWeek: MenuWeek | null = useMemo(() => {
    const active = weeks.find(w => w.active)
    if (active) return active
    if (weeks.length === 0) return null
    return [...weeks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  }, [weeks])

  // Filtered resident list
  const filteredResidents = useMemo(() => {
    const q = search.toLowerCase().trim()
    return residents
      .filter(r => r.status === 'Active')
      .filter(r =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.room.toLowerCase().includes(q) ||
        r.dietType.toLowerCase().includes(q) ||
        r.texture.toLowerCase().includes(q) ||
        r.allergies.some(a => a.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [residents, search])

  const selectedResident = useMemo(
    () => residents.find(r => r.id === selectedId) ?? null,
    [residents, selectedId]
  )

  return (
    <div style={{
      display: 'flex',
      gap: 20,
      alignItems: 'flex-start',
      padding: '24px 20px',
      minHeight: '100%',
      boxSizing: 'border-box',
      fontFamily: 'Outfit, sans-serif',
    }}>

      {/* ── Left: Resident Panel ───────────────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: 12,
        padding: '14px 12px',
        position: 'sticky',
        top: 20,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: 'var(--text-muted, #94a3b8)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
        }}>
          Residents
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Name, room, diet, allergy…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color, #e2e8f0)',
            fontSize: 12,
            background: 'var(--bg-app, #f8fafc)',
            color: 'var(--text-primary, #1e293b)',
            outline: 'none',
            marginBottom: 10,
            boxSizing: 'border-box',
            fontFamily: 'Outfit, sans-serif',
          }}
        />

        {/* Selected resident detail */}
        {selectedResident && <ResidentDetail r={selectedResident} />}

        {/* List */}
        {filteredResidents.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', textAlign: 'center', padding: '20px 0' }}>
            No residents found
          </div>
        ) : (
          filteredResidents.map(r => (
            <ResidentChip
              key={r.id}
              r={r}
              selected={r.id === selectedId}
              onClick={() => setSelectedId(prev => prev === r.id ? null : r.id)}
            />
          ))
        )}
      </aside>

      {/* ── Right: Menu Grid ───────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0 }}>

        {/* Page header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{
            margin: 0,
            fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary, #1e293b)',
            fontFamily: 'Outfit, sans-serif',
          }}>
            Weekly Menu
          </h1>
          {activeWeek && (
            <p style={{
              margin: '4px 0 0',
              fontSize: 13, color: 'var(--text-muted, #94a3b8)',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {activeWeek.name}
              {activeWeek.effectiveFrom
                ? ` · Effective ${new Date(activeWeek.effectiveFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : ''}
            </p>
          )}
        </div>

        {/* Diet callout if a resident is selected */}
        {selectedResident && hasFlag(selectedResident) && (
          <div style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            fontSize: 13,
            color: '#92400e',
            fontFamily: 'Outfit, sans-serif',
          }}>
            <strong>⚠ Diet note for {selectedResident.name}:</strong>
            {' '}Diet: {selectedResident.dietType}
            {selectedResident.texture !== 'Regular' ? `, Texture: ${selectedResident.texture}` : ''}
            {selectedResident.allergies.length > 0 ? `, Allergies: ${selectedResident.allergies.join(', ')}` : ''}
            {selectedResident.specialInstructions ? ` — ${selectedResident.specialInstructions}` : ''}
          </div>
        )}

        {/* Menu grid or empty state */}
        {!activeWeek ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 300, borderRadius: 12,
            background: 'var(--bg-card, #fff)',
            border: '1px dashed var(--border-color, #e2e8f0)',
            flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 32 }}>🍽️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted, #94a3b8)', fontFamily: 'Outfit, sans-serif' }}>
              No menu week has been published yet.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', fontFamily: 'Outfit, sans-serif' }}>
              Ask the dietary manager to publish the active week.
            </div>
          </div>
        ) : (
          <MenuGrid week={activeWeek} items={items} />
        )}
      </main>
    </div>
  )
}
