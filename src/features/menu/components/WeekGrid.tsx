/**
 * 7-column grid showing every meal slot for a full week.
 * Clicking a cell opens the MealSlotEditor in a modal.
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
  const names = entry.itemIds
    .map((id) => items.find((i) => i.id === id)?.name)
    .filter(Boolean) as string[]
  return names.join(', ') || ''
}

export default function WeekGrid({ week, items, onUpdateSlot }: Props) {
  const [active, setActive] = useState<ActiveCell | null>(null)

  const activeEntry =
    active ? week.days[active.day]?.[active.slot] ?? { itemIds: [] } : null

  return (
    <>
      {/* Scrollable grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-32 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400" />
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day}
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide
                             text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
                >
                  {day.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_SLOTS.map((slot) => (
              <tr
                key={slot}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                {/* Row label */}
                <td className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
                  {MEAL_SLOT_LABELS[slot]}
                </td>

                {DAYS_OF_WEEK.map((day) => {
                  const entry = week.days[day]?.[slot] ?? { itemIds: [] }
                  const text = cellLabel(entry, items)
                  const isEmpty = !text

                  return (
                    <td key={day} className="px-2 py-1.5 align-top">
                      <button
                        onClick={() => setActive({ day, slot })}
                        className={`w-full min-h-[3rem] text-left px-2 py-1.5 rounded-lg text-xs
                          border transition-all
                          ${
                            isEmpty
                              ? 'border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-primary hover:text-primary'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary hover:bg-primary/5'
                          }`}
                      >
                        {isEmpty ? (
                          <span className="text-[11px] italic">+ Add</span>
                        ) : (
                          <span className="line-clamp-3">{text}</span>
                        )}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setActive(null) }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md
                          max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                {active.day} — {MEAL_SLOT_LABELS[active.slot]}
              </h2>
              <button
                onClick={() => setActive(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Close"
              >✕</button>
            </div>
            <MealSlotEditor
              entry={activeEntry}
              allItems={items}
              onSave={(entry) => onUpdateSlot(active.day, active.slot, entry)}
              onClose={() => setActive(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
