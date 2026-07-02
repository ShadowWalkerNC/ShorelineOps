import React, { useEffect } from 'react'
import type { ProductionSheet } from '../../../types/production'
import { TEXTURE_LIST, DIET_LIST } from '../../../types/production'
import { MEAL_SLOT_LABELS } from '../../../types/menu'

interface Props {
  sheet: ProductionSheet
  onClose: () => void
}

export default function PrintSheet({ sheet, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="print-root bg-white p-8 max-w-5xl mx-auto font-sans">
      <div className="no-print flex justify-end mb-4">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 underline">← Back</button>
      </div>

      <div className="mb-6 border-b pb-4">
        <h1 className="text-xl font-bold">
          Production Sheet — {sheet.day} {MEAL_SLOT_LABELS[sheet.slot]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Printed: {new Date().toLocaleDateString()} &nbsp;|&nbsp;
          {sheet.signedOffBy ? `Signed off: ${sheet.signedOffBy}` : 'Not yet signed off'}
        </p>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-6 text-center">
        {([
          ['Total', sheet.counts.total],
          ['Dining Room', sheet.counts.diningRoom],
          ['Room', sheet.counts.room],
          ['Assisted Living', sheet.counts.assistedLiving],
          ['Memory Care', sheet.counts.memoryCare],
          ['Absent', sheet.counts.absent],
        ] as [string, number][]).map(([label, val]) => (
          <div key={label} className="border rounded p-2">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold">{val}</div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">By Texture</h2>
      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left">Item</th>
            {TEXTURE_LIST.map(t => <th key={t} className="border px-2 py-2 text-center">{t}</th>)}
            <th className="border px-3 py-2 text-center">Total</th>
            <th className="border px-3 py-2 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map(row => (
            <tr key={row.menuItemId}>
              <td className="border px-3 py-2 font-medium">
                {row.menuItemName}{row.textureModified && ' (TM)'}
              </td>
              {TEXTURE_LIST.map(t => (
                <td key={t} className="border px-2 py-2 text-center">
                  {(row.textureCounts[t] ?? 0) || '—'}
                </td>
              ))}
              <td className="border px-3 py-2 text-center font-bold">{row.total}</td>
              <td className="border px-3 py-2 text-sm text-gray-500">{row.kitchenNote ?? ''}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td className="border px-3 py-2">Totals</td>
            {TEXTURE_LIST.map(t => (
              <td key={t} className="border px-2 py-2 text-center">
                {sheet.rows.reduce((s, r) => s + (r.textureCounts[t] ?? 0), 0) || '—'}
              </td>
            ))}
            <td className="border px-3 py-2 text-center">{sheet.rows.reduce((s, r) => s + r.total, 0)}</td>
            <td className="border" />
          </tr>
        </tbody>
      </table>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">By Diet</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left">Item</th>
            {DIET_LIST.map(d => <th key={d} className="border px-2 py-2 text-center">{d}</th>)}
            <th className="border px-3 py-2 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map(row => (
            <tr key={row.menuItemId}>
              <td className="border px-3 py-2 font-medium">{row.menuItemName}</td>
              {DIET_LIST.map(d => (
                <td key={d} className="border px-2 py-2 text-center">
                  {(row.dietCounts[d] ?? 0) || '—'}
                </td>
              ))}
              <td className="border px-3 py-2 text-center font-bold">{row.total}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td className="border px-3 py-2">Totals</td>
            {DIET_LIST.map(d => (
              <td key={d} className="border px-2 py-2 text-center">
                {sheet.rows.reduce((s, r) => s + (r.dietCounts[d] ?? 0), 0) || '—'}
              </td>
            ))}
            <td className="border px-3 py-2 text-center">{sheet.rows.reduce((s, r) => s + r.total, 0)}</td>
          </tr>
        </tbody>
      </table>

      <style>{`@media print { .no-print { display: none; } }`}</style>
    </div>
  )
}
