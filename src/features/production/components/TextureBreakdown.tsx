import React from 'react'
import type { ProductionSheet } from '../../../types/production'
import { TEXTURE_LIST, DIET_LIST } from '../../../types/production'

interface Props {
  sheet: ProductionSheet
}

export default function TextureBreakdown({ sheet }: Props) {
  const textureTotals = TEXTURE_LIST.reduce((acc, t) => {
    acc[t] = sheet.rows.reduce((s, r) => s + (r.textureCounts[t] ?? 0), 0)
    return acc
  }, {} as Record<string, number>)

  const dietTotals = DIET_LIST.reduce((acc, d) => {
    acc[d] = sheet.rows.reduce((s, r) => s + (r.dietCounts[d] ?? 0), 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotal = sheet.rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Texture Breakdown</h3>
        <div className="space-y-2">
          {TEXTURE_LIST.map(t => {
            const count = textureTotals[t] ?? 0
            const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0
            return (
              <div key={t}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600">{t}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Diet Breakdown</h3>
        <div className="space-y-1.5">
          {DIET_LIST.map(d => {
            const count = dietTotals[d] ?? 0
            return (
              <div key={d} className="flex justify-between text-xs">
                <span className="text-gray-600">{d}</span>
                <span className={`font-semibold ${ count > 0 ? 'text-gray-800' : 'text-gray-300' }`}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-1">Ensure / Supplements</h3>
        <p className="text-xs text-amber-700">Check resident profiles for daily Ensure counts.</p>
      </div>
    </div>
  )
}
