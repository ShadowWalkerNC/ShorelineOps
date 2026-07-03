/**
 * 7-column desktop grid — grouped rows: Breakfast / Lunch (Opt1, Opt2, Dessert) / Dinner (Opt1, Opt2, Dessert)
 */
import { useState } from 'react'
import type { MenuWeek, MenuItem, DayOfWeek, MealSlot, MealEntry } from '@/types'
import { DAYS_OF_WEEK, MEAL_GROUPS } from '@/types/menu'
import MealSlotEditor from './MealSlotEditor'

type ActiveCell = { day: DayOfWeek; slot: MealSlot; label: string }
type Props = { week: MenuWeek; items: MenuItem[]; onUpdateSlot: (day: DayOfWeek, slot: MealSlot, entry: Partial<MealEntry>) => Promise<void> }

function entryLabel(entry: MealEntry, items: MenuItem[]): string {
  if (entry.label) return entry.label
  return entry.itemIds.map((id: string) => items.find((i: MenuItem) => i.id === id)?.name).filter(Boolean).join(', ')
}

function SlotCell({ entry, items, isActive, onClick }: { entry: MealEntry; items: MenuItem[]; isActive: boolean; onClick: () => void }) {
  const text = entryLabel(entry, items)
  const empty = !text
  return (
    <button onClick={onClick}
      style={{
        width: '100%', minHeight: 44, textAlign: 'left', padding: '6px 8px',
        borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: empty ? 400 : 600,
        color: empty ? 'var(--text-muted)' : 'var(--text-primary)',
        background: isActive ? 'var(--color-primary-light)' : empty ? 'transparent' : 'var(--bg-app)',
        border: empty ? '1px dashed var(--border-color)' : `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-color)'}`,
        cursor: 'pointer', transition: 'all 0.13s ease', lineHeight: 1.35, display: 'block',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--color-primary)'; e.currentTarget.style.background='var(--color-primary-light)' }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor=empty?'var(--border-color)':'var(--border-color)'; e.currentTarget.style.background=empty?'transparent':'var(--bg-app)' } }}
    >
      {empty ? <span style={{ fontSize: 10, fontStyle: 'italic' }}>+ Add</span>
             : <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</span>}
    </button>
  )
}

const GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  breakfast: { bg: 'var(--color-teal-light)',    border: 'rgba(58,157,168,.25)', text: 'var(--color-teal-hover)' },
  lunch:     { bg: 'var(--color-primary-light)', border: 'rgba(var(--color-primary-rgb),.2)', text: 'var(--color-primary)' },
  dinner:    { bg: 'var(--color-success-light)', border: 'rgba(74,163,104,.25)', text: 'var(--color-success-hover)' },
}

export default function WeekGrid({ week, items, onUpdateSlot }: Props) {
  const [active, setActive] = useState<ActiveCell | null>(null)
  const activeEntry = active ? week.days[active.day]?.[active.slot] ?? { itemIds: [] } : null

  // Build flat row list with group headers
  type RowDef =
    | { kind: 'groupHeader'; groupId: string; label: string }
    | { kind: 'slot'; slot: MealSlot; rowLabel: string; isDessert?: boolean }

  const rows: RowDef[] = []
  for (const group of MEAL_GROUPS) {
    rows.push({ kind: 'groupHeader', groupId: group.id, label: group.label })
    if (group.singleSlot) {
      rows.push({ kind: 'slot', slot: group.singleSlot, rowLabel: 'Breakfast' })
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
    <>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, background: 'var(--bg-card)' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-light)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ width: 140, padding: '10px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Meal</th>
              {DAYS_OF_WEEK.map((day, di) => (
                <th key={day} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Outfit,sans-serif', borderRight: di < DAYS_OF_WEEK.length-1 ? '1px solid var(--border-color)' : 'none' }}>{day.slice(0,3)}</th>
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

              // slot row
              return (
                <tr key={row.slot} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{
                    padding: '6px 14px', whiteSpace: 'nowrap',
                    background: row.isDessert ? 'var(--bg-app)' : 'var(--color-primary-light)',
                    borderRight: '1px solid var(--border-color)',
                    fontSize: row.isDessert ? 11 : 10,
                    fontWeight: 700, color: row.isDessert ? 'var(--color-success-hover)' : 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                    fontStyle: row.isDessert ? 'italic' : 'normal',
                  }}>{row.rowLabel}</td>
                  {DAYS_OF_WEEK.map((day, di) => {
                    const entry = week.days[day]?.[row.slot] ?? { itemIds: [] }
                    const isAct = active?.day === day && active?.slot === row.slot
                    return (
                      <td key={day} style={{ padding: '5px 6px', verticalAlign: 'top', borderRight: di < DAYS_OF_WEEK.length-1 ? '1px solid var(--border-color)' : 'none', background: row.isDessert ? 'var(--bg-app)' : 'transparent' }}>
                        <SlotCell entry={entry} items={items} isActive={isAct}
                          onClick={() => setActive({ day, slot: row.slot, label: `${day} — ${row.rowLabel}` })} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {active && activeEntry && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(13,27,42,0.5)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget) setActive(null) }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-lg)', boxShadow:'0 20px 60px rgba(13,27,42,0.3)', width:'100%', maxWidth:480, maxHeight:'90dvh', overflowY:'auto', padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:14, borderBottom:'1px solid var(--border-color)' }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', fontFamily:'Outfit,sans-serif' }}>{active.label}</span>
              <button onClick={() => setActive(null)} style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)', cursor:'pointer', color:'var(--text-muted)', fontSize:16 }}>✕</button>
            </div>
            <MealSlotEditor entry={activeEntry} allItems={items}
              onSave={async e => { await onUpdateSlot(active.day, active.slot, e); setActive(null) }}
              onClose={() => setActive(null)} />
          </div>
        </div>
      )}
    </>
  )
}
