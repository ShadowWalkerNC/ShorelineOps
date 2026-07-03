/**
 * 7-column desktop grid — Edit button in each day column header opens full-day editor.
 */
import type { MenuWeek, MenuItem, DayOfWeek, MealSlot, MealEntry } from '@/types'
import { DAYS_OF_WEEK, MEAL_GROUPS } from '@/types/menu'

type Props = {
  week: MenuWeek
  items: MenuItem[]
  onEditDay: (day: DayOfWeek) => void
}

function entryLabel(entry: MealEntry, items: MenuItem[]): string {
  if (entry.label) return entry.label
  return entry.itemIds.map(id => items.find(i => i.id === id)?.name).filter(Boolean).join(', ')
}

const GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  breakfast: { bg: 'var(--color-teal-light)',    border: 'rgba(58,157,168,.25)',                    text: 'var(--color-teal-hover)' },
  lunch:     { bg: 'var(--color-primary-light)', border: 'rgba(var(--color-primary-rgb),.2)',       text: 'var(--color-primary)' },
  dinner:    { bg: 'var(--color-success-light)', border: 'rgba(74,163,104,.25)',                    text: 'var(--color-success-hover)' },
}

export default function WeekGrid({ week, items, onEditDay }: Props) {
  // Build flat row list
  type RowDef =
    | { kind: 'groupHeader'; groupId: string; label: string }
    | { kind: 'slot'; slot: MealSlot; rowLabel: string; isDessert?: boolean }

  const rows: RowDef[] = []
  for (const group of MEAL_GROUPS) {
    rows.push({ kind: 'groupHeader', groupId: group.id, label: group.label })
    if (group.singleSlot) {
      rows.push({ kind: 'slot', slot: group.singleSlot, rowLabel: 'Items' })
    }
    if (group.options) {
      for (const opt of group.options) {
        for (const { slot, label } of opt.slots) {
          rows.push({ kind: 'slot', slot, rowLabel: `${opt.label} — ${label}` })
        }
      }
    }
    if (group.dessertSlot) {
      rows.push({ kind: 'slot', slot: group.dessertSlot, rowLabel: '🍰 Dessert', isDessert: true })
    }
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, background: 'var(--bg-card)' }}>
        <thead>
          <tr style={{ background: 'var(--color-primary-light)', borderBottom: '2px solid var(--border-color)' }}>
            <th style={{ width: 140, padding: '10px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Meal</th>
            {DAYS_OF_WEEK.map((day, di) => (
              <th key={day} style={{ padding: '8px 6px', textAlign: 'center', borderRight: di < DAYS_OF_WEEK.length-1 ? '1px solid var(--border-color)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Outfit,sans-serif', marginBottom: 5 }}>{day.slice(0,3)}</div>
                <button
                  onClick={() => onEditDay(day)}
                  style={{ padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--color-primary)'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='var(--color-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='var(--bg-card)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.borderColor='var(--border-color)' }}
                >Edit</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.kind === 'groupHeader') {
              const c = GROUP_COLORS[row.groupId] ?? GROUP_COLORS.breakfast
              return (
                <tr key={`gh-${row.groupId}`}>
                  <td colSpan={DAYS_OF_WEEK.length + 1}
                    style={{ padding: '7px 14px', background: c.bg, borderTop: ri > 0 ? `2px solid ${c.border}` : 'none', borderBottom: `1px solid ${c.border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Outfit,sans-serif' }}>{row.label}</span>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={row.slot} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{
                  padding: '8px 14px', whiteSpace: 'nowrap',
                  background: row.isDessert ? 'var(--bg-app)' : 'var(--color-primary-light)',
                  borderRight: '1px solid var(--border-color)',
                  fontSize: row.isDessert ? 11 : 10,
                  fontWeight: 700, color: row.isDessert ? 'var(--color-success-hover)' : 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.3px',
                  fontStyle: row.isDessert ? 'italic' : 'normal',
                }}>{row.rowLabel}</td>
                {DAYS_OF_WEEK.map((day, di) => {
                  const entry = week.days[day]?.[row.slot] ?? { itemIds: [] }
                  const text = entryLabel(entry, items)
                  return (
                    <td key={day} style={{
                      padding: '8px 10px', verticalAlign: 'middle',
                      borderRight: di < DAYS_OF_WEEK.length-1 ? '1px solid var(--border-color)' : 'none',
                      background: row.isDessert ? 'var(--bg-app)' : 'transparent',
                      fontSize: 12, fontWeight: text ? 600 : 400,
                      color: text ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontStyle: text ? 'normal' : 'italic',
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
