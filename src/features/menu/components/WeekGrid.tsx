/**
 * 7-column grid — desktop only. Styled with design system tokens.
 */
import { useState } from 'react'
import type { MenuWeek, MenuItem, DayOfWeek, MealSlot, MealEntry } from '@/types'
import { DAYS_OF_WEEK, MEAL_SLOTS, MEAL_SLOT_LABELS } from '@/types/menu'
import MealSlotEditor from './MealSlotEditor'

type ActiveCell = { day: DayOfWeek; slot: MealSlot }
type Props = {
  week: MenuWeek
  items: MenuItem[]
  onUpdateSlot: (day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) => Promise<void>
}

function cellLabel(entry: MealEntry, items: MenuItem[]): string {
  if (entry.label) return entry.label
  return entry.itemIds.map(id => items.find(i => i.id === id)?.name).filter(Boolean).join(', ')
}

export default function WeekGrid({ week, items, onUpdateSlot }: Props) {
  const [active, setActive] = useState<ActiveCell | null>(null)
  const activeEntry = active ? week.days[active.day]?.[active.slot] ?? { itemIds: [] } : null

  return (
    <>
      {/* Scrollable grid wrapper */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, background: 'var(--bg-card)' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-light)', borderBottom: '1px solid var(--border-color)' }}>
              {/* Empty corner */}
              <th style={{ width: 110, padding: '10px 14px', borderRight: '1px solid var(--border-color)' }} />
              {DAYS_OF_WEEK.map(day => (
                <th key={day} style={{
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontFamily: 'Outfit, sans-serif',
                  borderRight: '1px solid var(--border-color)',
                }}>{day.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_SLOTS.map((slot, sIdx) => (
              <tr key={slot} style={{ borderBottom: sIdx < MEAL_SLOTS.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                {/* Row label */}
                <td style={{
                  padding: '10px 14px',
                  background: 'var(--color-primary-light)',
                  borderRight: '1px solid var(--border-color)',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  fontFamily: 'Outfit, sans-serif',
                  verticalAlign: 'middle',
                }}>{MEAL_SLOT_LABELS[slot]}</td>

                {DAYS_OF_WEEK.map((day, dIdx) => {
                  const entry  = week.days[day]?.[slot] ?? { itemIds: [] }
                  const text   = cellLabel(entry, items)
                  const isEmpty = !text
                  const isActive = active?.day === day && active?.slot === slot

                  return (
                    <td key={day} style={{
                      padding: '6px',
                      verticalAlign: 'top',
                      borderRight: dIdx < DAYS_OF_WEEK.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}>
                      <button
                        onClick={() => setActive({ day, slot })}
                        style={{
                          width: '100%',
                          minHeight: 56,
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: isEmpty ? 400 : 600,
                          color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)',
                          background: isActive ? 'var(--color-primary-light)' : isEmpty ? 'transparent' : 'var(--bg-app)',
                          border: isEmpty
                            ? '1px dashed var(--border-color)'
                            : `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-color)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          lineHeight: 1.4,
                          display: 'block',
                        }}
                        onMouseEnter={e => {
                          const b = e.currentTarget
                          b.style.borderColor = 'var(--color-primary)'
                          b.style.background = 'var(--color-primary-light)'
                        }}
                        onMouseLeave={e => {
                          const b = e.currentTarget
                          if (!isActive) {
                            b.style.borderColor = isEmpty ? 'var(--border-color)' : 'var(--border-color)'
                            b.style.background = isEmpty ? 'transparent' : 'var(--bg-app)'
                          }
                        }}
                      >
                        {isEmpty
                          ? <span style={{ fontSize: 11, fontStyle: 'italic' }}>+ Add</span>
                          : <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</span>
                        }
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {active && activeEntry && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(13,27,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setActive(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(13,27,42,0.3)', width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{active.day} — {MEAL_SLOT_LABELS[active.slot]}</span>
              <button
                onClick={() => setActive(null)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}
              >✕</button>
            </div>
            <MealSlotEditor
              entry={activeEntry}
              allItems={items}
              onSave={async entry => { await onUpdateSlot(active.day, active.slot, entry); setActive(null) }}
              onClose={() => setActive(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
