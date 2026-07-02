import React, { useState } from 'react'
import { useProductionStore } from '../../../state/productionStore'
import type { ProductionSheet as Sheet, ProductionRow } from '../../../types/production'
import { TEXTURE_LIST, DIET_LIST, LOCATION_LIST } from '../../../types/production'

type ViewMode = 'texture' | 'diet' | 'location'

interface Props {
  sheet: Sheet
}

export default function ProductionSheetView({ sheet }: Props) {
  const { updateRow } = useProductionStore()
  const [viewMode, setViewMode] = useState<ViewMode>('texture')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')

  const columns = viewMode === 'texture' ? TEXTURE_LIST
    : viewMode === 'diet' ? DIET_LIST
    : LOCATION_LIST

  const getCount = (row: ProductionRow, col: string): number => {
    if (viewMode === 'texture') return (row.textureCounts as any)[col] ?? 0
    if (viewMode === 'diet') return (row.dietCounts as any)[col] ?? 0
    return (row.locationCounts as any)[col] ?? 0
  }

  const handleNoteSubmit = (row: ProductionRow) => {
    updateRow(sheet.id, row.menuItemId, { kitchenNote: noteValue })
    setEditingNote(null)
    setNoteValue('')
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* View mode toggle */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <span className="text-xs text-gray-500 font-medium">View by:</span>
        {(['texture', 'diet', 'location'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              viewMode === m ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        {sheet.signedOffBy && (
          <span className="ml-auto text-xs text-green-700 font-medium">
            ✓ Signed off by {sheet.signedOffBy}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold sticky left-0 bg-gray-50 z-10">Item</th>
              {columns.map(col => (
                <th key={col} className="px-3 py-3 font-semibold text-center whitespace-nowrap">{col}</th>
              ))}
              <th className="px-3 py-3 font-semibold text-center">Total</th>
              <th className="px-4 py-3 font-semibold">Kitchen Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="px-4 py-8 text-center text-gray-400 text-sm italic">
                  No items on this meal slot.
                </td>
              </tr>
            )}
            {sheet.rows.map(row => (
              <tr key={row.menuItemId} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  {row.menuItemName}
                  {row.textureModified && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">TM</span>
                  )}
                </td>
                {columns.map(col => (
                  <td key={col} className="px-3 py-3 text-center">
                    <span className={`inline-block min-w-[2rem] text-center ${
                      getCount(row, col) > 0 ? 'font-semibold text-gray-900' : 'text-gray-300'
                    }`}>
                      {getCount(row, col)}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-3 text-center font-bold text-gray-900">{row.total}</td>
                <td className="px-4 py-3">
                  {editingNote === row.menuItemId ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        value={noteValue}
                        onChange={e => setNoteValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleNoteSubmit(row)
                          if (e.key === 'Escape') setEditingNote(null)
                        }}
                        className="flex-1 border rounded px-2 py-1 text-xs"
                        placeholder="Add note…"
                      />
                      <button onClick={() => handleNoteSubmit(row)} className="text-xs text-green-600 font-medium">Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingNote(row.menuItemId)
                        setNoteValue(row.kitchenNote ?? '')
                      }}
                      className="text-xs text-gray-400 hover:text-gray-700 text-left"
                    >
                      {row.kitchenNote || <span className="italic">+ add note</span>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {sheet.rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
                <td className="px-4 py-3 sticky left-0 bg-gray-50">Totals</td>
                {columns.map(col => {
                  const sum = sheet.rows.reduce((acc, r) => acc + getCount(r, col), 0)
                  return (
                    <td key={col} className="px-3 py-3 text-center">
                      {sum > 0 ? sum : <span className="text-gray-300">—</span>}
                    </td>
                  )
                })}
                <td className="px-3 py-3 text-center text-blue-700">
                  {sheet.rows.reduce((acc, r) => acc + r.total, 0)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
